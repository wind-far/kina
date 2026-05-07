-- 工作流第一阶段：新增工作流定义与版本能力。
-- 这一阶段只落定义层与版本层，不引入运行实例，避免与现有 generation-tasks 一次性强耦合。

CREATE TABLE `workflow_definitions` (
  `id` VARCHAR(36) NOT NULL COMMENT '主键 ID',
  `user_id` VARCHAR(36) NULL COMMENT '所属用户 ID，空表示系统级工作流',
  `code` VARCHAR(100) NOT NULL COMMENT '工作流唯一编码',
  `name` VARCHAR(100) NOT NULL COMMENT '工作流名称',
  `description` VARCHAR(255) NULL COMMENT '工作流描述',
  `category` VARCHAR(50) NULL COMMENT '工作流分类',
  `scene` ENUM('WORKFLOW_CANVAS', 'AGENT_WORKSPACE', 'GENERATION_PIPELINE') NOT NULL DEFAULT 'WORKFLOW_CANVAS' COMMENT '工作流使用场景',
  `source_type` ENUM('VISUAL', 'SKILL_TEMPLATE', 'SYSTEM_BUILTIN') NOT NULL DEFAULT 'VISUAL' COMMENT '工作流来源类型',
  `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT' COMMENT '工作流状态',
  `current_version_id` VARCHAR(36) NULL COMMENT '当前生效版本 ID',
  `latest_version_no` INT NOT NULL DEFAULT 0 COMMENT '最新版本号',
  `is_built_in` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否内置工作流',
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序值',
  `tags_json` JSON NULL COMMENT '标签 JSON',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_workflow_definitions_code` (`code`),
  KEY `idx_workflow_definitions_user_scene_status` (`user_id`, `scene`, `status`),
  KEY `idx_workflow_definitions_enabled_sort` (`is_enabled`, `sort_order`),
  KEY `idx_workflow_definitions_current_version_id` (`current_version_id`),
  CONSTRAINT `fk_workflow_definitions_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `app_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流定义主表';

CREATE TABLE `workflow_definition_versions` (
  `id` VARCHAR(36) NOT NULL COMMENT '主键 ID',
  `workflow_id` VARCHAR(36) NOT NULL COMMENT '所属工作流 ID',
  `created_by` VARCHAR(36) NULL COMMENT '创建人 ID',
  `version_no` INT NOT NULL COMMENT '版本号',
  `version_name` VARCHAR(100) NULL COMMENT '版本名称',
  `change_summary` VARCHAR(255) NULL COMMENT '版本变更摘要',
  `status` ENUM('DRAFT', 'PUBLISHED', 'DEPRECATED') NOT NULL DEFAULT 'DRAFT' COMMENT '版本状态',
  `definition_json` JSON NULL COMMENT '工作流整体定义 JSON',
  `nodes_json` JSON NULL COMMENT '节点快照 JSON',
  `edges_json` JSON NULL COMMENT '边快照 JSON',
  `viewport_json` JSON NULL COMMENT '画布视口 JSON',
  `input_schema_json` JSON NULL COMMENT '输入结构定义 JSON',
  `output_schema_json` JSON NULL COMMENT '输出结构定义 JSON',
  `runtime_config_json` JSON NULL COMMENT '运行时配置 JSON',
  `published_at` DATETIME(3) NULL COMMENT '发布时间',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_workflow_definition_versions_workflow_version` (`workflow_id`, `version_no`),
  KEY `idx_workflow_definition_versions_workflow_status_created_at` (`workflow_id`, `status`, `created_at`),
  KEY `idx_workflow_definition_versions_created_by` (`created_by`),
  CONSTRAINT `fk_workflow_definition_versions_workflow_id`
    FOREIGN KEY (`workflow_id`) REFERENCES `workflow_definitions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_workflow_definition_versions_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `app_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流版本表';

ALTER TABLE `workflow_definitions`
  ADD CONSTRAINT `fk_workflow_definitions_current_version_id`
  FOREIGN KEY (`current_version_id`) REFERENCES `workflow_definition_versions` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
