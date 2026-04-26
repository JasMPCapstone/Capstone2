-- Optional manual migration: personal phone on users
ALTER TABLE users ADD COLUMN phone VARCHAR(50) DEFAULT NULL;
