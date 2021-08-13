import { Runner, toYocto, createKeyPair, BN, tGas, Account } from "near-runner";

class ActualTestnet extends Account {
  constructor(private name: string) {
    super(null as any);
  }

  get accountId(): string {
    return this.name;
  }
}

/* Contract API for reference
impl Linkdrop {
  pub fn create_account(new_account_id: &str, new_public_key: &str){}
  pub fn get_key_balance(public_key: &str){}
  pub fn send(public_key: &str){}
  pub fn create_account_and_claim(new_account_id: &str, new_public_key: &str){}
  pub fn on_account_created(predecessor_account_id: &str, amount: &str){}
  pub fn on_account_created_and_claimed(amount: &str){}
  pub fn claim(account_id: &str){}
}
*/

function randomAccountId(): string {
  let accountId;
  // create random number with at least 7 digits
  const randomNumber = Math.floor(Math.random() * (9999 - 1000) + 1000);
  accountId = `${Date.now()}-${randomNumber}`;
  return accountId;
}

describe(`Running on ${Runner.getNetworkFromEnv()}`, () => {
  jest.setTimeout(60000);
  let runner: Runner;

  beforeAll(async () => {
    runner = await Runner.create(async ({ runtime }) => {
      const linkdrop = await runtime.createAndDeploy(
        "linkdrop",
        `${__dirname}/../target/wasm32-unknown-unknown/release/linkdrop_proxy.wasm`
      );
      const testnet = Runner.networkIsTestnet() 
          // Just need accountId "testnet"
        ? new ActualTestnet("testnet")
        // Otherwise use fake linkdrop acconut on sandbox
        : await runtime.createAndDeploy(
            "testnet",
            `${__dirname}/../target/wasm32-unknown-unknown/release/fake_linkdrop.wasm`
          );
      await linkdrop.call(
        linkdrop,
        "new",
        {
          linkdrop_contract: testnet.accountId,
        },
        {
          gas: tGas("10"),
        }
      );
      return { linkdrop, testnet };
    });
  });

  test("Use `create_account_and_claim` to create a new account", async () => {
    await runner.run(async ({ root, linkdrop, testnet }, runtime) => {
      // Create temporary keys for access key on linkdrop
      const senderKey = createKeyPair();
      const public_key = senderKey.getPublicKey().toString();

      // This adds the key as a function access key on `create_account_and_claim`
      await root.call(
        linkdrop,
        "send",
        {
          public_key,
        },
        {
          attachedDeposit: toYocto("2"),
        }
      );
      // Create a random subaccount
      const new_account_id = `${randomAccountId()}.${testnet.accountId}`;
      const actualKey = createKeyPair();
      const new_public_key = actualKey.getPublicKey().toString();

      let res = await linkdrop.call_raw(
        linkdrop,
        "create_account_and_claim",
        {
          new_account_id,
          new_public_key,
        },
        {
          signWithKey: senderKey,
          gas: tGas("100"),
        }
      );

      let new_account = runtime.getAccount(new_account_id, false);
      if (Runner.networkIsTestnet()) {
        console.log(
          `http://explorer.testnet.near.org/accounts/${new_account.accountId}`
        );
      }
      console.log(
        `new account created: ${
          new_account.accountId
        } with balance ${await (await new_account.balance()).available} yoctoNear`
      );
    });
  });

  test("Use `claim` to transfer to an existing account", async () => {
    await runner.run(async ({ root, linkdrop }, runtime) => {
      const bob = await runtime.createAccount("bob");
      const originalBalance = await bob.balance();
      // Create temporary keys for access key on linkdrop
      const senderKey = createKeyPair();
      const public_key = senderKey.getPublicKey().toString();

      // This adds the key as a function access key on `create_account_and_claim`
      await root.call(
        linkdrop,
        "send",
        {
          public_key,
        },
        {
          attachedDeposit: toYocto("2"),
        }
      );
      // can only create subaccounts

      let res = await linkdrop.call_raw(
        linkdrop,
        "claim",
        {
          account_id: bob.accountId,
        },
        {
          signWithKey: senderKey,
          gas: tGas("70"),
        }
      );

      const newBalance = await bob.balance();

      const originalAvaiable = new BN(originalBalance.available);
      const newAvaiable = new BN(newBalance.available);
      expect(originalAvaiable.lt(newAvaiable)).toBeTruthy();

      console.log(
        `${bob.accountId} claimed ${newAvaiable
          .sub(originalAvaiable)
          .toString()} yoctoNear`
      );
    });
  });
});
