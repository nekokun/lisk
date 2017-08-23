'use strict';

var node = require('../../../node');

var getTransaction = require('../../../common/complexTransactions').getTransaction;
var getUnconfirmedTransaction = require('../../../common/complexTransactions').getUnconfirmedTransaction;

var getTransactionPromise = node.Promise.promisify(getTransaction);
var getUnconfirmedTransactionPromise = node.Promise.promisify(getUnconfirmedTransaction);

var sendTransaction = require('../../../common/complexTransactions').sendTransaction;

var getPendingMultisignatures = require('../../../common/complexTransactions').getPendingMultisignatures;
var getPendingMultisignaturesPromosify = node.Promise.promisify(getPendingMultisignatures);

var sentences = {
	emptyTx : 			'Invalid transaction body - Empty trs passed',
	unknownTx : 		'Invalid transaction body - Unknown transaction type ',
	failedId : 			'Failed to get transaction id',
	invalidId:			'Invalid transaction id'
};

var tests = [
	{describe: 'null',							args: null},
	{describe: 'undefined',					args: undefined},
	{describe: 'NaN',								args: NaN},
	{describe: 'Infinity',					args: Infinity},
	{describe: '0 integer',					args: 0},
	{describe: 'negative integer',	args: -1},
	{describe: 'float',							args: 1.2},
	{describe: 'negative float',		args: -1.2},
	{describe: 'empty string',			args: ''},
	{describe: '0 as string',				args: '0'},
	{describe: 'regular string',		args: String('abc')},
	{describe: 'uppercase string',	args: String('ABC')},
	{describe: 'invalid chars',			args: String('/')},
	{describe: 'date',							args: new Date()},
	{describe: 'true boolean',			args: true},
	{describe: 'false boolean',			args: false},
	{describe: 'empty array',				args: []},
	{describe: 'empty object',			args: {}}
];

function confirmationPhase (goodTransactions, badTransactions, pendingMultisignatures) {

	describe('before new block', function () {

		it('good transactions should remain unconfirmed', function () {
			return node.Promise.map(goodTransactions, function (tx) {
				return getTransactionPromise(tx.id).then(function (res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('error').equal('Transaction not found');
				});
			});
		});

		it('pendingMultisignatures should remain in the pending queue', function () {
			return node.Promise.map(pendingMultisignatures, function (tx) {
				return getPendingMultisignaturesPromosify(tx).then(function (res) {
					console.log(res);
					node.expect(res).to.have.property('success').to.be.ok;
					node.expect(res).to.have.property('transactions').equal('Transaction not found');
				});
			});
		});

		it('pendingMultisignatures should not be confirmed', function () {
			return node.Promise.map(goodTransactions, function (tx) {
				return getPendingMultisignaturesPromosify(tx).then(function (res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('error').equal('Transaction not found');
				});
			});
		});
	});

	// describe('after new block', function () {
	//
	// 	before(function (done) {
	// 		node.onNewBlock(done);
	// 	});
	//
	// 	it('bad transactions should not be confirmed', function () {
	// 		return node.Promise.map(badTransactions, function (tx) {
	// 			return getTransactionPromise(tx.id).then(function (res) {
	// 				node.expect(res).to.have.property('success').to.be.not.ok;
	// 				node.expect(res).to.have.property('error').equal('Transaction not found');
	// 			});
	// 		});
	// 	});
	//
	// 	it('good transactions should not be unconfirmed', function () {
	// 		return node.Promise.map(goodTransactions, function (tx) {
	// 			return getUnconfirmedTransactionPromise(tx.id).then(function (res) {
	// 				node.expect(res).to.have.property('success').to.be.not.ok;
	// 				node.expect(res).to.have.property('error').equal('Transaction not found');
	// 			});
	// 		});
	// 	});
	//
	// 	it('good transactions should be confirmed', function () {
	// 		return node.Promise.map(goodTransactions, function (tx) {
	// 			return getTransactionPromise(tx.id).then(function (res) {
	// 				node.expect(res).to.have.property('success').to.be.ok;
	// 				node.expect(res).to.have.property('transaction').to.have.property('id').equal(tx.id);
	// 			});
	// 		});
	// 	});
	//
	// 	it('pendingMultisignatures transactions should be unconfirmed', function () {
	// 		return node.Promise.map(toSignTransactions, function (tx) {
	// 			return getUnconfirmedTransactionPromise(tx.id).then(function (res) {
	// 				node.expect(res).to.have.property('success').to.be.ok;
	// 				node.expect(res).to.have.property('transaction').to.have.property('id').equal(tx.id);
	// 			});
	// 		});
	// 	});
	// });
};

function invalidTxs () {

	tests.forEach(function (test) {
		it('using ' + test.describe + ' should fail', function (done) {
			sendTransaction(test.args, function (err, res) {
				node.expect(res).to.have.property('success').to.not.be.ok;
				node.expect(res).to.have.property('message').that.is.not.empty;
				done();
			}, true);
		});
	});
};

function invalidAssets (account, option, badTransactions) {

	var transaction;

	beforeEach(function () {
		switch(option) {
			case 'signature':
				transaction = node.lisk.signature.createSignature(account.password, node.randomPassword());
				break;
			case 'delegate':
				transaction = node.lisk.delegate.createDelegate(account.password, node.randomDelegateName());
				break;
			case 'votes':
				transaction = node.lisk.vote.createVote(account.password, []);
				break;
			case 'multisignature':
				transaction = node.lisk.multisignature.createMultisignature(account.password, null, ['+' + node.eAccount.publicKey], 1, 2);
				break;
		}
	});

	describe('using invalid asset values', function () {

		tests.forEach(function (test) {
			it('using ' + test.describe + ' should fail', function (done) {
				transaction.asset = test.args;

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').that.is.not.empty;
					badTransactions.push(transaction);
					done();
				}, true);
			});
		});
	});

	describe('using invalid asset.' + option + ' values', function () {

		tests.forEach(function (test) {
			it('using ' + test.describe + ' should fail', function (done) {
				transaction.asset[option] = test.args;

				sendTransaction(transaction, function (err, res) {
					node.expect(res).to.have.property('success').to.be.not.ok;
					node.expect(res).to.have.property('message').that.is.not.empty;
					badTransactions.push(transaction);
					done();
				}, true);
			});
		});
	});
}

module.exports = {
	sentences: sentences,
	tests: tests,
	confirmationPhase: confirmationPhase,
	invalidTxs: invalidTxs,
	invalidAssets: invalidAssets
};
