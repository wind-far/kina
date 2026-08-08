CREATE TABLE `skill_source_packages` (
  `id` VARCHAR(36) NOT NULL,
  `package_key` VARCHAR(100) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `repository_url` TEXT NULL,
  `license_url` TEXT NULL,
  `source_revision` VARCHAR(191) NULL,
  `integrity_sha256` VARCHAR(128) NULL,
  `terms_version` VARCHAR(100) NULL,
  `compliance_json` JSON NULL,
  `is_trusted` BOOLEAN NOT NULL DEFAULT false,
  `is_enabled` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `uk_skill_source_packages_package_key`(`package_key`),
  INDEX `idx_skill_source_packages_trusted_enabled`(`is_trusted`, `is_enabled`, `updated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `skill_source_artifacts` (
  `id` VARCHAR(36) NOT NULL,
  `source_package_id` VARCHAR(36) NOT NULL,
  `artifact_path` VARCHAR(500) NOT NULL,
  `artifact_type` VARCHAR(50) NOT NULL,
  `locale` VARCHAR(32) NULL,
  `content` LONGTEXT NOT NULL,
  `integrity_sha256` VARCHAR(128) NOT NULL,
  `metadata_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `uk_skill_source_artifacts_package_path`(`source_package_id`, `artifact_path`),
  INDEX `idx_skill_source_artifacts_package_type`(`source_package_id`, `artifact_type`),
  PRIMARY KEY (`id`),
  CONSTRAINT `skill_source_artifacts_source_package_id_fkey` FOREIGN KEY (`source_package_id`) REFERENCES `skill_source_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `skill_compliance_acceptances` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `source_package_id` VARCHAR(36) NOT NULL,
  `terms_version` VARCHAR(100) NOT NULL,
  `country_code` VARCHAR(8) NOT NULL,
  `accepted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `metadata_json` JSON NULL,
  UNIQUE INDEX `uk_skill_compliance_acceptances_user_package_terms`(`user_id`, `source_package_id`, `terms_version`),
  INDEX `idx_skill_compliance_acceptances_package_terms`(`source_package_id`, `terms_version`),
  PRIMARY KEY (`id`),
  CONSTRAINT `skill_compliance_acceptances_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `skill_compliance_acceptances_source_package_id_fkey` FOREIGN KEY (`source_package_id`) REFERENCES `skill_source_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `skill_execution_runs` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `skill_id` VARCHAR(36) NULL,
  `generation_record_id` VARCHAR(36) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
  `plan_json` JSON NOT NULL,
  `state_json` JSON NULL,
  `started_at` DATETIME(3) NULL,
  `finished_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `idx_skill_execution_runs_user_status_created`(`user_id`, `status`, `created_at`),
  INDEX `idx_skill_execution_runs_generation_record`(`generation_record_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `skill_execution_runs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ai_skills` ADD COLUMN `source_package_id` VARCHAR(36) NULL;
CREATE INDEX `idx_ai_skills_source_package_id` ON `ai_skills`(`source_package_id`);
ALTER TABLE `ai_skills` ADD CONSTRAINT `ai_skills_source_package_id_fkey` FOREIGN KEY (`source_package_id`) REFERENCES `skill_source_packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
