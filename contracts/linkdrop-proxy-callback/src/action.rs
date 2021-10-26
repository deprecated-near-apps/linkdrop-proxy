use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, AccountId, Balance};
use serde::{Deserialize, Serialize};

use crate::*;

///
#[derive(Serialize, Deserialize, BorshSerialize, BorshDeserialize, Clone)]
pub struct Action{
  pub deposit: Balance,
  pub contract: AccountId,
  pub required_gas: Gas,
}

impl Default for Action {
  fn default() -> Action {
      Action { deposit: 0, contract: AccountId {0:"".to_string()}, required_gas: Gas(0) }
  }
}

impl Action {
    pub fn update_balance(&mut self) {
      self.balance = add_balance(self.balance);
    }

    pub fn add_callback(self, contract: AccountId, required_gas: Gas) -> Action {
        Action { 
          deposit: self.deposit,
          contract,
          required_gas,
        }
    }

    pub fn deposit(&self) -> Balance {
      self.0
    }

    pub fn gas(&self) -> Gas {
      self.2
    }
}

fn add_balance(value: Balance) -> Balance {
    value + env::attached_deposit() - ACCESS_KEY_ALLOWANCE
}
