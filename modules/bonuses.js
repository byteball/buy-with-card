/*jslint node: true */
'use strict';
const conf = require('ocore/conf');
const db = require('ocore/db');


function getBonus(user_address){
	return new Promise(async (resolve) => {
		if (!conf.bonuses)
			return resolve({bonus: 0});
		var arrAttestorAddresses = Object.keys(conf.bonuses);
		if (arrAttestorAddresses.length === 0)
			return resolve({bonus: 0});
		if (conf.bLight){
			const light_attestations = require('./light_attestations.js');
			await light_attestations.updateAttestationsInLight(user_address);
		}
		let assocFieldsByAttestor = {};
		for (let attestor_address in conf.bonuses){
			let objLevel = conf.bonuses[attestor_address].bonus_levels[0];
			for (let key in objLevel){
				if (key !== 'bonus')
					assocFieldsByAttestor[attestor_address] = key;
			}
		}
		db.query(
			`SELECT attestor_address, payload 
			FROM attestations CROSS JOIN unit_authors USING(unit) CROSS JOIN messages USING(unit, message_index) 
			WHERE attestations.address=? AND unit_authors.address IN(?)`, 
			[user_address, arrAttestorAddresses],
			rows => {
				if (rows.length === 0)
					return resolve({bonus: 0});
				let bonus = 0;
				let domain, field, threshold_value;
				rows.forEach(row => {
					let payload = JSON.parse(row.payload);
					if (payload.address !== user_address)
						throw Error("wrong payload address "+payload.address+", expected "+user_address);
					let profile = payload.profile;
					let attested_field = assocFieldsByAttestor[row.attestor_address];
					if (!(attested_field in profile)) // likely private attestation
						return;
					let value = profile[attested_field];
					let arrBonusLevels = conf.bonuses[row.attestor_address].bonus_levels;
					arrBonusLevels.forEach(objLevel => {
						if (!(attested_field in objLevel))
							throw Error("bad bonus setting "+JSON.stringify(objLevel));
						let min_value = objLevel[attested_field];
						if (value >= min_value && objLevel.bonus > bonus){
							bonus = objLevel.bonus;
							domain = conf.bonuses[row.attestor_address].domain;
							threshold_value = min_value;
							field = attested_field;
						}
					});
				});
				resolve({bonus, domain, threshold_value, field});
			}
		);
	});
}

exports.getBonus = getBonus;

