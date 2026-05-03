-- 生成会话模块初始化。
-- 空库重放时直接落最终结构，不再执行历史数据回填。

CREATE TABLE `generation_sessions` (
  `id` VARCHAR(36) NOT NULL COMMENT '会话主键 ID',
  `user_id` VARCHAR(36) NOT NULL COMMENT '所属用户 ID',
  `title` VARCHAR(120) NOT NULL COMMENT '会话标题',
  `is_default` BOOLEAN NOT NULL DEFAULT false COMMENT '是否默认会话',
  `sort_order` INTEGER NOT NULL DEFAULT 0 COMMENT '排序值',
  `last_record_at` DATETIME(3) NULL COMMENT '最后一条记录时间',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新时间',

  INDEX `idx_generation_sessions_user_default_updated_at`(`user_id`, `is_default`, `updated_at`),
  INDEX `idx_generation_sessions_user_last_record_at`(`user_id`, `last_record_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_generation_sessions_user_id` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='生成会话表';

ALTER TABLE `generation_records`
  ADD COLUMN `session_id` VARCHAR(36) NOT NULL COMMENT '所属会话 ID' AFTER `user_id`,
  ADD INDEX `idx_generation_records_session_created_at`(`session_id`, `created_at`),
  ADD CONSTRAINT `fk_generation_records_session_id` FOREIGN KEY (`session_id`) REFERENCES `generation_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
