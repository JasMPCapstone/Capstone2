-- Optional manual migration: document approval for system admin review
-- (Also applied automatically via lib/migrate-document-approval.js on startup.)

ALTER TABLE documents
  ADD COLUMN approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING APPROVED REJECTED — system admin review';

UPDATE documents SET approval_status = 'APPROVED' WHERE deleted_at IS NULL;
