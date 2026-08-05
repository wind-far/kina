-- 工作流运行持久化：保存整图运行与节点运行生命周期。

CREATE TABLE `workflow_runs` (
  `id` VARCHAR(36) NOT NULL COMMENT '运行实例 ID',
  `workflow_id` VARCHAR(36) NOT NULL COMMENT '工作流 ID',
  `workflow_version_id` VARCHAR(36) NOT NULL COMMENT '运行使用的版本 ID',
  `user_id` VARCHAR(36) NOT NULL COMMENT '运行发起用户 ID',
  `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'INTERRUPTED') NOT NULL DEFAULT 'PENDING',
  `executor` VARCHAR(32) NOT NULL DEFAULT 'BROWSER' COMMENT '执行器类型',
  `total_nodes` INT NOT NULL DEFAULT 0,
  `completed_nodes` INT NOT NULL DEFAULT 0,
  `current_node_id` VARCHAR(191) NULL,
  `error_message` LONGTEXT NULL,
  `result_json` JSON NULL,
  `heartbeat_at` DATETIME(3) NULL,
  `stop_requested_at` DATETIME(3) NULL,
  `started_at` DATETIME(3) NULL,
  `finished_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_workflow_runs_workflow_created_at` (`workflow_id`, `created_at`),
  KEY `idx_workflow_runs_user_status_created_at` (`user_id`, `status`, `created_at`),
  KEY `idx_workflow_runs_status_heartbeat_at` (`status`, `heartbeat_at`),
  KEY `idx_workflow_runs_workflow_version_id` (`workflow_version_id`),
  CONSTRAINT `fk_workflow_runs_workflow_id`
    FOREIGN KEY (`workflow_id`) REFERENCES `workflow_definitions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_workflow_runs_workflow_version_id`
    FOREIGN KEY (`workflow_version_id`) REFERENCES `workflow_definition_versions` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_workflow_runs_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `app_users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流运行实例';

CREATE TABLE `workflow_node_runs` (
  `id` VARCHAR(36) NOT NULL COMMENT '节点运行 ID',
  `workflow_run_id` VARCHAR(36) NOT NULL COMMENT '工作流运行实例 ID',
  `generation_record_id` VARCHAR(36) NULL COMMENT '关联生成任务记录 ID',
  `node_id` VARCHAR(191) NOT NULL COMMENT '画布节点 ID',
  `node_type` VARCHAR(50) NOT NULL COMMENT '画布节点类型',
  `label` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `sort_order` INT NOT NULL DEFAULT 0,
  `output_json` JSON NULL,
  `error_message` LONGTEXT NULL,
  `started_at` DATETIME(3) NULL,
  `finished_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_workflow_node_runs_run_node` (`workflow_run_id`, `node_id`),
  KEY `idx_workflow_node_runs_run_sort` (`workflow_run_id`, `sort_order`),
  KEY `idx_workflow_node_runs_generation_record` (`generation_record_id`),
  CONSTRAINT `fk_workflow_node_runs_workflow_run_id`
    FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_workflow_node_runs_generation_record_id`
    FOREIGN KEY (`generation_record_id`) REFERENCES `generation_records` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流节点运行记录';
