'use strict';

var node = require('../../../node');
var shared = require('./shared');
var constants = require('../../../../helpers/constants');

var sendTransaction = require('../../../common/complexTransactions').sendTransaction;
var creditAccount = require('../../../common/complexTransactions').creditAccount;

describe('POST /api/transactions (type 1) register second secret', function () {

	var badTransactions = [];
	var goodTransactions = [];
	var badTransactionsEnforcement = [];
	var goodTransactionsEnforcement = [];

	var account = node.randomAccount();
	var accountEmptySecondPassword = node.randomAccount();
	accountEmptySecondPassword.secondPassword = '';
	var accountNoFunds = node.randomAccount();
	var accountScarceFunds = node.randomAccount();

	var transaction;

	// Crediting accounts
	before(function (done) {

		creditAccount(account.address, 100000000000, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
		});

		creditAccount(accountEmptySecondPassword.address, 100000000000, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
		});

		creditAccount(accountScarceFunds.address, constants.fees.secondsignature, function (err, res) {
			node.expect(res).to.have.property('success').to.be.ok;
			node.expect(res).to.have.property('transactionId').that.is.not.empty;
			node.onNewBlock(done);
		});
	});

	describe('schema validations', function () {

		shared.invalidAssets(account, 'signature', badTransactions);
	});

	describe('transactions processing', function () {

		it('with no funds should fail', function (done) {
			transaction = node.lisk.signature.createSignature(accountNoFunds.password, accountNoFunds.secondPassword);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.not.be.ok;
				node.expect(res).to.have.property('message').to.equal('Account does not have enough LSK: ' + accountNoFunds.address + ' balance: 0');
				badTransactions.push(transaction);
				done();
			}, true);
		});

		it('with exact funds should be ok', function (done) {
			transaction = node.lisk.signature.createSignature(accountScarceFunds.password, accountScarceFunds.secondPassword);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		it('with empty second passphrase transaction should be ok', function (done) {
			transaction = node.lisk.signature.createSignature(accountEmptySecondPassword.password, accountEmptySecondPassword.secondPassword);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});

		it('with valid params should be ok', function (done) {
			transaction = node.lisk.signature.createSignature(account.password, account.secondPassword);

			sendTransaction(transaction, function (err, res) {
				node.expect(res).to.have.property('success').to.be.ok;
				node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			}, true);
		});
	});

	describe('transactions confirmation', function () {

		shared.confirmationPhase(goodTransactions, badTransactions);
	});

	describe('enforcement', function () {

		describe('type 0 - sending funds', function () {

			it('using no second passphrase should fail', function (done) {
				transaction = node.lisk.transaction.createTransaction(node.eAccount.address, 1, account.password);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Missing sender second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using invalid second passphrase should fail', function (done) {
				transaction = node.lisk.transaction.createTransaction(node.eAccount.address, 1, account.password, 'invalid password');

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Failed to verify second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using correct second passphrase should be ok', function (done) {
				transaction = node.lisk.transaction.createTransaction(node.eAccount.address, 1, account.password, account.secondPassword);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using correct empty second passphrase should be ok', function (done) {
				transaction = node.lisk.transaction.createTransaction(node.eAccount.address, 1, accountEmptySecondPassword.password, accountEmptySecondPassword.secondPassword);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});
		});

		describe('type 1 - second secret', function () {

			it('setting second signature twice on the same account should be not ok', function (done) {
				transaction = node.lisk.signature.createSignature(account.password, node.randomPassword());
				var secondKeys = node.lisk.crypto.getKeys(account.secondPassword);
				node.lisk.crypto.secondSign(transaction, secondKeys);
				transaction.id = node.lisk.crypto.getId(transaction);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.not.be.ok;
					node.expect(res).to.have.property('message').to.equal('Missing sender second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});
		});

		describe('type 2 - registering delegate', function () {

			it('using no second passphrase should fail', function (done) {
				transaction = node.lisk.delegate.createDelegate(account.password, account.username);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Missing sender second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using invalid second passphrase should fail', function (done) {
				transaction = node.lisk.delegate.createDelegate(account.password, account.username, 'invalid password');

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Failed to verify second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using correct second passphrase should be ok', function (done) {
				transaction = node.lisk.delegate.createDelegate(account.password, account.username, account.secondPassword);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using correct empty second passphrase should be ok', function (done) {
				transaction = node.lisk.delegate.createDelegate(accountEmptySecondPassword.password, accountEmptySecondPassword.username, accountEmptySecondPassword.secondPassword);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});
		});

		describe('type 3 - voting delegate', function () {

			it('using no second passphrase should fail', function (done) {
				transaction = node.lisk.vote.createVote(account.password, ['+' + node.eAccount.publicKey]);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Missing sender second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using invalid second passphrase should fail', function (done) {
				transaction = node.lisk.vote.createVote(account.password, ['+' + node.eAccount.publicKey], 'invalid password');

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Failed to verify second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using correct second passphrase should be ok', function (done) {
				transaction = node.lisk.vote.createVote(account.password, ['+' + node.eAccount.publicKey], account.secondPassword);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using correct empty second passphrase should be ok', function (done) {
				transaction = node.lisk.vote.createVote(accountEmptySecondPassword.password, ['+' + node.eAccount.publicKey], accountEmptySecondPassword.secondPassword);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});
		});

		describe('type 4 - registering multisignature account', function () {

			it('using no second passphrase should fail', function (done) {
				transaction = node.lisk.multisignature.createMultisignature(account.password, null, ['+' + node.eAccount.publicKey, '+' + accountNoFunds.publicKey, '+' + accountScarceFunds.publicKey], 1, 2);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Missing sender second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using invalid second passphrase should fail', function (done) {
				transaction = node.lisk.multisignature.createMultisignature(account.password, 'wrong second password', ['+' + node.eAccount.publicKey, '+' + accountNoFunds.publicKey, '+' + accountScarceFunds.publicKey], 1, 2);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').to.equal('Failed to verify second signature');
					badTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using correct second passphrase should be ok', function (done) {
				transaction = node.lisk.multisignature.createMultisignature(account.password, account.secondPassword, ['+' + node.eAccount.publicKey, '+' + accountNoFunds.publicKey, '+' + accountScarceFunds.publicKey], 1, 2);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});

			it('using correct empty second passphrase should be ok', function (done) {
				transaction = node.lisk.multisignature.createMultisignature(accountEmptySecondPassword.password, accountEmptySecondPassword.secondPassword, ['+' + node.eAccount.publicKey, '+' + accountNoFunds.publicKey, '+' + accountScarceFunds.publicKey], 1, 2);

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactionId').to.equal(transaction.id);
					goodTransactionsEnforcement.push(transaction);
					done();
				}, true);
			});
		});
	});

	describe('enforcement confirmation', function () {

		shared.confirmationPhase(goodTransactionsEnforcement, badTransactionsEnforcement);
	});
});
