-- Run this if you already have the database and need the document_type column.
-- New installs get it from schema.sql.
ALTER TABLE documents ADD COLUMN document_type VARCHAR(100) DEFAULT NULL COMMENT 'e.g. Facility Accreditation Certificate';
