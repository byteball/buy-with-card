/*jslint node: true */
'use strict';
const crypto = require('crypto');
const request = require('request');
const conf = require('byteballcore/conf.js');
const notifications = require('./notifications.js');


function getLimits(address, cur_in, handleResult){
	sendRequest('/api/exgw_getUserlimits', {user_id: address, cur_in: cur_in}, (err, body) => {
		if (err)
			return handleResult(err);
		console.error('limits', body);
		if (typeof body !== 'number')
			return handleResult(body);
		handleResult(null, body);
	});
}

function createTransaction(transaction_id, address, cur_in, amount_in, extra_info, handleResult){
	let params = {
		transaction_id: transaction_id,
		user_id: address,
		cur_in: cur_in,
		cur_out: 'GBYTE',
		target_address: address,
		amount_in: amount_in,
		extra_info: extra_info
	};
	sendRequest('/api/exgw_createTransaction', params, (err, body) => {
		if (err)
			return handleResult(err);
		console.error('exgw_createTransaction', typeof body, body);
		if (typeof body !== 'number')
			return handleResult(body);
		handleResult(null, body);
	});
}

function getTransactionInfo(indacoin_transaction_id, handleResult){
	sendRequest('/api/exgw_gettransactioninfo', {transaction_id: indacoin_transaction_id}, (err, body) => {
		if (err)
			return handleResult(err);
		console.error('tx info', body);
		if (typeof body === 'string') // normally, it is an object
			return handleResult(body);
		handleResult(null, body);
	});
}

function getStatusFromProviderStatus(provider_status, provider_extra_status){
	if (provider_status === 'Paid' && provider_extra_status === 'RejectedManual')
		return 'failed';
	switch (provider_status){
		case 'Draft':
		case 'Paid':
		case 'Verification':
			return 'processing';
		case 'FundsSent':
		case 'Finished':
			return 'success';
		case 'Chargeback':
		case 'Declined':
		case 'Cancelled':
		case 'Failed':
			return 'failed';
		default:
			throw Error("unknown provider status: "+provider_status);
	}
}

function sendRequest(path, json, handleResult) {
	let nonce = Date.now();
	let options = {
		method: 'POST',
		url: `${conf.BASE_URL}${path}`,
		json: json,
		headers: {
			"Content-Type": "application/json",
			"gw-partner": conf.indacoinPartner,
			"gw-nonce": nonce,
			"gw-sign": getSignature(nonce)
		}
	};
	request(options, (err, response, body) => {
		if (err){
			console.error('error from '+path, json, err);
			return handleResult(err);
		}
		if (response.statusCode !== 200){
			console.error(response.statusCode+' status code from '+path, json);
			return handleResult("non-200 status code: "+response.statusCode);
		}
		handleResult(null, body);
	});
}

function getSignature(nonce){
	let string = conf.indacoinPartner+"_"+nonce;
	return crypto.createHmac('sha256', conf.indacoinSecret).update(string).digest('base64');
}

function getCnfHash(transaction_id){
	let sig = getSignature(transaction_id);
	return Buffer.from(sig).toString('base64');
}



exports.getStatusFromProviderStatus = getStatusFromProviderStatus;
exports.getCnfHash = getCnfHash;
exports.getLimits = getLimits;
exports.createTransaction = createTransaction;
exports.getTransactionInfo = getTransactionInfo;


