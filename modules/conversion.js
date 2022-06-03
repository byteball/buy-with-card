/*jslint node: true */
'use strict';
const eventBus = require('ocore/event_bus.js');
const network = require('ocore/network.js');


var EUR_USD_rate = 1.07;
var GBP_USD_rate;
var USD_JPY_rate;
var USD_RUR_rate;

var bRatesReady = false;
eventBus.once('rates_updated', () => {
	bRatesReady = true;
	checkRatesAndHeadless();
});


var bHeadlessReady = false;
eventBus.once('headless_wallet_ready', () => {
	bHeadlessReady = true;
	checkRatesAndHeadless();
});

function checkRatesAndHeadless() {
	if (bRatesReady && bHeadlessReady)
		eventBus.emit('headless_and_rates_ready');
}



function usdToBytes(amountInUSD) {
	const rates = network.exchangeRates;
	if (!rates.GBYTE_USD)
		throw Error("rates not ready yet");
	return Math.round(1e9 * amountInUSD / rates.GBYTE_USD);
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



exports.usdToBytes = usdToBytes;
exports.getUsdAmount = getUsdAmount;

