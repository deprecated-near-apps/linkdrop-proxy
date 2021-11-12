import {
  Workspace,
  createKeyPair,
  Account,
  NearAccount,
} from "near-workspaces-ava";
import { NEAR, Gas } from "near-units";

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

const SEND_ACCESS_KEY =
  Workspace.getNetworkFromEnv() === "testnet"
    ? NEAR.parse("0.109781200101466873685832")
    : NEAR.parse("0.159781200101466873685832");

function randomAccountId(): string {
  let accountId;
  // create random number with at least 7 digits
  const randomNumber = Math.floor(Math.random() * (9999 - 1000) + 1000);
  accountId = `d${Date.now()}-${randomNumber}`;
  return accountId;
}

const workspace = Workspace.init(
  { initialBalance: NEAR.parse("20 N").toString() },
  async ({ root }) => {
    const networkLinkdrop: NearAccount = Workspace.networkIsTestnet()
      ? // Just need accountId "testnet"
        new ActualTestnet("testnet")
      : // Otherwise use fake linkdrop acconut on sandbox
        await root.createAndDeploy(
          "testnet",
          `${__dirname}/../target/wasm32-unknown-unknown/release/sandbox_linkdrop.wasm`
        );
    const linkdropProxy = await root.createAndDeploy(
      "linkdrop",
      `${__dirname}/../target/wasm32-unknown-unknown/release/linkdrop_proxy_small.wasm`
      // {
      //   method: "new",
      //   args: {
      //     linkdrop_contract: networkLinkdrop.accountId,
      //   },
      //   gas: tGas("8"),
      // }
    );
    return { linkdropProxy, networkLinkdrop };
  }
);

workspace.test(
  "Use `create_account_and_claim` to create a new account",
  async (t, { root, linkdropProxy, networkLinkdrop }) => {
    // Create temporary keys for access key on linkdrop
    const senderKey = createKeyPair();
    const public_key = senderKey.getPublicKey().toString();
    const attachedDeposit = NEAR.from(
      await linkdropProxy.view("get_key_balance")
    )
      .add(NEAR.parse("2.72 mN"))
      .add(NEAR.parse("1.82mN"));
    const linkdrop_proxy_balance = await linkdropProxy.availableBalance();

    // This adds the key as a function access key on `create_account_and_claim`
    const txResult = await root.call_raw(
      linkdropProxy,
      "send",
      {
        public_key,
      },
      {
        attachedDeposit,
        gas: Gas.parse("7 TGas"),
      }
    );
    t.log(txResult.summary());
    t.log(`Logs:\n${txResult.logs.join(" ")}`);
    // t.log(JSON.stringify(txResult, null, 4));
    t.log(await linkdropProxy.view("get_key_balance", {}));
    // Create a random subaccount
    const new_account_id = `${randomAccountId()}.${networkLinkdrop.accountId}`;
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
    await new_account.setKey(actualKey);
    const balance = await new_account.availableBalance();
    t.log(
      `new account created: ${
        new_account.accountId
      } with balance ${await balance.toHuman()}`
    );

    if (Workspace.networkIsTestnet()) {
      console.log(
        `http://explorer.testnet.near.org/accounts/${new_account.accountId}`
      );

      // Since root didn't create the account it needs to be manually deleted to clean up after itself
      await new_account.delete(root.accountId);
    }
    t.log(linkdrop_proxy_balance.toHuman());
    const currentBalance = await linkdropProxy.availableBalance();
    t.log(currentBalance.toHuman());
    t.log(linkdrop_proxy_balance.sub(currentBalance).abs().toHuman());
    t.assert(balance.toHuman());
  }
);

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
// });
