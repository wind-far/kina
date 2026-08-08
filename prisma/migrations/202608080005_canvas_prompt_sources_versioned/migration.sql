ALTER TABLE `canvas_prompt_sources`
  ADD COLUMN `source_kind` VARCHAR(32) NOT NULL DEFAULT 'JSON' AFTER `source_url`,
  ADD COLUMN `category` VARCHAR(100) NULL AFTER `source_kind`,
  ADD COLUMN `permission_scope` VARCHAR(32) NOT NULL DEFAULT 'PRIVATE' AFTER `category`,
  ADD COLUMN `allowed_roles_json` JSON NULL AFTER `permission_scope`,
  ADD COLUMN `current_version_no` INTEGER NOT NULL DEFAULT 0 AFTER `allowed_roles_json`,
  ADD COLUMN `last_sync_status` VARCHAR(32) NOT NULL DEFAULT 'NEVER' AFTER `current_version_no`,
  ADD COLUMN `last_sync_error` LONGTEXT NULL AFTER `last_sync_status`,
  ADD COLUMN `last_synced_at` DATETIME(3) NULL AFTER `last_sync_error`;

ALTER TABLE `canvas_prompts`
  ADD COLUMN `summary` VARCHAR(500) NULL AFTER `content`,
  ADD COLUMN `kind` VARCHAR(32) NOT NULL DEFAULT 'TEXT' AFTER `summary`,
  ADD COLUMN `target_node_type` VARCHAR(32) NULL AFTER `kind`,
  ADD COLUMN `source_data_json` JSON NULL AFTER `target_node_type`;

CREATE TABLE `canvas_prompt_source_versions` (
  `id` VARCHAR(36) NOT NULL,
  `source_id` VARCHAR(36) NOT NULL,
  `version_no` INTEGER NOT NULL,
  `content_hash` VARCHAR(64) NOT NULL,
  `prompt_count` INTEGER NOT NULL DEFAULT 0,
  `snapshot_json` JSON NOT NULL,
  `change_type` VARCHAR(32) NOT NULL DEFAULT 'SYNC',
  `change_note` VARCHAR(255) NULL,
  `created_by_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uk_canvas_prompt_source_versions_source_version`(`source_id`, `version_no`),
  INDEX `idx_canvas_prompt_source_versions_source_created`(`source_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `canvas_prompt_source_versions_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `canvas_prompt_sources`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `canvas_prompt_sync_runs` (
  `id` VARCHAR(36) NOT NULL,
  `source_id` VARCHAR(36) NOT NULL,
  `trigger_user_id` VARCHAR(36) NULL,
  `action` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `source_version_no` INTEGER NULL,
  `target_version_no` INTEGER NULL,
  `imported_count` INTEGER NOT NULL DEFAULT 0,
  `error_message` LONGTEXT NULL,
  `detail_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finished_at` DATETIME(3) NULL,
  INDEX `idx_canvas_prompt_sync_runs_source_created`(`source_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `canvas_prompt_sync_runs_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `canvas_prompt_sources`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
