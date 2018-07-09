/*jslint node: true */
'use strict';
const conf = require('byteballcore/conf');
const db = require('byteballcore/db');
const notifications = require('./notifications');
const conversion = require('./conversion');

exports.distributionAddress = null;

function determineRewardAmounts(address, device_address, amount_usd, handleRewards){
	db.query(
		"SELECT SUM(reward_usd) AS total_reward FROM transactions WHERE (address=? OR device_address=?) AND reward_usd IS NOT NULL",
		[address, device_address],
		rows => {
			let total_reward = rows[0].total_reward || 0;
			if (total_reward >= conf.maxTotalRewardUSD)
				return handleRewards(0, 0);
			let maxRemainingReward = conf.maxTotalRewardUSD - total_reward;
			let rewardInUsd = Math.round(amount_usd * conf.rewardPercentage/100 * 100) / 100;
			if (rewardInUsd > maxRemainingReward)
				rewardInUsd = maxRemainingReward;
			let rewardInBytes = conversion.usdToBytes(rewardInUsd);
			handleRewards(rewardInUsd, rewardInBytes);
		}
	);
}

function sendReward(address, reward, device_address, onDone) {
	let headlessWallet = require('headless-byteball');
	headlessWallet.sendMultiPayment({
		asset: null,
		amount: reward,
		to_address: address,
		paying_addresses: [exports.distributionAddress],
		change_address: exports.distributionAddress,
		recipient_device_address: device_address
	}, (err, unit) => {
		if (err) {
			console.error("failed to send reward: ", err);
			let balances = require('byteballcore/balances');
			balances.readBalance(exports.distributionAddress, (balance) => {
				console.error(balance);
				notifications.notifyAdmin('failed to send reward', err + ", balance: " + JSON.stringify(balance));
			});
		}
		else
			console.log("sent reward, unit " + unit);
		onDone(err, unit);
	});
}

function sendAndWriteReward(transaction_id) {
	const mutex = require('byteballcore/mutex.js');
	mutex.lockOrSkip(['tx-'+transaction_id], (unlock) => {
		db.query(
			`SELECT device_address, reward_date, reward, address FROM transactions WHERE transaction_id=?`,
			[transaction_id],
			(rows) => {
				if (rows.length === 0)
					throw Error(`no record for tx ${transaction_id}`);

				let row = rows[0];
				if (row.reward_date) // already sent
					return unlock();

				sendReward(row.address, row.reward, row.device_address, (err, unit) => {
					if (err)
						return unlock();

					db.query(
						`UPDATE transactions SET reward_unit=?, reward_date=${db.getNow()} WHERE transaction_id=?`,
						[unit, transaction_id],
						() => {
							let device = require('byteballcore/device.js');
							device.sendMessageToDevice(row.device_address, 'text', `Sent reward`);
							unlock();
						}
					);
				});
			}
		);
	});
}

function retrySendingRewards() {
	db.query(
		`SELECT transaction_id FROM transactions WHERE status='success' AND reward_unit IS NULL AND reward>0`,
		(rows) => {
			rows.forEach((row) => {
				sendAndWriteReward(row.transaction_id);
			});
		}
	);
}



exports.determineRewardAmounts = determineRewardAmounts;
exports.sendAndWriteReward = sendAndWriteReward;
exports.retrySendingRewards = retrySendingRewards;
