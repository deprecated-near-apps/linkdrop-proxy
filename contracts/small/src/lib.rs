use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::{
    env, ext_contract, near_bindgen, require, AccountId, Balance, Gas, Promise,
    PromiseResult, PublicKey,
};
use near_units::parse_near;

#[near_bindgen]
#[derive(Default, BorshDeserialize, BorshSerialize)]
pub struct LinkDrop {}

/// 0.064311394105062020653824 N
pub(crate) const ACCESS_KEY_ALLOWANCE: u128 = 109781200101466873685832;
/// can take 0.5 of access key since gas required is 6.6 times what was actually used
const ON_CREATE_ACCOUNT_GAS: Gas = Gas(16_000_000_000_000);
const NO_DEPOSIT: Balance = 0;

/// Gas attached to the callback from account creation.
pub const ON_CREATE_ACCOUNT_CALLBACK_GAS: Gas = Gas(3_000_000_000_000);

#[ext_contract(ext_linkdrop)]
trait ExtLinkdrop {
    fn create_account(&mut self, new_account_id: AccountId, new_public_key: PublicKey) -> Promise;

    fn on_create_and_claim(&mut self) -> bool;
}

fn assert_deposit() {
    require!(
        env::attached_deposit() >= ACCESS_KEY_ALLOWANCE + LinkDrop::get_deposit(),
        "Attached deposit must be greater than or equal to ACCESS_KEY_ALLOWANCE + Deposit"
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
    /// Allows given public key to claim sent balance.
    /// Takes ACCESS_KEY_ALLOWANCE as fee from deposit to cover account creation via an access key.
    #[payable]
    pub fn send(&mut self, public_key: PublicKey) -> Promise {
        assert_deposit();
        self.add_key(public_key.into())
    }

    /// Claim tokens for specific account that are attached to the public key this tx is signed with.
    #[private]
    pub fn claim(&mut self, account_id: AccountId) -> Promise {
        delete_current_access_key();
        Promise::new(account_id).transfer(LinkDrop::get_deposit())
    }

    /// Create new account and and claim tokens to it.
    #[private]
    pub fn create_account_and_claim(
        &mut self,
        new_account_id: AccountId,
        new_public_key: PublicKey,
    ) -> Promise {
        let amount = LinkDrop::get_deposit();
        self.create_account(new_account_id, new_public_key, amount)
            .then(ext_linkdrop::on_create_and_claim(
                env::current_account_id(),
                NO_DEPOSIT,
                ON_CREATE_ACCOUNT_CALLBACK_GAS,
            ))
    }

    /// Returns the balance associated with given key.
    #[allow(unused_variables)]
    pub fn get_key_balance(&self, key: PublicKey) -> U128 {
        LinkDrop::get_deposit().into()
    }

    #[private]
    pub fn on_create_and_claim(&mut self) -> bool {
        if is_promise_success() {
            delete_current_access_key();
            return true;
        }
        false
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
    fn add_key(&mut self, key: PublicKey) -> Promise {
        Promise::new(env::current_account_id()).add_access_key(
            key,
            ACCESS_KEY_ALLOWANCE,
            env::current_account_id(),
            "claim,create_account_and_claim".to_string(),
        )
    }
    fn get_linkdrop_contract(&self) -> AccountId {
        AccountId::new_unchecked(
            (if cfg!(feature = "mainnet") {
                "near"
            } else {
                "testnet"
            })
            .to_string(),
        )
    }

    fn get_deposit() -> u128 {
        option_env!("LINKDROP_DEPOSIT").map_or_else(|| parse_near!("1 N"), |s| s.parse().unwrap())
    }
}

fn delete_current_access_key() -> Promise {
    Promise::new(env::current_account_id()).delete_key(env::signer_account_pk())
}
