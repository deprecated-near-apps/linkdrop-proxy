const assert = require("assert");
const { Runner, tGas, createKeyPair, toYocto } = require("near-runner");

let runner;

// 50 Tgas is enough
const gas = tGas("50");
const double_gas = tGas("200");



describe("Linkdrop Proxy", function () {
  this.timeout(20000);
  
  // linkdrop keypairs
  const keyPair1 = createKeyPair();
  const keyPair2 = createKeyPair();
  const public_key1 = keyPair1.publicKey.toString();
  const public_key2 = keyPair2.publicKey.toString();
  // the new account's keypair
  const keyPairNewAccount = createKeyPair();
  const new_public_key = keyPairNewAccount.publicKey.toString();

  this.beforeAll(async () => {
    runner = await Runner.create(async ({ runtime }) => {
      const linkdrop = await runtime.createAndDeploy(
        "linkdrop",
        `${__dirname}/../target/wasm32-unknown-unknown/release/linkdrop_proxy.wasm`
      );
      const testnet = await runtime.createAndDeploy(
        "testnet",
        `${__dirname}/../target/wasm32-unknown-unknown/release/fake_linkdrop.wasm`
      );
  
      await runtime.getRoot().call(
        linkdrop,
        "new",
        {
          linkdrop_contract: testnet.accountId,
        },
        {
          gas,
        }
      );
      return { linkdrop, testnet };
    });
  });

  

  it("creation of linkdrop and wallet link for testing", async function () {
    await runner.run(async ({linkdrop, root}) => {
      root.call(linkdrop, "send", {
        public_key: public_key1
      },
      { gas,
        // could be 0.02 N wallet needs to reduce gas from 100 Tgas to 50 Tgas
        attachedDeposit: toYocto("0.3"),
      })
    });
    if (Runner.networkIsTestnet()) {
      console.log(
        `https://wallet.testnet.near.org/linkdrop/${linkdrop.accountId}/${keyPair1.secretKey}?redirectUrl=https://example.com`
      );
    }
  });

  it("creation of linkdrop", async function () {
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
      // can only create subaccounts
      const new_account_id = `bob.${testnet.accountId}`;
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
      // console.log(JSON.stringify(res, null, 4));
      const bob = runtime.getAccount(new_account_id, false);
      console.log(await bob.balance());
    });
  });

  // it("creation of account", async function () {
  //   // WARNING tests after this with contractAccount will fail - signing key lost
  //   // set key for contractAccount to linkdrop keyPair
  //   near.connection.signer.keyStore.setKey(networkId, contractId, keyPair2);
  //   const new_account_id = "linkdrop-wrapper-" + Date.now().toString();

  //   const res = await linkdropAccount.functionCall({
  //     contractId,
  //     methodName: "create_account_and_claim",
  //     args: {
  //       new_account_id,
  //       new_public_key,
  //     },
  //     gas: double_gas,
  //   });

  //   const accountRegex = /Account Created/;
  //   const outcome = res.receipts_outcome.find((ro) =>
  //     ro.outcome.logs.some((l) => accountRegex.test(l))
  //   ).outcome;
  //   // console.log(outcome);
  //   assert.strictEqual(outcome.logs[1], new_account_id);
  //   const value = JSON.parse(
  //     Buffer.from(res.status.SuccessValue, "base64").toString()
  //   );
  //   // let status = res.receipts_outcome.find(ro => ro.outcome.status.SuccessValue && ro.outcome.status.SuccessValue)
  //   // true
  //   // TODO: Base64 decode
  //   assert.strictEqual(value, new_account_id);
  // });

  // 	// WARNING tests after this with contractAccount will fail - signing key lost
});
 after(() => {
   // Required to exit for some reason
   process.exit(0);
 })