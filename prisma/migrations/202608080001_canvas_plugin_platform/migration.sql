CREATE TABLE `canvas_plugins` (
  `id` VARCHAR(36) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `manifest_json` JSON NOT NULL,
  `is_enabled` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `uk_canvas_plugins_slug`(`slug`),
  INDEX `idx_canvas_plugins_enabled_updated`(`is_enabled`, `updated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `canvas_plugin_releases` (
  `id` VARCHAR(36) NOT NULL,
  `plugin_id` VARCHAR(36) NOT NULL,
  `version` VARCHAR(50) NOT NULL,
  `package_url` TEXT NOT NULL,
  `integrity_sha256` VARCHAR(128) NOT NULL,
  `manifest_json` JSON NOT NULL,
  `is_trusted` BOOLEAN NOT NULL DEFAULT false,
  `published_by_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uk_canvas_plugin_releases_plugin_version`(`plugin_id`, `version`),
  INDEX `idx_canvas_plugin_releases_plugin_created`(`plugin_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `canvas_plugin_releases_plugin_id_fkey` FOREIGN KEY (`plugin_id`) REFERENCES `canvas_plugins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `canvas_plugin_installs` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `plugin_id` VARCHAR(36) NOT NULL,
  `release_id` VARCHAR(36) NOT NULL,
  `is_enabled` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `uk_canvas_plugin_installs_user_plugin`(`user_id`, `plugin_id`),
  INDEX `idx_canvas_plugin_installs_user_enabled`(`user_id`, `is_enabled`),
  PRIMARY KEY (`id`),
  CONSTRAINT `canvas_plugin_installs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `canvas_plugin_installs_plugin_id_fkey` FOREIGN KEY (`plugin_id`) REFERENCES `canvas_plugins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
