-- 系统设置模块初始化。
-- 空库重放时直接使用最终版结构：每行一个配置块，使用配置编码区分。

CREATE TABLE `system_settings` (
  `id` VARCHAR(36) NOT NULL COMMENT '系统设置主键 ID',
  `code` VARCHAR(100) NOT NULL COMMENT '系统配置编码',
  `name` VARCHAR(100) NOT NULL COMMENT '系统配置名称',
  `config_json` JSON NULL COMMENT '系统配置内容',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  UNIQUE INDEX `uk_system_settings_code`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='系统设置表';
