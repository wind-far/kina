CREATE TABLE `canvas_prompt_sources` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NULL,
  `name` VARCHAR(100) NOT NULL,
  `source_url` TEXT NULL,
  `is_enabled` BOOLEAN NOT NULL DEFAULT true,
  `config_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `idx_canvas_prompt_sources_user_enabled`(`user_id`, `is_enabled`, `updated_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `canvas_prompt_sources_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `canvas_prompts` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NULL,
  `source_id` VARCHAR(36) NULL,
  `external_key` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `tags_json` JSON NULL,
  `is_enabled` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `uk_canvas_prompts_source_external`(`source_id`, `external_key`),
  INDEX `idx_canvas_prompts_user_enabled`(`user_id`, `is_enabled`, `updated_at`),
  INDEX `idx_canvas_prompts_source_enabled`(`source_id`, `is_enabled`),
  PRIMARY KEY (`id`),
  CONSTRAINT `canvas_prompts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `canvas_prompts_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `canvas_prompt_sources`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
