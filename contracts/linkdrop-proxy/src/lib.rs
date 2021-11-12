use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::json_types::U128;
use near_sdk::{
    env, ext_contract, near_bindgen, AccountId, Balance, BorshStorageKey, Gas, PanicOnDefault,
    Promise, PromiseResult, PublicKey,
};

#[near_bindgen]
#[derive(PanicOnDefault, BorshDeserialize, BorshSerialize)]
pub struct LinkDrop {
    pub linkdrop_contract: AccountId,
    pub accounts: LookupMap<PublicKey, Balance>,
}

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    Accounts,
}

/// 0.064311394105062020653824 N
pub(crate) const ACCESS_KEY_ALLOWANCE: u128 = 109781200101466873685832;
/// can take 0.5 of access key since gas required is 6.6 times what was actually used
const NEW_ACCOUNT_BASIC_AMOUNT: u128 = 9_500_000_000_000_000_000_000;
const ON_CREATE_ACCOUNT_GAS: Gas = Gas(16_000_000_000_000);
const NO_DEPOSIT: Balance = 0;

/// Gas attached to the callback from account creation.
pub const ON_CREATE_ACCOUNT_CALLBACK_GAS: Gas = Gas(3_000_000_000_000);

#[ext_contract(ext_linkdrop)]
trait ExtLinkdrop {
    fn create_account(&mut self, new_account_id: AccountId, new_public_key: PublicKey) -> Promise;

    fn on_create_and_claim(&mut self, amount: U128) -> bool;
}

fn assert_allowance() {
    assert!(
        env::attached_deposit() >= ACCESS_KEY_ALLOWANCE,
        "Attached deposit must be greater than or equal to ACCESS_KEY_ALLOWANCE"
    );
}

fn is_promise_success() -> bool {
    assert_eq!(
        env::promise_results_count(),
        1,
        "Contract expected a result on the callback"
    );
    match env::promise_result(0) {
        PromiseResult::Successful(_) => true,
        _ => false,
    }
}

#[near_bindgen]
impl LinkDrop {
    #[init]
    pub fn new(linkdrop_contract: AccountId) -> Self {
        Self {
            linkdrop_contract,
            accounts: LookupMap::new(StorageKey::Accounts),
        }
    }
    /// Allows given public key to claim sent balance.
    /// Takes ACCESS_KEY_ALLOWANCE as fee from deposit to cover account creation via an access key.
    #[payable]
    pub fn send(&mut self, public_key: PublicKey) -> Promise {
        assert_allowance();
        let value = self.initial_total_balance(&public_key);
        let promise = self.add_key(public_key.into(), value);
        promise
    }

    /// Claim tokens for specific account that are attached to the public key this tx is signed with.
    #[private]
    pub fn claim(&mut self, account_id: AccountId) -> Promise {
        let amount = self.delete_signer();
        delete_current_access_key();
        Promise::new(account_id).transfer(amount)
    }

    /// Create new account and and claim tokens to it.
    #[private]
    pub fn create_account_and_claim(
        &mut self,
        new_account_id: AccountId,
        new_public_key: PublicKey,
    ) -> Promise {
        let mut amount = self.delete_signer();

        if amount == 0 {
            amount = NEW_ACCOUNT_BASIC_AMOUNT;
        }
        self.create_account(new_account_id, new_public_key, amount)
            .then(ext_linkdrop::on_create_and_claim(
                amount.into(),
                env::current_account_id(),
                NO_DEPOSIT,
                ON_CREATE_ACCOUNT_CALLBACK_GAS,
            ))
    }

    /// Returns the balance associated with given key.
    pub fn get_key_balance(&self, key: PublicKey) -> U128 {
        self.internal_get_key_balance(&key).into()
    }

    #[private]
    pub fn on_create_and_claim(&mut self, amount: U128) -> bool {
        let creation_succeeded = is_promise_success();
        if creation_succeeded {
            delete_current_access_key();
        } else {
            // In case of failure, put the amount back.
            self.accounts
                .insert(&env::signer_account_pk(), &amount.into());
        }
        creation_succeeded
    }
}

// Private methods
impl LinkDrop {
    fn create_account(
        &self,
        new_account_id: AccountId,
        new_public_key: PublicKey,
        amount: Balance,
    ) -> Promise {
        ext_linkdrop::create_account(
            new_account_id,
            new_public_key,
            self.get_linkdrop_contract(),
            amount,
            ON_CREATE_ACCOUNT_GAS,
        )
    }
    fn add_key(&mut self, key: PublicKey, value: Balance) -> Promise {
        self.accounts.insert(&key, &value);
        Promise::new(env::current_account_id()).add_access_key(
            key,
            ACCESS_KEY_ALLOWANCE,
            env::current_account_id(),
            "claim,create_account_and_claim".to_string(),
        )
    }

    fn delete_signer(&mut self) -> Balance {
        self.accounts
            .remove(&env::signer_account_pk())
            .expect("Unexpected public key")
    }

    fn internal_get_key_balance(&self, key: &PublicKey) -> Balance {
        self.accounts.get(key.into()).expect("Key is missing")
    }

    fn initial_total_balance(&self, key: &PublicKey) -> Balance {
        add_balance(self.accounts.get(key.into()).unwrap_or(0))
    }

    fn get_linkdrop_contract(&self) -> AccountId {
        AccountId::new_unchecked(self.linkdrop_contract.to_string())
    }
}



fn add_balance(value: Balance) -> Balance {
    value + env::attached_deposit() - ACCESS_KEY_ALLOWANCE
}

fn delete_current_access_key() -> Promise {
    Promise::new(env::current_account_id()).delete_key(env::signer_account_pk())
}
