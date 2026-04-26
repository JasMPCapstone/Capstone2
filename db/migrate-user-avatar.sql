-- Optional: profile photos (files live in uploads/avatars/)
ALTER TABLE users ADD COLUMN avatar_filename VARCHAR(255) DEFAULT NULL;
