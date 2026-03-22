-- Expand file_type to support Office MIME types (e.g. docx = 62 chars)
ALTER TABLE documents MODIFY COLUMN file_type VARCHAR(255) NOT NULL COMMENT 'e.g. application/pdf';
