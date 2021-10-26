import { Runner, toYocto, createKeyPair, BN, tGas, Account, NearAccount } from "near-runner";
import { NEAR, Gas} from "near-units";

class ActualTestnet extends Account {
  constructor(private name: string) {
    super(null as any, null as any);
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

const SEND_ACCESS_KEY = Runner.getNetworkFromEnv() === 'testnet' ? NEAR.parse('0.109781200101466873685832'): NEAR.parse('0.159781200101466873685832');

function randomAccountId(): string {
  let accountId;
  // create random number with at least 7 digits
  const randomNumber = Math.floor(Math.random() * (9999 - 1000) + 1000);
  accountId = `d${Date.now()}-${randomNumber}`;
  return accountId;
}

describe(`Running on ${Runner.getNetworkFromEnv()}`, () => {
  jest.setTimeout(60000);
  const runner = Runner.create(async ({ root }) => {
      const networkLinkdrop: NearAccount = Runner.networkIsTestnet()
        ? // Just need accountId "testnet"
          new ActualTestnet("testnet")
        : // Otherwise use fake linkdrop acconut on sandbox
          await root.createAndDeploy(
            "sandbox",
            `${__dirname}/../target/wasm32-unknown-unknown/release/sandbox_linkdrop.wasm`
          );
      const linkdropProxy = await root.createAndDeploy(
        "linkdrop",
        `${__dirname}/../target/wasm32-unknown-unknown/release/linkdrop_proxy.wasm`,
        {
          method: "new",
          args: {
            linkdrop_contract: networkLinkdrop.accountId,
          },
          gas: tGas("8"),
        }
      );
      return { linkdropProxy, networkLinkdrop };
    });

  test.only("Use `create_account_and_claim` to create a new account", async () => {
    await runner.run(
      async ({ root, linkdropProxy, networkLinkdrop }) => {
        // Create temporary keys for access key on linkdrop
        const senderKey = createKeyPair();
        const public_key = senderKey.getPublicKey().toString();

        // This adds the key as a function access key on `create_account_and_claim`
        const txResult = await root.call_raw(
          linkdropProxy,
          "send",
          {
            public_key,
          },
          {
            attachedDeposit: SEND_ACCESS_KEY,
            gas: Gas.parse("7 TGas")
          }
        );
        console.log(txResult.summary())
        console.log(`Logs:\n${txResult.logs.join(' ')}`);
        console.log(JSON.stringify(txResult, null, 4))
        console.log(await linkdropProxy.view("get_key_balance", {key: public_key}))
        // Create a random subaccount
        const new_account_id = `${randomAccountId()}.${
          networkLinkdrop.accountId
        }`;
        const actualKey = createKeyPair();
        const new_public_key = actualKey.getPublicKey().toString();
        let res = await linkdropProxy.call_raw(
          linkdropProxy,
          "create_account_and_claim",
          {
            new_account_id,
            new_public_key,
          },
          {
            signWithKey: senderKey,
            gas: Gas.parse("90 TGas"),
          }
        );


        let new_account = root.getFullAccount(new_account_id);
        if (Runner.networkIsTestnet()) {
          console.log(
            `http://explorer.testnet.near.org/accounts/${new_account.accountId}`
          );

          // Since root didn't create the account it needs to be manually deleted to clean up after itself
          await new_account.createTransaction(new_account).deleteAccount(root.accountId).signAndSend(actualKey);
        }
        console.log(
          `new account created: ${new_account.accountId} with balance ${await (
            await new_account.balance()
            ).available.toHuman()}`
            );
        
      }
    );

  });

//   test("Use `claim` to transfer to an existing account", async () => {
//     await runner.run(async ({ root, linkdropProxy }) => {
//       const bob = await root.createAccount("bob");
//       const originalBalance = await bob.balance();
//       // Create temporary keys for access key on linkdrop
//       const senderKey = createKeyPair();
//       const public_key = senderKey.getPublicKey().toString();

//       // This adds the key as a function access key on `create_account_and_claim`
//       await root.call(
//         linkdropProxy,
//         "send",
//         {
//           public_key,
//         },
//         {
//           attachedDeposit: toYocto("2"),
//         }
//       );
//       // can only create subaccounts

//       let res = await linkdropProxy.call_raw(
//         linkdropProxy,
//         "claim",
//         {
//           account_id: bob.accountId,
//         },
//         {
//           signWithKey: senderKey,
//           gas: tGas("70"),
//         }
//       );

//       const newBalance = await bob.balance();

//       const originalAvaiable = new BN(originalBalance.available);
//       const newAvaiable = new BN(newBalance.available);
//       expect(originalAvaiable.lt(newAvaiable)).toBeTruthy();

//       console.log(
//         `${bob.accountId} claimed ${newAvaiable
//           .sub(originalAvaiable)
//           .toString()} yoctoNear`
//       );
//     });
//   });
});

