CREATE TABLE `admin_audit_logs` (
  `id` VARCHAR(36) NOT NULL COMMENT '后台审计日志主键 ID',
  `operator_user_id` VARCHAR(36) NOT NULL COMMENT '操作管理员用户 ID',
  `action` VARCHAR(100) NOT NULL COMMENT '后台操作动作编码',
  `target_type` VARCHAR(100) NOT NULL COMMENT '操作目标类型',
  `target_id` VARCHAR(100) NULL COMMENT '操作目标 ID',
  `before_json` JSON NULL COMMENT '操作前数据快照 JSON',
  `after_json` JSON NULL COMMENT '操作后数据快照 JSON',
  `ip_address` VARCHAR(100) NULL COMMENT '操作者 IP 地址',
  `user_agent` VARCHAR(500) NULL COMMENT '操作者 User-Agent',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',

  INDEX `idx_admin_audit_logs_operator_created_at`(`operator_user_id`, `created_at`),
  INDEX `idx_admin_audit_logs_target_created_at`(`target_type`, `target_id`, `created_at`),
  INDEX `idx_admin_audit_logs_action_created_at`(`action`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='后台审计日志表';
