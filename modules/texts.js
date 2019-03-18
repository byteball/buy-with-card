/*jslint node: true */
'use strict';
const desktopApp = require('ocore/desktop_app.js');
const conf = require('ocore/conf.js');


exports.greeting = () => {
	let objBonusLevel = conf.bonuses.JEDZYC2HMGDBIDQKG3XSTXUSHMCBK725.bonus_levels[0];
	return "Here you can buy Bytes with Visa or Mastercard.  The service is provided by indacoin.com.  This bot helps you to make a purchase by getting your order details and optionally personal data and redirecting you to indacoin.com where you enter your card details and finish the purchase.\n\nIndacoin charges "+conf.providerPercentage+"% commission but if your real name is attested (see \"Real name attestation bot\" in the Bot Store), you receive additional "+conf.rewardPercentage+"% from Obyte distribution fund (up to the total lifetime reward of $"+conf.maxTotalRewardUSD+") which offsets part of the commission you pay, so the net commission for your first purchases is "+(conf.providerPercentage-conf.rewardPercentage)+"%.  If you are attested as a Steem user with reputation over "+objBonusLevel.reputation+", you are eligible for an additional "+objBonusLevel.bonus+"% reward.";
};

exports.whatCurrency = () => {
	return 'What currency are you going to pay in?\n[USD](command:USD)\t[EUR](command:EUR)';
};

exports.howMany = (currency) => {
	return 'What amount are you going to pay (in '+currency+')?';
};

exports.insertAddress = () => {
	return conf.bRequireRealName
		? 'To buy Bytes with Visa or Mastercard, it is recommended to have your real name attested and your private profile disclosed to us.  The private profile includes your first name, last name, country, date of birth, and document number.  If you are not attested yet, find "Real name attestation bot" in the Bot Store and have your address attested.  If you are already attested, click this link to reveal your private profile to us: [profile request](profile-request:'+conf.arrRequiredPersonalData.join(',')+').  We\'ll keep your personal data private and only send it to indacoin.com, which is the payment processor.\n\nIf you don\'t want or can\'t have your real name attested, you can still buy Bytes with your card but you are not eligible for partial reimbursement of the fees and Indacoin will perform additional verification.  To select this option, send me your address where you wish to receive the Bytes (click ... and Insert my address).'
		: 'Please send me your address where you wish to receive the Bytes (click ... and Insert my address).';
};

exports.bonus = (objBonus) => {
	return "As a "+objBonus.domain+" user with "+objBonus.field+" over "+objBonus.threshold_value+" you are eligible to an additional bonus of "+objBonus.bonus+"% after successful payment (up to the total reward of $"+conf.maxTotalRewardUSD+").";
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
