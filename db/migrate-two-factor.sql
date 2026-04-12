-- Add 2FA columns for TOTP (authenticator app)
ALTER TABLE users
  ADD COLUMN two_factor_secret VARCHAR(255) DEFAULT NULL,
  ADD COLUMN two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0;
