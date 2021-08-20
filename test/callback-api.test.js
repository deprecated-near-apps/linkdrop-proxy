// const assert = require('assert');
// const { KeyPair } = require('near-api-js');
// const { parseNearAmount } = require('near-api-js/lib/utils/format');
// const testUtils = require('./test-utils');

// const {
// 	near,
// 	networkId,
// 	contractId,
// 	contractAccount,
// } = testUtils;

// // 50 Tgas is enough
// const gas = '50000000000000';
// const double_gas = '300000000000000'

// describe('Linkdrop Wrapper with callback', function () {
// 	this.timeout(20000);

// 	// linkdrop keypairs
// 	const keyPair1 = KeyPair.fromRandom('ed25519')
// 	const keyPair2 = KeyPair.fromRandom('ed25519')
// 	const public_key1 = keyPair1.publicKey.toString()
// 	const public_key2 = keyPair2.publicKey.toString()
// 	// the new account's keypair
// 	const keyPairNewAccount = KeyPair.fromRandom('ed25519')
// 	const new_public_key = keyPairNewAccount.publicKey.toString()

// 	it('contract deployed', async function() {
// 		const state = await contractAccount.state()
// 		try {
// 			await contractAccount.functionCall({
// 				contractId,
// 				methodName: 'new',
// 				args: {
// 					linkdrop_contract: 'testnet'
// 				},
// 				gas
// 			})
// 		} catch (e) {
// 			if (!/contract has already been initialized/.test(e.toString())) {
// 				console.warn(e)
// 			}
// 		}

// 		assert.notStrictEqual(state.code_hash, '11111111111111111111111111111111');
// 	});

//   	it('creation of linkdrop and wallet link for testing', async function() {
// 		await contractAccount.functionCall({
// 			contractId,
// 			methodName: 'send',
// 			args: {
// 				public_key: public_key1
// 			},
// 			gas,
// 			// could be 0.02 N wallet needs to reduce gas from 100 Tgas to 50 Tgas
// 			attachedDeposit: parseNearAmount('0.3')
// 		})

// 		console.log(`https://wallet.testnet.near.org/linkdrop/${contractId}/${keyPair1.secretKey}?redirectUrl=https://example.com`)

// 		return true
// 	});

// 	it('creation of linkdrop', async function() {
// 		const res = await contractAccount.functionCall({
// 			contractId,
// 			methodName: 'send_with_callback',
// 			args: {
// 				public_key: public_key2,
//         contract_id: contractId,
//         gas_required: gas,
// 			},
// 			gas,
// 			attachedDeposit: parseNearAmount('0.2')
// 		})

// 		assert.strictEqual(res.status.SuccessValue, '');
// 	});

// 	it('creation of account', async function() {
// 		// WARNING tests after this with contractAccount will fail - signing key lost
// 		// set key for contractAccount to linkdrop keyPair
// 		near.connection.signer.keyStore.setKey(networkId, contractId, keyPair2);
//     const new_account_id = 'test-linkdrop-wrapper-' + Date.now().toString();
// 		const res = await contractAccount.functionCall({
// 			contractId,
// 			methodName: 'create_account_and_claim',
// 			args: {
// 				new_account_id,
// 				new_public_key,
// 			},
// 			gas: double_gas,
// 		})

//     const accountRegex = /Account Created/;
//     const outcome = res.receipts_outcome.find(ro => ro.outcome.logs.some(l => accountRegex.test(l))).outcome;
//     // console.log(outcome);
//     assert.strictEqual(outcome.logs[1], new_account_id)
//     const value = JSON.parse(Buffer.from(res.status.SuccessValue, 'base64').toString());
//     // let status = res.receipts_outcome.find(ro => ro.outcome.status.SuccessValue && ro.outcome.status.SuccessValue)
// 		// true
//     // TODO: Base64 decode
// 		assert.strictEqual(value, new_account_id);
// 	});

	

// })
