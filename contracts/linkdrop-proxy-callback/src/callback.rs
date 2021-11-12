use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, AccountId, Balance, near_bindgen};
use serde::{Deserialize, Serialize};

use crate::*;

///
#[derive(Serialize, Deserialize, BorshSerialize, BorshDeserialize, Clone)]
pub struct Callback {
  pub contract: AccountId,
  pub deposit: Balance,
  pub required_gas: Gas,
  pub method: Option<String>,
}

impl Default for Callback {
  fn default() -> Callback {
      Callback { deposit: 0, contract: AccountId::new_unchecked("".to_string()), required_gas: Gas(0), method: None }
  }
}

impl Callback {
    pub fn update_deposit(&mut self) {
      self.deposit = add_balance(self.deposit);
    }

    fn new(contract: AccountId, deposit: Balance, required_gas: Gas, method: Option<String>) -> Callback {
        Callback { 
          deposit,
          contract,
          required_gas,
          method
        }
    }

}

#[near_bindgen]
impl LinkDrop {
  fn add_callback(&mut self, key: PublicKey, value: Callback) -> Promise {
    self.accounts.insert(&key, &value);
    Promise::new(env::current_account_id()).add_access_key(
        key,
        ACCESS_KEY_ALLOWANCE,
        env::current_account_id(),
        "claim,create_account_and_claim".to_string(),
    )
}

fn get_callback(&self, key: &PublicKey) -> Callback {
    self.accounts.get(key).unwrap_or_default()
}
}

fn add_balance(value: Balance) -> Balance {
    value + env::attached_deposit() - ACCESS_KEY_ALLOWANCE
}
