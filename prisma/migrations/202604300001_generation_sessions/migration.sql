-- 为生成页补充正式会话表，承载左侧会话列表、重命名、删除和记录归属。
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

-- 给生成记录增加会话归属字段，后续所有新记录都必须挂到会话下面。
ALTER TABLE `generation_records`
  ADD COLUMN `session_id` VARCHAR(36) NULL COMMENT '所属会话 ID' AFTER `user_id`;

-- 为已有用户补默认会话，避免历史记录丢失归属。
INSERT INTO `generation_sessions` (
  `id`,
  `user_id`,
  `title`,
  `is_default`,
  `sort_order`,
  `last_record_at`,
  `created_at`,
  `updated_at`
)
SELECT
  LOWER(REPLACE(UUID(), '-', '')) AS `id`,
  `gr`.`user_id`,
  '默认创作' AS `title`,
  true AS `is_default`,
  0 AS `sort_order`,
  MAX(`gr`.`created_at`) AS `last_record_at`,
  NOW(3) AS `created_at`,
  NOW(3) AS `updated_at`
FROM `generation_records` `gr`
GROUP BY `gr`.`user_id`;

-- 将历史生成记录回填到对应用户的默认会话。
UPDATE `generation_records` `gr`
INNER JOIN `generation_sessions` `gs`
  ON `gs`.`user_id` = `gr`.`user_id`
 AND `gs`.`is_default` = true
SET `gr`.`session_id` = `gs`.`id`
WHERE `gr`.`session_id` IS NULL;

-- 所有旧数据都已完成回填后，再收紧为必填字段。
ALTER TABLE `generation_records`
  MODIFY COLUMN `session_id` VARCHAR(36) NOT NULL COMMENT '所属会话 ID';

ALTER TABLE `generation_records`
  ADD INDEX `idx_generation_records_session_created_at`(`session_id`, `created_at`),
  ADD CONSTRAINT `fk_generation_records_session_id` FOREIGN KEY (`session_id`) REFERENCES `generation_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
