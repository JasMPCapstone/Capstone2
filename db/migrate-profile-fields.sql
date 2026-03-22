-- Profile fields for users. Run once if you already have the database.
-- (If a column already exists, that line will error; you can skip or run the rest.)

ALTER TABLE users ADD COLUMN preferred_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN given_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN last_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN address_state VARCHAR(100) DEFAULT NULL;
ALTER TABLE users ADD COLUMN address_city VARCHAR(100) DEFAULT NULL;
ALTER TABLE users ADD COLUMN address_suburb VARCHAR(100) DEFAULT NULL;
ALTER TABLE users ADD COLUMN emergency_contact_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN emergency_contact_phone VARCHAR(50) DEFAULT NULL;
ALTER TABLE users ADD COLUMN company VARCHAR(255) DEFAULT NULL;
