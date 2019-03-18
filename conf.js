/*jslint node: true */
"use strict";
exports.port = null;
//exports.myUrl = 'wss://mydomain.com/bb';
exports.bServeAsHub = false;
exports.bLight = true;

exports.storage = 'sqlite';

// TOR is recommended.  If you don't run TOR, please comment the next two lines
exports.socksHost = '127.0.0.1';
exports.socksPort = 9050;

exports.hub = 'obyte.org/bb';
exports.deviceName = 'Buy Bytes with Visa or Mastercard';
exports.permanent_pairing_secret = '0000';
exports.control_addresses = [''];
exports.payout_address = 'WHERE THE MONEY CAN BE SENT TO';

exports.bIgnoreUnpairRequests = true;
exports.bSingleAddress = true;
exports.KEYS_FILENAME = 'keys.json';

//email
exports.useSmtp = false;
exports.admin_email = '';
exports.from_email = '';

exports.bRequireRealName = true;
exports.arrRealNameAttestors = ['I2ADHGP4HL6J37NQAD73J7E5SKFIXJOT'];
exports.arrRequiredPersonalData = ['first_name', 'last_name', 'country', 'dob', 'id_number', 'id_type'];

exports.minAmounts = {
	USD: 50,
	EUR: 50
};

exports.providerPercentage = 9;

exports.rewardPercentage = 6;
exports.maxTotalRewardUSD = 100;

exports.bonuses = {
	JEDZYC2HMGDBIDQKG3XSTXUSHMCBK725: {
		domain: 'Steem',
		bonus_levels: [
			{reputation: 50, bonus: 3},
		]
	},
};

exports.BASE_URL = 'https://indacoin.com';

// override in conf.json
exports.indacoinPartner = '';
exports.indacoinSecret = '';
