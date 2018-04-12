/*jslint node: true */
'use strict';
const desktopApp = require('byteballcore/desktop_app.js');
const conf = require('byteballcore/conf.js');


exports.greeting = () => {
	return "Here you can buy Bytes with Visa or Mastercard.  The service is provided by indacoin.com.  This bot helps you to make a purchase by getting your order details and personal data and redirecting you to indacoin.com where you enter your card details and finish the purchase.\n\nIndacoin charges "+conf.providerPercentage+"% commission but you receive additional "+conf.rewardPercentage+"% from Byteball distribution fund (up to the total lifetime reward of $"+conf.maxTotalRewardUSD+") which offsets part of the commission you pay, so the net commission for your first purchases is "+(conf.providerPercentage-conf.rewardPercentage)+"%.";
};

exports.whatCurrency = () => {
	return 'What currency are you going to pay in?\n[USD](command:USD)\t[EUR](command:EUR)';
};

exports.howMany = (currency) => {
	return 'What amount are you going to pay (in '+currency+')?';
};

exports.insertAddress = () => {
	return conf.bRequireRealName
		? 'To buy Bytes with Visa or Mastercard, your real name has to be attested and we require to provide your private profile, which includes your first name, last name, country, date of birth, and document number.  If you are not attested yet, find "Real name attestation bot" in the Bot Store and have your address attested.  If you are already attested, click this link to reveal your private profile to us: [profile request](profile-request:'+conf.arrRequiredPersonalData.join(',')+').  We\'ll keep your personal data private and only send it to indacoin.com, which is the payment processor.'
		: 'Please send me your address where you wish to receive the Bytes (click ... and Insert my address).';
};


//errors
exports.errorInitSql = () => {
	return 'please import db.sql file\n';
};

exports.errorSmtp = () => {
	return `please specify smtpUser, smtpPassword and smtpHost in your ${desktopApp.getAppDataDir()}/conf.json\n`;
};

exports.errorEmail = () => {
	return `please specify admin_email and from_email in your ${desktopApp.getAppDataDir()}/conf.json\n`;
};
