/*jslint node: true */
'use strict';
const async = require('async');
const request = require('request');
const conf = require('ocore/conf');
const eventBus = require('ocore/event_bus.js');
const notifications = require('./notifications');


var GBYTE_BTC_rate;
var BTC_USD_rate;
var EUR_USD_rate = 1.18;
var GBP_USD_rate;
var USD_JPY_rate;
var USD_RUR_rate;

var bRatesReady = false;

function checkAllRatesUpdated() {
	if (bRatesReady)
		return;
	if (GBYTE_BTC_rate && BTC_USD_rate && EUR_USD_rate) {
		bRatesReady = true;
		console.log('rates are ready');
		const headlessWallet = require('headless-obyte'); // start loading headless only when rates are ready
		checkRatesAndHeadless();
	}
}

var bHeadlessReady = false;
eventBus.once('headless_wallet_ready', () => {
	bHeadlessReady = true;
	checkRatesAndHeadless();
});

function checkRatesAndHeadless() {
	if (bRatesReady && bHeadlessReady)
		eventBus.emit('headless_and_rates_ready');
}


function updateBittrexRates() {
	console.log('updating bittrex');
	const apiUri = 'https://bittrex.com/api/v1.1/public/getmarketsummaries';
	request(apiUri, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			let arrCoinInfos = JSON.parse(body).result;
			arrCoinInfos.forEach(coinInfo => {
				let price = coinInfo.Last; // number
				if (!price)
					return;
				if (coinInfo.MarketName === 'USDT-BTC')
					BTC_USD_rate = price;
				else if (coinInfo.MarketName === 'BTC-GBYTE')
					GBYTE_BTC_rate = price;
			});
			checkAllRatesUpdated();
		}
		else {
			notifications.notifyAdmin("getting bittrex data failed", error + ", status=" + (response ? response.statusCode : '?'));
			console.log("Can't get currency rates from bittrex, will retry later");
		}
	});
}



function usdToBytes(amountInUSD) {
	if (!bRatesReady)
		throw Error("rates not ready yet");
	return Math.round(1e9 * amountInUSD / (GBYTE_BTC_rate * BTC_USD_rate));
}

function eurToUsd(amountInEUR){
	return Math.round(amountInEUR * EUR_USD_rate * 100)/100;
}

function getUsdAmount(amount, currency){
	switch (currency){
		case 'USD': return amount;
		case 'EUR': return eurToUsd(amount);
		default: throw Error("unknown currency: "+currency);
	}
}


function enableRateUpdates() {
	setInterval(updateBittrexRates, 600 * 1000);
}

updateBittrexRates();
enableRateUpdates();

exports.usdToBytes = usdToBytes;
exports.getUsdAmount = getUsdAmount;

