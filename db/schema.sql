-- MedSupply Portal - MySQL Schema
-- Run this after creating the database (see README).

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table: users
-- ----------------------------
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `notification_document_reads`;
DROP TABLE IF EXISTS `documents`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `companies`;

CREATE TABLE `companies` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `given_name` VARCHAR(255) DEFAULT NULL,
  `last_name` VARCHAR(255) DEFAULT NULL,
  `preferred_name` VARCHAR(255) DEFAULT NULL,
  `state` VARCHAR(100) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `suburb` VARCHAR(100) DEFAULT NULL,
  `emergency_contact_name` VARCHAR(255) DEFAULT NULL,
  `emergency_contact_phone` VARCHAR(50) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `avatar_filename` VARCHAR(255) DEFAULT NULL COMMENT 'Stored under uploads/avatars/',
  `company` VARCHAR(255) DEFAULT NULL,
  `company_id` INT UNSIGNED DEFAULT NULL,
  `password_must_change` TINYINT(1) NOT NULL DEFAULT 0,
  `profile_completed` TINYINT(1) NOT NULL DEFAULT 0,
  `two_factor_secret` VARCHAR(255) DEFAULT NULL,
  `two_factor_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `role` VARCHAR(32) NOT NULL DEFAULT 'CLIENT',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_role` (`role`),
  KEY `users_is_active` (`is_active`),
  KEY `users_company_id` (`company_id`),
  CONSTRAINT `users_company_fk` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table: documents (metadata only; files on disk)
-- ----------------------------
CREATE TABLE `documents` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `filename` VARCHAR(255) NOT NULL COMMENT 'Stored filename on disk (unique)',
  `original_filename` VARCHAR(255) NOT NULL,
  `file_type` VARCHAR(50) NOT NULL COMMENT 'e.g. application/pdf',
  `file_extension` VARCHAR(10) NOT NULL COMMENT 'pdf, docx, xlsx',
  `file_size` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL DEFAULT '',
  `description` TEXT,
  `document_type` VARCHAR(100) DEFAULT NULL COMMENT 'e.g. Facility Accreditation Certificate',
  `tags` VARCHAR(500) DEFAULT NULL COMMENT 'Comma-separated optional tags',
  `approval_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING APPROVED REJECTED — system admin review',
  `approval_rejection_reason` TEXT DEFAULT NULL COMMENT 'Required context when system admin rejects',
  `deleted_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `documents_filename_unique` (`filename`),
  KEY `documents_user_id` (`user_id`),
  KEY `documents_deleted_at` (`deleted_at`),
  KEY `documents_created_at` (`created_at`),
  KEY `documents_file_extension` (`file_extension`),
  CONSTRAINT `documents_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table: notification_document_reads (per-user seen for bell NEW badge)
-- ----------------------------
CREATE TABLE `notification_document_reads` (
  `user_id` INT UNSIGNED NOT NULL,
  `document_id` INT UNSIGNED NOT NULL,
  `read_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `document_id`),
  KEY `ndr_user` (`user_id`),
  KEY `ndr_document` (`document_id`),
  CONSTRAINT `ndr_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ndr_doc_fk` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table: audit_logs
-- ----------------------------
CREATE TABLE `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED DEFAULT NULL COMMENT 'NULL if action by anonymous (e.g. login failure)',
  `action` VARCHAR(100) NOT NULL,
  `details` TEXT,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id` (`user_id`),
  KEY `audit_logs_action` (`action`),
  KEY `audit_logs_created_at` (`created_at`),
  CONSTRAINT `audit_logs_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
