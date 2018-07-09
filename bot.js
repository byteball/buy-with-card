/*jslint node: true */
'use strict';
const _ = require('lodash');
const constants = require('byteballcore/constants.js');
const conf = require('byteballcore/conf');
const db = require('byteballcore/db');
const mutex = require('byteballcore/mutex');
const eventBus = require('byteballcore/event_bus');
const texts = require('./modules//texts');
const validationUtils = require('byteballcore/validation_utils');
const privateProfile = require('byteballcore/private_profile.js');
const notifications = require('./modules/notifications');
const conversion = require('./modules/conversion.js');
const indacoin = require('./modules/indacoin.js');
const reward = require('./modules/reward.js');


function queryTransactionStatus(transaction_id){
	mutex.lockOrSkip(['tx-'+transaction_id], unlock => {
		db.query(
			"SELECT status, provider_status, provider_transaction_id, device_address, address, amount_usd, \n\
				(SELECT src_profile FROM private_profiles WHERE private_profiles.address=transactions.address LIMIT 1) AS src_profile \n\
			FROM transactions WHERE transaction_id=?", 
			[transaction_id],
			rows => {
				let row = rows[0];
				if (row.status !== 'processing')
					return unlock();
				indacoin.getTransactionInfo(row.provider_transaction_id, (err, txInfo) => {
					if (err)
						return unlock();
				//	console.error('tx', transaction_id, txInfo);
					if (txInfo.status === row.provider_status && txInfo.extraStatus !== 'RejectedManual'){ // unchanged
						console.log('tx '+transaction_id+': status unchanged: '+txInfo.status);
						return unlock();
					}
					let status = indacoin.getStatusFromProviderStatus(txInfo.status, txInfo.extraStatus);
					db.query(
						"UPDATE transactions SET provider_status=?, status=?, last_update="+db.getNow()+" WHERE transaction_id=?", 
						[txInfo.status, status, transaction_id],
						() => {
							if (status === 'processing')
								return unlock();
							let device = require('byteballcore/device.js');
							device.sendMessageToDevice(row.device_address, 'text', 
								(status === 'success') ? "Your payment was successful" : "Your payment has failed");
							if (status === 'failed')
								return unlock();
							if (!conf.rewardPercentage)
								return unlock();
							if (!row.src_profile){
								console.log('tx '+transaction_id+': no private profile found, not paying rewards');
								return unlock();
							}
							reward.determineRewardAmounts(row.address, row.device_address, row.amount_usd, (rewardInUsd, rewardInBytes) => {
								if (!rewardInBytes) // max reward already paid out
									return unlock();
								db.query(
									"UPDATE transactions SET reward_usd=?, reward=?, last_update="+db.getNow()+" WHERE transaction_id=?",
									[rewardInUsd, rewardInBytes, transaction_id],
									() => {
										unlock();
										device.sendMessageToDevice(row.device_address, 'text', "Thank you for buying Bytes with a card.  To offset a part of the fees you paid, you will receive a reward of $"+rewardInUsd.toLocaleString([], {maximumFractionDigits:2, minimumFractionDigits:2})+" in Bytes.");
										reward.sendAndWriteReward(transaction_id);
									}
								);
							});
						}
					);
				});
			}
		);
	});
}

function pollTransactions(bOld){
	let comparison = bOld ? '<=' : '>';
	db.query(
		"SELECT transaction_id FROM transactions \n\
		WHERE status='processing' AND provider_transaction_id IS NOT NULL AND last_update "+comparison+" "+db.addTime('-6 HOUR'), 
		rows => {
			rows.forEach(row => queryTransactionStatus(row.transaction_id));
		}
	);
}

function sendGreetingAndAskNext(from_address, userInfo){
	let device = require('byteballcore/device.js');
	let text = texts.greeting();
	if (userInfo)
		text += "\n\n" + (userInfo.cur_in ? texts.howMany(userInfo.cur_in) : texts.whatCurrency());
	else
		text += "\n\n" + texts.insertAddress();
	device.sendMessageToDevice(from_address, 'text', text);
}

eventBus.on('paired', from_address => {
	readUserInfo(from_address, userInfo => {
		sendGreetingAndAskNext(from_address, userInfo);
	});
});

eventBus.once('headless_and_rates_ready', () => {
	const headlessWallet = require('headless-byteball');
	headlessWallet.setupChatEventHandlers();
	setInterval(pollTransactions, 30*1000);
	setInterval(() => pollTransactions(true), 30*60*1000);
	
	eventBus.on('text', (from_address, text) => {
		let device = require('byteballcore/device');
		text = text.trim();
		let ucText = text.toUpperCase();
		let lcText = text.toLowerCase();

		let arrProfileMatches = text.match(/\(profile:(.+?)\)/);
		
		readUserInfo(from_address, userInfo => {
			if (!userInfo && !validationUtils.isValidAddress(ucText) && !arrProfileMatches)
				return device.sendMessageToDevice(from_address, 'text', texts.insertAddress());
			
			function handleUserAddress(address, bWithData){
				db.query(
					'INSERT OR REPLACE INTO users (device_address, address) VALUES(?,?)', 
					[from_address, address], 
					() => {
						device.sendMessageToDevice(from_address, 'text', 'Saved your Byteball address'+(bWithData ? ' and personal data' : '')+'.\n\n' + texts.whatCurrency());
					}
				);
			}
			
			if (validationUtils.isValidAddress(ucText)) {
			//	if (conf.bRequireRealName)
			//		return device.sendMessageToDevice(from_address, 'text', "You have to provide your attested profile, just Byteball address is not enough.");
				return handleUserAddress(ucText);
			}
			else if (arrProfileMatches){
				let privateProfileJsonBase64 = arrProfileMatches[1];
				if (!conf.bRequireRealName)
					return device.sendMessageToDevice(from_address, 'text', "Private profile is not required");
				let objPrivateProfile = privateProfile.getPrivateProfileFromJsonBase64(privateProfileJsonBase64);
				if (!objPrivateProfile)
					return device.sendMessageToDevice(from_address, 'text', "Invalid private profile");
				privateProfile.parseAndValidatePrivateProfile(objPrivateProfile, function(err, address, attestor_address){
					if (err)
						return device.sendMessageToDevice(from_address, 'text', "Failed to parse the private profile: "+err);
					if (conf.arrRealNameAttestors.indexOf(attestor_address) === -1)
						return device.sendMessageToDevice(from_address, 'text', "We don't recognize the attestor "+attestor_address+" who attested your profile.  The only trusted attestors are: "+conf.arrRealNameAttestors.join(', '));
					let assocPrivateData = privateProfile.parseSrcProfile(objPrivateProfile.src_profile);
					let arrMissingFields = _.difference(conf.arrRequiredPersonalData, Object.keys(assocPrivateData));
					if (arrMissingFields.length > 0)
						return device.sendMessageToDevice(from_address, 'text', "These fields are missing in your profile: "+arrMissingFields.join(', '));
					privateProfile.savePrivateProfile(objPrivateProfile, address, attestor_address);
					handleUserAddress(address, true);
				});
				return;
			}
			
			if (ucText === 'USD' || ucText === 'EUR'){
				let cur_in = ucText;
				db.query("UPDATE users SET cur_in=? WHERE device_address=?", [cur_in, from_address], () => {
					let response = texts.howMany(cur_in);
					indacoin.getLimits(from_address, cur_in, (err, body) => {
						let maxAmount = body;
						if (maxAmount)
							response += "\nBetween "+conf.minAmounts[cur_in]+" and "+maxAmount+" "+cur_in+".";
						device.sendMessageToDevice(from_address, 'text', response);
					});
				});
				return;
			}
			
			if (!userInfo.cur_in)
				return device.sendMessageToDevice(from_address, 'text', texts.whatCurrency());
			
			if (/^[0-9.]+$/.test(ucText)) {
				let amount = parseFloat(ucText);
				if (amount < conf.minAmounts[userInfo.cur_in] || isNaN(amount))
					return device.sendMessageToDevice(from_address, 'text', 'Minimum amount is '+conf.minAmounts[userInfo.cur_in]+' '+userInfo.cur_in);
				indacoin.getLimits(from_address, userInfo.cur_in, (err, body) => {
					let maxAmount = body;
					if (maxAmount && amount > maxAmount)
						return device.sendMessageToDevice(from_address, 'text', 'Maximum amount is '+maxAmount+' '+userInfo.cur_in);
					db.query(
						"INSERT INTO transactions (device_address, address, cur_in, amount_in, amount_usd) VALUES(?,?, ?,?,?)", 
						[from_address, userInfo.address, userInfo.cur_in, amount, conversion.getUsdAmount(amount, userInfo.cur_in)],
						(res) => {
							let transaction_id = res.insertId;
							let extra_info = userInfo.src_profile ? privateProfile.parseSrcProfile(userInfo.src_profile) : undefined;
							indacoin.createTransaction(transaction_id, userInfo.address, userInfo.cur_in, amount, extra_info, (err, body) => {
								if (err)
									return device.sendMessageToDevice(from_address, 'text', "Failed to create a transaction");
								let indacoin_transaction_id = body;
								db.query(
									"UPDATE transactions SET provider_transaction_id=?, last_update="+db.getNow()+" WHERE transaction_id=?", 
									[indacoin_transaction_id, transaction_id]
								);
								device.sendMessageToDevice(from_address, 'text', "Your order is created.  Please click this link to enter your card details and complete the payment: " + conf.BASE_URL + "/gw/payment_form?transaction_id=" + indacoin_transaction_id + "&partner=" + conf.indacoinPartner + "&cnfhash=" + encodeURIComponent(indacoin.getCnfHash(indacoin_transaction_id)) + "\n\nBe prepared that it takes some time after you enter your card details and before Indacoin sends your Bytes to you.");
							});
						}
					);
				});
				return;
			}
			else
				sendGreetingAndAskNext(from_address, userInfo);
		});
	});
});



function readUserInfo(device_address, cb) {
	db.query(
		"SELECT address, cur_in, (SELECT src_profile FROM private_profiles WHERE private_profiles.address=users.address LIMIT 1) AS src_profile \n\
		FROM users WHERE device_address = ?",
		[device_address],
		rows => {
			if (rows.length === 0)
				return cb();
			let userInfo = rows[0];
			if (userInfo.src_profile)
				userInfo.src_profile = JSON.parse(userInfo.src_profile);
			cb(userInfo);
		}
	);
}






eventBus.once('headless_wallet_ready', () => {
	let error = '';
	let arrTableNames = ['users', 'transactions'];
	db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN (?)", [arrTableNames], (rows) => {
		if (rows.length !== arrTableNames.length)
			error += texts.errorInitSql();

		if (conf.useSmtp && (!conf.smtpUser || !conf.smtpPassword || !conf.smtpHost))
			error += texts.errorSmtp();

		if (!conf.admin_email || !conf.from_email)
			error += texts.errorEmail();
		
		if (!conf.indacoinPartner || !conf.indacoinSecret)
			error += "please specify indacoinPartner and indacoinSecret in conf.json";

		if (error)
			throw new Error(error);
		
		const headlessWallet = require('headless-byteball');
		headlessWallet.readSingleAddress((distributionAddress) => {
			console.log('== distribution address: ' + distributionAddress);
			reward.distributionAddress = distributionAddress;

			setInterval(reward.retrySendingRewards, 60*1000);
		});
	});
});

process.on('unhandledRejection', up => { throw up; });

