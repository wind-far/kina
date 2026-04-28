CREATE TABLE `system_settings` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(50) NOT NULL COMMENT '系统设置编码',
  `site_info_json` JSON NULL COMMENT '站点信息配置',
  `policy_json` JSON NULL COMMENT '政策协议配置',
  `login_settings_json` JSON NULL COMMENT '登录界面配置',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uk_system_settings_code`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
