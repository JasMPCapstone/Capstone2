ALTER TABLE documents
  ADD COLUMN approval_rejection_reason TEXT DEFAULT NULL COMMENT 'System admin rejection note';
