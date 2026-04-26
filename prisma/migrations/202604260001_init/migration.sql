-- 第一版初始化表结构
-- 面向登录、生成、资源、厂商配置、对象存储等核心模块的完整持久化需求

CREATE TABLE `app_users` (
  `id` VARCHAR(36) NOT NULL COMMENT '用户主键 ID',
  `name` VARCHAR(100) NULL COMMENT '用户昵称',
  `avatar_url` TEXT NULL COMMENT '用户头像地址',
  `email` VARCHAR(191) NULL COMMENT '用户邮箱',
  `phone` VARCHAR(32) NULL COMMENT '用户手机号',
  `status` ENUM('ANONYMOUS', 'ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ANONYMOUS' COMMENT '用户状态：匿名、启用、禁用',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  UNIQUE INDEX `uk_app_users_email`(`email`),
  UNIQUE INDEX `uk_app_users_phone`(`phone`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='应用用户表';

-- 通用验证码记录表：手机号、邮箱等验证码统一收口
CREATE TABLE `auth_verification_codes` (
  `id` VARCHAR(36) NOT NULL COMMENT '主键 ID',
  `user_id` VARCHAR(36) NULL COMMENT '关联用户 ID，可为空',
  `method_type` ENUM('PHONE_CODE', 'EMAIL_CODE', 'WECHAT_OAUTH', 'GITHUB_OAUTH', 'GOOGLE_OAUTH', 'CUSTOM_OAUTH') NOT NULL COMMENT '登录方式类型',
  `channel` ENUM('PHONE', 'EMAIL') NOT NULL COMMENT '验证码通道',
  `scene` VARCHAR(50) NOT NULL DEFAULT 'login' COMMENT '业务场景',
  `target` VARCHAR(191) NOT NULL COMMENT '接收目标，如手机号或邮箱',
  `code` VARCHAR(16) NOT NULL COMMENT '验证码',
  `expires_at` DATETIME(3) NOT NULL COMMENT '过期时间',
  `used_at` DATETIME(3) NULL COMMENT '使用时间',
  `requester_ip` VARCHAR(100) NULL COMMENT '请求来源 IP',
  `user_agent` VARCHAR(500) NULL COMMENT '请求来源 User-Agent',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_auth_verification_codes_method_target_scene_created_at` (`method_type`, `target`, `scene`, `created_at`),
  KEY `idx_auth_verification_codes_expires_at` (`expires_at`),
  CONSTRAINT `fk_auth_verification_codes_user_id` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通用验证码记录表';

-- 登录方式配置表：后台动态启用、禁用、排序与扩展配置
CREATE TABLE `auth_method_configs` (
  `id` VARCHAR(36) NOT NULL COMMENT '主键 ID',
  `user_id` VARCHAR(36) NULL COMMENT '所属用户 ID，空表示系统级配置',
  `method_type` ENUM('PHONE_CODE', 'EMAIL_CODE', 'WECHAT_OAUTH', 'GITHUB_OAUTH', 'GOOGLE_OAUTH', 'CUSTOM_OAUTH') NOT NULL COMMENT '登录方式类型',
  `category` ENUM('CODE', 'OAUTH') NOT NULL COMMENT '登录方式分类',
  `display_name` VARCHAR(100) NOT NULL COMMENT '展示名称',
  `description` VARCHAR(255) NULL COMMENT '展示描述',
  `icon_type` VARCHAR(50) NULL COMMENT '图标类型',
  `icon_url` TEXT NULL COMMENT '图标地址',
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否对前台可见',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序值',
  `allow_auto_fill` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否允许联调自动填充验证码',
  `allow_sign_up` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否允许自动创建新用户',
  `config_json` JSON NULL COMMENT '扩展配置 JSON',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_auth_method_configs_method_type` (`method_type`),
  KEY `idx_auth_method_configs_enabled_visible_sort` (`is_enabled`, `is_visible`, `sort_order`),
  CONSTRAINT `fk_auth_method_configs_user_id` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='登录方式配置表';

-- 用户登录身份绑定表：手机号、邮箱、第三方平台身份统一绑定
CREATE TABLE `app_user_auth_identities` (
  `id` VARCHAR(36) NOT NULL COMMENT '主键 ID',
  `user_id` VARCHAR(36) NOT NULL COMMENT '所属用户 ID',
  `method_type` ENUM('PHONE_CODE', 'EMAIL_CODE', 'WECHAT_OAUTH', 'GITHUB_OAUTH', 'GOOGLE_OAUTH', 'CUSTOM_OAUTH') NOT NULL COMMENT '登录方式类型',
  `provider_user_id` VARCHAR(191) NULL COMMENT '第三方平台用户 ID',
  `provider_union_id` VARCHAR(191) NULL COMMENT '第三方平台联合 ID',
  `identifier` VARCHAR(191) NOT NULL COMMENT '登录标识，如手机号、邮箱或平台标识',
  `is_verified` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否已验证',
  `verified_at` DATETIME(3) NULL COMMENT '验证完成时间',
  `meta_json` JSON NULL COMMENT '扩展元数据 JSON',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_app_user_auth_identities_method_identifier` (`method_type`, `identifier`),
  UNIQUE KEY `uk_app_user_auth_identities_method_provider_user_id` (`method_type`, `provider_user_id`),
  KEY `idx_app_user_auth_identities_user_method` (`user_id`, `method_type`),
  CONSTRAINT `fk_app_user_auth_identities_user_id` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_app_user_auth_identities_method_type` FOREIGN KEY (`method_type`) REFERENCES `auth_method_configs`(`method_type`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户登录身份绑定表';

-- 用户会话表：记录登录方式与当前会话状态
CREATE TABLE `app_sessions` (
  `id` VARCHAR(36) NOT NULL COMMENT '主键 ID',
  `user_id` VARCHAR(36) NOT NULL COMMENT '所属用户 ID',
  `token_hash` VARCHAR(128) NOT NULL COMMENT '会话令牌哈希值',
  `auth_method_type` ENUM('PHONE_CODE', 'EMAIL_CODE', 'WECHAT_OAUTH', 'GITHUB_OAUTH', 'GOOGLE_OAUTH', 'CUSTOM_OAUTH') NOT NULL COMMENT '登录方式类型',
  `identifier_snapshot` VARCHAR(191) NULL COMMENT '登录时的标识快照',
  `ip_address` VARCHAR(100) NULL COMMENT '登录 IP',
  `user_agent` VARCHAR(500) NULL COMMENT '登录 User-Agent',
  `expires_at` DATETIME(3) NOT NULL COMMENT '过期时间',
  `revoked_at` DATETIME(3) NULL COMMENT '撤销时间',
  `last_active_at` DATETIME(3) NULL COMMENT '最后活跃时间',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_app_sessions_token_hash` (`token_hash`),
  KEY `idx_app_sessions_user_expires_at` (`user_id`, `expires_at`),
  KEY `idx_app_sessions_expires_at` (`expires_at`),
  CONSTRAINT `fk_app_sessions_user_id` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会话表';

CREATE TABLE `ai_provider_configs` (
  `id` VARCHAR(36) NOT NULL COMMENT '厂商配置主键 ID',
  `user_id` VARCHAR(36) NULL COMMENT '所属用户 ID，允许为空表示匿名配置',
  `scene` VARCHAR(50) NOT NULL DEFAULT 'generate' COMMENT '使用场景，如 generate',
  `name` VARCHAR(100) NOT NULL COMMENT '配置名称',
  `provider_type` ENUM('OPENAI_COMPATIBLE', 'CUSTOM') NOT NULL DEFAULT 'OPENAI_COMPATIBLE' COMMENT '厂商类型：OpenAI 兼容或自定义',
  `base_url` TEXT NOT NULL COMMENT '厂商基础地址',
  `api_key_encrypted` LONGTEXT NULL COMMENT '加密后的 API Key',
  `api_key_hint` VARCHAR(64) NULL COMMENT 'API Key 提示信息，如后四位',
  `chat_endpoint` VARCHAR(255) NOT NULL DEFAULT '/chat/completions' COMMENT '对话接口路径',
  `image_endpoint` VARCHAR(255) NOT NULL DEFAULT '/images/generations' COMMENT '图片接口路径',
  `video_endpoint` VARCHAR(255) NOT NULL DEFAULT '/videos' COMMENT '视频接口路径',
  `default_chat_model` VARCHAR(191) NULL COMMENT '默认对话模型',
  `default_image_model` VARCHAR(191) NULL COMMENT '默认图片模型',
  `default_video_model` VARCHAR(191) NULL COMMENT '默认视频模型',
  `is_default` BOOLEAN NOT NULL DEFAULT false COMMENT '是否为默认配置',
  `is_enabled` BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用',
  `extra_json` JSON NULL COMMENT '扩展配置 JSON',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  INDEX `idx_ai_provider_configs_user_scene`(`user_id`, `scene`),
  INDEX `idx_ai_provider_configs_user_default`(`user_id`, `is_default`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ai_provider_configs_user_id` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='AI 厂商配置表';

CREATE TABLE `ai_provider_custom_models` (
  `id` VARCHAR(36) NOT NULL COMMENT '自定义模型主键 ID',
  `provider_config_id` VARCHAR(36) NOT NULL COMMENT '所属厂商配置 ID',
  `category` ENUM('CHAT', 'IMAGE', 'VIDEO') NOT NULL COMMENT '模型分类：对话、图片、视频',
  `label` VARCHAR(100) NOT NULL COMMENT '模型显示名称',
  `model_key` VARCHAR(191) NOT NULL COMMENT '模型标识',
  `capability_json` JSON NULL COMMENT '模型能力描述 JSON',
  `default_params_json` JSON NULL COMMENT '默认参数 JSON',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前',
  `is_enabled` BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  UNIQUE INDEX `uk_ai_provider_custom_models_config_category_key`(`provider_config_id`, `category`, `model_key`),
  INDEX `idx_ai_provider_custom_models_config_category_sort`(`provider_config_id`, `category`, `sort_order`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ai_provider_custom_models_config_id` FOREIGN KEY (`provider_config_id`) REFERENCES `ai_provider_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='AI 厂商自定义模型表';

-- 对象存储配置表：统一保存 S3 兼容存储的接入信息
CREATE TABLE `object_storage_configs` (
  `id` VARCHAR(36) NOT NULL COMMENT '主键 ID',
  `user_id` VARCHAR(36) NULL COMMENT '所属用户 ID，当前为空表示全局配置',
  `scene` VARCHAR(50) NOT NULL DEFAULT 'global' COMMENT '配置场景',
  `name` VARCHAR(100) NOT NULL COMMENT '存储名称',
  `code` VARCHAR(30) NOT NULL COMMENT '存储编码',
  `provider_type` ENUM('S3_COMPATIBLE') NOT NULL DEFAULT 'S3_COMPATIBLE' COMMENT '存储供应商类型',
  `access_key_encrypted` LONGTEXT NOT NULL COMMENT '加密后的 Access Key',
  `secret_key_encrypted` LONGTEXT NOT NULL COMMENT '加密后的 Secret Key',
  `endpoint` TEXT NOT NULL COMMENT '对象存储 Endpoint',
  `region` VARCHAR(100) NULL COMMENT '区域',
  `bucket` VARCHAR(255) NOT NULL COMMENT 'Bucket 名称',
  `domain` TEXT NULL COMMENT '自定义访问域名',
  `sort_order` INT NOT NULL DEFAULT 999 COMMENT '排序值',
  `description` VARCHAR(200) NULL COMMENT '描述',
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `is_default` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否默认',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_object_storage_configs_scene_code` (`scene`, `code`),
  KEY `idx_object_storage_configs_user_scene` (`user_id`, `scene`),
  KEY `idx_object_storage_configs_scene_default` (`scene`, `is_default`),
  KEY `idx_object_storage_configs_scene_enabled_sort` (`scene`, `is_enabled`, `sort_order`),
  CONSTRAINT `fk_object_storage_configs_user_id` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='对象存储配置表';

CREATE TABLE `generation_records` (
  `id` VARCHAR(36) NOT NULL COMMENT '生成记录主键 ID',
  `user_id` VARCHAR(36) NOT NULL COMMENT '所属用户 ID',
  `provider_config_id` VARCHAR(36) NULL COMMENT '使用的厂商配置 ID',
  `client_record_id` INT NULL COMMENT '前端本地记录 ID',
  `type` ENUM('AGENT', 'IMAGE', 'VIDEO', 'DIGITAL_HUMAN', 'MOTION') NOT NULL COMMENT '生成类型',
  `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'STOPPED') NOT NULL DEFAULT 'PENDING' COMMENT '生成状态',
  `prompt` LONGTEXT NOT NULL COMMENT '用户输入提示词',
  `content` LONGTEXT NULL COMMENT '文本结果或中间内容',
  `error_message` LONGTEXT NULL COMMENT '错误信息',
  `model_label` VARCHAR(100) NULL COMMENT '模型显示名称',
  `model_key` VARCHAR(191) NULL COMMENT '模型标识',
  `ratio` VARCHAR(32) NULL COMMENT '画幅比例',
  `resolution` VARCHAR(64) NULL COMMENT '分辨率',
  `duration_label` VARCHAR(64) NULL COMMENT '时长描述',
  `feature` VARCHAR(100) NULL COMMENT '功能特性标识',
  `skill` VARCHAR(100) NULL COMMENT '技能标识',
  `agent_task_id` VARCHAR(191) NULL COMMENT 'Agent 任务 ID',
  `meta_json` JSON NULL COMMENT '扩展元数据 JSON',
  `started_at` DATETIME(3) NULL COMMENT '开始执行时间',
  `finished_at` DATETIME(3) NULL COMMENT '结束执行时间',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  INDEX `idx_generation_records_user_created_at`(`user_id`, `created_at`),
  INDEX `idx_generation_records_type_status_created_at`(`type`, `status`, `created_at`),
  INDEX `idx_generation_records_provider_created_at`(`provider_config_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_generation_records_user_id` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_generation_records_provider_config_id` FOREIGN KEY (`provider_config_id`) REFERENCES `ai_provider_configs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='统一生成记录表';

CREATE TABLE `generation_outputs` (
  `id` VARCHAR(36) NOT NULL COMMENT '输出结果主键 ID',
  `generation_record_id` VARCHAR(36) NOT NULL COMMENT '所属生成记录 ID',
  `output_type` ENUM('IMAGE', 'VIDEO', 'TEXT', 'FILE') NOT NULL COMMENT '输出类型',
  `url` LONGTEXT NULL COMMENT '资源地址',
  `text_content` LONGTEXT NULL COMMENT '文本内容',
  `mime_type` VARCHAR(100) NULL COMMENT '资源 MIME 类型',
  `width` INT NULL COMMENT '宽度',
  `height` INT NULL COMMENT '高度',
  `duration_seconds` INT NULL COMMENT '时长（秒）',
  `file_size_bytes` BIGINT NULL COMMENT '文件大小（字节）',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前',
  `meta_json` JSON NULL COMMENT '输出元数据 JSON',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  INDEX `idx_generation_outputs_record_sort`(`generation_record_id`, `sort_order`),
  INDEX `idx_generation_outputs_type_created_at`(`output_type`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_generation_outputs_record_id` FOREIGN KEY (`generation_record_id`) REFERENCES `generation_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='生成输出结果表';

-- 首页瀑布流与资产页统一资源层
-- 资源层用于承接“可展示资源”，避免页面直接耦合 generation_outputs
CREATE TABLE `asset_items` (
  `id` VARCHAR(36) NOT NULL COMMENT '资源主键 ID',
  `user_id` VARCHAR(36) NOT NULL COMMENT '资源归属用户 ID',
  `generation_record_id` VARCHAR(36) NULL COMMENT '来源生成记录 ID',
  `generation_output_id` VARCHAR(36) NULL COMMENT '来源输出结果 ID',
  `asset_type` ENUM('IMAGE', 'VIDEO') NOT NULL COMMENT '资源类型',
  `title` VARCHAR(255) NULL COMMENT '资源标题',
  `description` LONGTEXT NULL COMMENT '资源描述',
  `cover_url` LONGTEXT NULL COMMENT '资源封面地址',
  `file_url` LONGTEXT NOT NULL COMMENT '资源文件地址',
  `thumbnail_url` LONGTEXT NULL COMMENT '资源缩略图地址',
  `width` INT NULL COMMENT '资源宽度',
  `height` INT NULL COMMENT '资源高度',
  `duration_seconds` INT NULL COMMENT '资源时长（秒）',
  `file_size_bytes` BIGINT NULL COMMENT '文件大小（字节）',
  `prompt_text` LONGTEXT NULL COMMENT '资源对应提示词',
  `model_label` VARCHAR(100) NULL COMMENT '模型显示名称',
  `aspect_ratio` VARCHAR(32) NULL COMMENT '画幅比例',
  `visibility` ENUM('PRIVATE', 'PUBLIC', 'UNLISTED') NOT NULL DEFAULT 'PRIVATE' COMMENT '可见性：私有、公开、不公开链接',
  `publish_status` ENUM('DRAFT', 'PUBLISHED', 'HIDDEN') NOT NULL DEFAULT 'DRAFT' COMMENT '发布状态',
  `review_status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED' COMMENT '审核状态',
  `favorite_count` INT NOT NULL DEFAULT 0 COMMENT '收藏次数',
  `view_count` INT NOT NULL DEFAULT 0 COMMENT '浏览次数',
  `download_count` INT NOT NULL DEFAULT 0 COMMENT '下载次数',
  `source` ENUM('GENERATED', 'UPLOADED', 'IMPORTED') NOT NULL DEFAULT 'GENERATED' COMMENT '资源来源',
  `source_meta_json` JSON NULL COMMENT '来源扩展信息 JSON',
  `is_deleted` BOOLEAN NOT NULL DEFAULT false COMMENT '是否已删除',
  `published_at` DATETIME(3) NULL COMMENT '发布时间',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  INDEX `idx_asset_items_user_type_created_at`(`user_id`, `asset_type`, `created_at`),
  INDEX `idx_asset_items_public_feed`(`asset_type`, `visibility`, `publish_status`, `review_status`, `created_at`),
  INDEX `idx_asset_items_generation_record_id`(`generation_record_id`),
  INDEX `idx_asset_items_generation_output_id`(`generation_output_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_asset_items_user_id` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_asset_items_generation_record_id` FOREIGN KEY (`generation_record_id`) REFERENCES `generation_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_asset_items_generation_output_id` FOREIGN KEY (`generation_output_id`) REFERENCES `generation_outputs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='统一资源表';

CREATE TABLE `asset_favorites` (
  `id` VARCHAR(36) NOT NULL COMMENT '收藏关系主键 ID',
  `asset_id` VARCHAR(36) NOT NULL COMMENT '资源 ID',
  `user_id` VARCHAR(36) NOT NULL COMMENT '收藏用户 ID',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  UNIQUE INDEX `uk_asset_favorites_asset_user`(`asset_id`, `user_id`),
  INDEX `idx_asset_favorites_user_created_at`(`user_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_asset_favorites_asset_id` FOREIGN KEY (`asset_id`) REFERENCES `asset_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_asset_favorites_user_id` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='资源收藏关系表';

CREATE TABLE `agent_runs` (
  `id` VARCHAR(36) NOT NULL COMMENT 'Agent 运行主键 ID',
  `generation_record_id` VARCHAR(36) NOT NULL COMMENT '关联生成记录 ID',
  `user_id` VARCHAR(36) NOT NULL COMMENT '所属用户 ID',
  `query` LONGTEXT NOT NULL COMMENT '用户请求内容',
  `skill` VARCHAR(100) NULL COMMENT '技能标识',
  `status` ENUM('IDLE', 'THINKING', 'RUNNING', 'COMPLETED', 'ERROR', 'STOPPED') NOT NULL DEFAULT 'IDLE' COMMENT '运行状态',
  `agent_name` VARCHAR(100) NULL COMMENT 'Agent 名称',
  `agent_avatar_url` TEXT NULL COMMENT 'Agent 头像地址',
  `indicator_status` ENUM('IDLE', 'THINKING', 'RUNNING', 'COMPLETED', 'ERROR', 'STOPPED') NULL DEFAULT 'IDLE' COMMENT '顶部指示器状态',
  `indicator_title` VARCHAR(100) NULL COMMENT '顶部指示器标题',
  `indicator_description` LONGTEXT NULL COMMENT '顶部指示器描述',
  `result_title` VARCHAR(255) NULL COMMENT '结果标题',
  `result_summary` LONGTEXT NULL COMMENT '结果摘要',
  `expected_image_count` INT NULL DEFAULT 0 COMMENT '预期产出图片数量',
  `output_visible` BOOLEAN NOT NULL DEFAULT false COMMENT '结果区域是否可见',
  `error_message` LONGTEXT NULL COMMENT '错误信息',
  `stop_reason` LONGTEXT NULL COMMENT '停止原因',
  `started_at` DATETIME(3) NULL COMMENT '开始执行时间',
  `finished_at` DATETIME(3) NULL COMMENT '结束执行时间',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  UNIQUE INDEX `uk_agent_runs_generation_record_id`(`generation_record_id`),
  INDEX `idx_agent_runs_user_created_at`(`user_id`, `created_at`),
  INDEX `idx_agent_runs_status_created_at`(`status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_agent_runs_generation_record_id` FOREIGN KEY (`generation_record_id`) REFERENCES `generation_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_agent_runs_user_id` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='Agent 运行主表';

CREATE TABLE `agent_run_steps` (
  `id` VARCHAR(36) NOT NULL COMMENT '阶段步骤主键 ID',
  `agent_run_id` VARCHAR(36) NOT NULL COMMENT '所属 Agent 运行 ID',
  `step_key` VARCHAR(100) NOT NULL COMMENT '步骤标识',
  `title` VARCHAR(100) NOT NULL COMMENT '步骤标题',
  `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'ERROR') NOT NULL DEFAULT 'PENDING' COMMENT '步骤状态',
  `description` LONGTEXT NULL COMMENT '步骤描述',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前',
  `started_at` DATETIME(3) NULL COMMENT '开始时间',
  `completed_at` DATETIME(3) NULL COMMENT '完成时间',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  UNIQUE INDEX `uk_agent_run_steps_run_step_key`(`agent_run_id`, `step_key`),
  INDEX `idx_agent_run_steps_run_sort`(`agent_run_id`, `sort_order`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_agent_run_steps_run_id` FOREIGN KEY (`agent_run_id`) REFERENCES `agent_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='Agent 阶段步骤表';

CREATE TABLE `agent_process_sections` (
  `id` VARCHAR(36) NOT NULL COMMENT '过程分组主键 ID',
  `agent_run_id` VARCHAR(36) NOT NULL COMMENT '所属 Agent 运行 ID',
  `section_key` VARCHAR(100) NOT NULL COMMENT '分组标识',
  `kind` ENUM('SKILL', 'REASONING') NOT NULL COMMENT '分组类型：技能或思考',
  `label` VARCHAR(100) NOT NULL COMMENT '分组标题',
  `paragraphs_json` JSON NULL COMMENT '段落内容 JSON',
  `task_items_json` JSON NULL COMMENT '任务项 JSON',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前',
  `is_collapsed` BOOLEAN NOT NULL DEFAULT false COMMENT '是否折叠',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  UNIQUE INDEX `uk_agent_process_sections_run_section_key`(`agent_run_id`, `section_key`),
  INDEX `idx_agent_process_sections_run_sort`(`agent_run_id`, `sort_order`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_agent_process_sections_run_id` FOREIGN KEY (`agent_run_id`) REFERENCES `agent_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='Agent 过程分组表';
