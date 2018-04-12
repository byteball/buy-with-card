CREATE TABLE users (
	device_address CHAR(33) NOT NULL PRIMARY KEY,
	address CHAR(32) NOT NULL,
	cur_in VARCHAR(10) NULL, -- USD, EUR
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (device_address) REFERENCES correspondent_devices(device_address)
);

CREATE TABLE transactions (
	transaction_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	device_address CHAR(33) NULL,
	address CHAR(32) NOT NULL,
	cur_in VARCHAR(10) NOT NULL, -- USD, EUR
	amount_in DECIMAL(14,2) NOT NULL, -- in input currency
	amount_usd DECIMAL(14,2) NOT NULL,
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_update TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	status VARCHAR(15) CHECK (status IN('processing', 'failed', 'success')) NOT NULL DEFAULT 'processing',
	provider_transaction_id INT NULL UNIQUE,
	provider_status VARCHAR(20) NULL,
	reward_usd DECIMAL(14,2) NULL,
	reward INT NULL,
	reward_unit CHAR(44) NULL,
	reward_date TIMESTAMP NULL,
	FOREIGN KEY (device_address) REFERENCES correspondent_devices(device_address),
	FOREIGN KEY (reward_unit) REFERENCES units(unit)
);
CREATE INDEX transactionsByStatusReward ON transactions (status, reward_unit);
CREATE INDEX transactionsByAddress ON transactions (address);
CREATE INDEX transactionsByDeviceAddress ON transactions (device_address);
