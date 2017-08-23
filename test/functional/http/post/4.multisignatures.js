'use strict';

var node = require('../../../node');
var shared = require('./shared');
var constants = require('../../../../helpers/constants');

var sendTransaction = require('../../../common/complexTransactions').sendTransaction;
var creditAccount = require('../../../common/complexTransactions').creditAccount;
var sendSignature = require('../../../common/complexTransactions').sendSignature;

var sendSignaturePromisify = node.Promise.promisify(sendSignature);

describe('POST /api/transactions (type 4) register multisignature', function () {

	var badTransactions = [];
	var goodTransactions = [];
	var badTransactionsEnforcement = [];
	var goodTransactionsEnforcement = [];
	var pendingMultisignatures = [];

	var account = node.randomAccount();
	var account2 = node.randomAccount();
	var account3 = node.randomAccount();
	var accountNoFunds = node.randomAccount();
	var accountScarceFunds = node.randomAccount();

	var transaction, signature2, signature3;

	before(function (done) {
		// Crediting accounts
		creditAccount(account.address, 100000000000, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
		});

		creditAccount(account2.address, 100000000000, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
		});

		creditAccount(account3.address, 100000000000, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
		});

		creditAccount(accountScarceFunds.address, constants.fees.multisignature * 3, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
			node.onNewBlock(done);
		});
	});

	describe('schema validations', function () {

		shared.invalidAssets(account, 'multisignature', badTransactions);

		it('using empty keysgroup should fail', function (done) {
			transaction = node.lisk.multisignature.createMultisignature(account.password, null, [], 1, 2);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Invalid multisignature keysgroup. Must not be empty');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('using sender in the keysgroup should fail', function (done) {
			transaction = node.lisk.multisignature.createMultisignature(account.password, null, ['+' + node.eAccount.publicKey, '+' + account.publicKey], 1, 2);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Invalid multisignature keysgroup. Can not contain sender');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('using no math operator in keysgroup should fail', function (done) {
			transaction = node.lisk.multisignature.createMultisignature(account.password, null, [node.eAccount.publicKey, accountNoFunds.publicKey, accountScarceFunds.publicKey], 1, 2);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Invalid math operator in multisignature keysgroup');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('using invalid math operator in keysgroup should fail', function (done) {
			transaction = node.lisk.multisignature.createMultisignature(account.password, null, ['-' + node.eAccount.publicKey, '+' + accountNoFunds.publicKey, '+' + accountScarceFunds.publicKey], 1, 2);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Invalid math operator in multisignature keysgroup');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		// TODO: bug in 1.0.0
		it.skip('using empty member in keysgroup should fail', function (done) {
			transaction = node.lisk.multisignature.createMultisignature(account.password, null, ['+' + node.eAccount.publicKey, '+' + accountNoFunds.publicKey, '+' + accountScarceFunds.publicKey, null], 1, 2);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Invalid math operator in multisignature keysgroup');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		// TODO: change sentence 'Must be less than or equal to keysgroup size + 1'
		it('using min bigger than keysgroup size plus 1 should fail', function (done) {
			transaction = node.lisk.multisignature.createMultisignature(account.password, null, [node.eAccount.publicKey], 1, 3);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.not.ok;
				node.expect(res).to.have.property('message').to.equal('Invalid multisignature min. Must be less than keysgroup size');
				badTransactions.push(transaction);
				done();
			}, true);
		});
	});

	describe('transactions processing', function () {

		it('with no funds should fail', function (done) {
			transaction = node.lisk.multisignature.createMultisignature(accountNoFunds.password, null, ['+' + node.eAccount.publicKey, '+' + account.publicKey, '+' + accountScarceFunds.publicKey], 1, 2);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.not.be.ok;
				node.expect(res).to.have.property('message').to.equal('Account does not have enough LSK: ' + accountNoFunds.address + ' balance: 0');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('with scarce funds should be ok', function (done) {
			transaction = node.lisk.multisignature.createMultisignature(accountScarceFunds.password, null, ['+' + account2.publicKey, '+' + account3.publicKey], 1, 2);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				pendingMultisignatures.push(transaction);
				done();
			}, true);
		});

		it('using valid params should be ok', function (done) {
			transaction = node.lisk.multisignature.createMultisignature(account.password, null, ['+' + account2.publicKey, '+' + account3.publicKey], 1, 2);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				pendingMultisignatures.push(transaction);
				done();
			}, true);
		});

		describe('signing transactions', function () {

			it('with not all the signatures should be ok but never confirmed', function () {
				signature2 = node.lisk.multisignature.signTransaction(pendingMultisignatures[0], account2.password);

				return sendSignaturePromisify(signature2, pendingMultisignatures[0]).then(function (res) {
					node.expect(res).to.have.property('success').to.be.ok;
				});
			});

			it('with all the signatures should be ok and confirmed', function () {
				signature2 = node.lisk.multisignature.signTransaction(pendingMultisignatures[1], account2.password);

				return sendSignaturePromisify(signature2, pendingMultisignatures[1]).then(function (res) {
					node.expect(res).to.have.property('success').to.be.ok;

					signature3 = node.lisk.multisignature.signTransaction(pendingMultisignatures[1], account3.password);

					return sendSignaturePromisify(signature3, pendingMultisignatures[1]).then(function (res) {
						node.expect(res).to.have.property('success').to.be.ok;

						goodTransactions.push(pendingMultisignatures[1]);
						pendingMultisignatures.pop();
					});
				});
			});
		});
	});

	describe('transactions confirmation', function () {

		shared.confirmationPhase(goodTransactions, badTransactions, pendingMultisignatures);
	});
	//
	// describe('enforcement', function () {
	// });
	//
	// describe('enforcement confirmation', function () {
	//
	// 	shared.confirmationPhase(goodTransactionsEnforcement, badTransactionsEnforcement);
	// });
});
