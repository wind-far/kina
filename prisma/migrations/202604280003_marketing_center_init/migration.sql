-- 营销中心初始化迁移。
-- 本次迁移覆盖会员订阅、积分充值、卡密兑换、登录奖励、注册奖励、签到奖励。

-- 创建会员等级表。
CREATE TABLE `membership_levels` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `name` VARCHAR(64) NOT NULL COMMENT '会员等级名称',
    `level` INTEGER NOT NULL COMMENT '会员等级序号',
    `description` VARCHAR(255) NULL COMMENT '会员等级描述',
    `icon_url` TEXT NULL COMMENT '会员图标地址',
    `monthly_bonus_points` INTEGER NOT NULL DEFAULT 0 COMMENT '每月赠送积分',
    `storage_capacity` BIGINT NOT NULL DEFAULT 0 COMMENT '赠送存储容量',
    `benefits_json` JSON NULL COMMENT '会员权益配置',
    `is_enabled` BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用',
    `sort_order` INTEGER NOT NULL DEFAULT 0 COMMENT '排序值',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    INDEX `idx_membership_levels_enabled_sort`(`is_enabled`, `sort_order`),
    UNIQUE INDEX `uk_membership_levels_level`(`level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='会员等级表';

-- 创建会员订阅计划表。
CREATE TABLE `membership_plans` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `level_id` VARCHAR(36) NOT NULL COMMENT '关联会员等级ID',
    `name` VARCHAR(64) NOT NULL COMMENT '订阅计划名称',
    `label` VARCHAR(64) NULL COMMENT '计划标签',
    `description` VARCHAR(255) NULL COMMENT '计划描述',
    `duration_type` ENUM('MONTH', 'QUARTER', 'HALF_YEAR', 'YEAR', 'FOREVER', 'CUSTOM') NOT NULL COMMENT '时长类型',
    `duration_value` INTEGER NOT NULL DEFAULT 1 COMMENT '时长数值',
    `duration_unit` VARCHAR(20) NOT NULL DEFAULT 'month' COMMENT '时长单位',
    `sales_price` DECIMAL(10, 2) NOT NULL COMMENT '销售价格',
    `original_price` DECIMAL(10, 2) NULL COMMENT '划线原价',
    `bonus_points` INTEGER NOT NULL DEFAULT 0 COMMENT '赠送积分',
    `benefits_json` JSON NULL COMMENT '计划权益快照',
    `is_enabled` BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用',
    `sort_order` INTEGER NOT NULL DEFAULT 0 COMMENT '排序值',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    INDEX `idx_membership_plans_level_enabled_sort`(`level_id`, `is_enabled`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='订阅计划表';

-- 创建用户订阅聚合表。
CREATE TABLE `user_subscriptions` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `user_id` VARCHAR(36) NOT NULL COMMENT '用户ID',
    `level_id` VARCHAR(36) NOT NULL COMMENT '会员等级ID',
    `order_id` VARCHAR(36) NULL COMMENT '关联会员订单ID',
    `status` ENUM('ACTIVE', 'EXPIRED', 'CANCELED') NOT NULL DEFAULT 'ACTIVE' COMMENT '订阅状态',
    `start_time` DATETIME(3) NOT NULL COMMENT '开始时间',
    `end_time` DATETIME(3) NOT NULL COMMENT '到期时间',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    INDEX `idx_user_subscriptions_user_status_end_time`(`user_id`, `status`, `end_time`),
    UNIQUE INDEX `uk_user_subscriptions_user_level`(`user_id`, `level_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='用户订阅表';

-- 创建会员订单表。
CREATE TABLE `membership_orders` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `user_id` VARCHAR(36) NOT NULL COMMENT '用户ID',
    `level_id` VARCHAR(36) NOT NULL COMMENT '会员等级ID',
    `plan_id` VARCHAR(36) NULL COMMENT '订阅计划ID',
    `order_no` VARCHAR(64) NOT NULL COMMENT '会员订单号',
    `source_type` ENUM('DIRECT_PURCHASE', 'CARD_REDEEM', 'SYSTEM_GRANT', 'ADMIN_ADJUST') NOT NULL DEFAULT 'DIRECT_PURCHASE' COMMENT '订单来源类型',
    `status` ENUM('PENDING', 'PAID', 'CANCELED', 'REFUNDED', 'CLOSED') NOT NULL DEFAULT 'PENDING' COMMENT '订单状态',
    `total_amount` DECIMAL(10, 2) NOT NULL COMMENT '订单总金额',
    `paid_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0 COMMENT '实付金额',
    `bonus_points` INTEGER NOT NULL DEFAULT 0 COMMENT '赠送积分',
    `start_time` DATETIME(3) NULL COMMENT '会员开始时间',
    `end_time` DATETIME(3) NULL COMMENT '会员结束时间',
    `paid_at` DATETIME(3) NULL COMMENT '支付时间',
    `canceled_at` DATETIME(3) NULL COMMENT '取消时间',
    `refunded_at` DATETIME(3) NULL COMMENT '退款时间',
    `meta_json` JSON NULL COMMENT '扩展元数据',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    UNIQUE INDEX `uk_membership_orders_order_no`(`order_no`),
    INDEX `idx_membership_orders_user_status_created_at`(`user_id`, `status`, `created_at`),
    INDEX `idx_membership_orders_plan_id`(`plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='会员订单表';

-- 创建积分充值套餐表。
CREATE TABLE `recharge_packages` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `name` VARCHAR(64) NOT NULL COMMENT '充值套餐名称',
    `label` VARCHAR(64) NULL COMMENT '套餐标签',
    `description` VARCHAR(255) NULL COMMENT '套餐描述',
    `points` INTEGER NOT NULL COMMENT '充值积分数',
    `bonus_points` INTEGER NOT NULL DEFAULT 0 COMMENT '赠送积分数',
    `price` DECIMAL(10, 2) NOT NULL COMMENT '销售价格',
    `original_price` DECIMAL(10, 2) NULL COMMENT '原价',
    `badge_text` VARCHAR(64) NULL COMMENT '角标文案',
    `is_enabled` BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用',
    `sort_order` INTEGER NOT NULL DEFAULT 0 COMMENT '排序值',
    `meta_json` JSON NULL COMMENT '扩展元数据',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    INDEX `idx_recharge_packages_enabled_sort`(`is_enabled`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='积分充值套餐表';

-- 创建积分充值订单表。
CREATE TABLE `recharge_orders` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `user_id` VARCHAR(36) NOT NULL COMMENT '用户ID',
    `recharge_package_id` VARCHAR(36) NULL COMMENT '充值套餐ID',
    `order_no` VARCHAR(64) NOT NULL COMMENT '充值订单号',
    `pay_channel` ENUM('ALIPAY', 'WECHAT', 'MANUAL', 'OTHER') NOT NULL COMMENT '支付渠道',
    `pay_status` ENUM('PENDING', 'PAID', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'PENDING' COMMENT '支付状态',
    `refund_status` ENUM('NONE', 'PROCESSING', 'REFUNDED', 'FAILED') NOT NULL DEFAULT 'NONE' COMMENT '退款状态',
    `points` INTEGER NOT NULL COMMENT '充值积分数',
    `bonus_points` INTEGER NOT NULL DEFAULT 0 COMMENT '赠送积分数',
    `total_amount` DECIMAL(10, 2) NOT NULL COMMENT '订单总金额',
    `paid_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0 COMMENT '实付金额',
    `package_snapshot_json` JSON NULL COMMENT '套餐快照',
    `paid_at` DATETIME(3) NULL COMMENT '支付时间',
    `refunded_at` DATETIME(3) NULL COMMENT '退款时间',
    `meta_json` JSON NULL COMMENT '扩展元数据',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    UNIQUE INDEX `uk_recharge_orders_order_no`(`order_no`),
    INDEX `idx_recharge_orders_user_pay_status_created_at`(`user_id`, `pay_status`, `created_at`),
    INDEX `idx_recharge_orders_package_id`(`recharge_package_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='积分充值订单表';

-- 创建卡密批次表。
CREATE TABLE `card_batches` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `name` VARCHAR(64) NOT NULL COMMENT '批次名称',
    `batch_no` VARCHAR(64) NOT NULL COMMENT '批次编号',
    `description` VARCHAR(255) NULL COMMENT '批次描述',
    `reward_type` ENUM('POINTS', 'MEMBERSHIP') NOT NULL COMMENT '奖励类型',
    `reward_points` INTEGER NOT NULL DEFAULT 0 COMMENT '奖励积分数',
    `reward_level_id` VARCHAR(36) NULL COMMENT '奖励会员等级ID',
    `reward_days` INTEGER NULL COMMENT '奖励会员天数',
    `total_count` INTEGER NOT NULL DEFAULT 0 COMMENT '卡密总数',
    `used_count` INTEGER NOT NULL DEFAULT 0 COMMENT '已使用数量',
    `expires_at` DATETIME(3) NULL COMMENT '批次过期时间',
    `is_enabled` BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用',
    `meta_json` JSON NULL COMMENT '扩展元数据',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    UNIQUE INDEX `uk_card_batches_batch_no`(`batch_no`),
    INDEX `idx_card_batches_reward_type_enabled_created_at`(`reward_type`, `is_enabled`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='卡密批次表';

-- 创建卡密表。
CREATE TABLE `card_codes` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `batch_id` VARCHAR(36) NOT NULL COMMENT '批次ID',
    `code` VARCHAR(32) NOT NULL COMMENT '卡密编码',
    `status` ENUM('UNUSED', 'USED', 'EXPIRED', 'DISABLED') NOT NULL DEFAULT 'UNUSED' COMMENT '卡密状态',
    `used_by_user_id` VARCHAR(36) NULL COMMENT '使用用户ID',
    `reward_level_id` VARCHAR(36) NULL COMMENT '奖励会员等级ID',
    `reward_snapshot_json` JSON NULL COMMENT '奖励快照',
    `expires_at` DATETIME(3) NULL COMMENT '卡密过期时间',
    `used_at` DATETIME(3) NULL COMMENT '使用时间',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    UNIQUE INDEX `uk_card_codes_code`(`code`),
    INDEX `idx_card_codes_batch_status`(`batch_id`, `status`),
    INDEX `idx_card_codes_used_by_user_id`(`used_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='卡密表';

-- 创建卡密兑换记录表。
CREATE TABLE `card_redeem_records` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `card_code_id` VARCHAR(36) NOT NULL COMMENT '卡密ID',
    `batch_id` VARCHAR(36) NOT NULL COMMENT '批次ID',
    `user_id` VARCHAR(36) NOT NULL COMMENT '兑换用户ID',
    `reward_type` ENUM('POINTS', 'MEMBERSHIP') NOT NULL COMMENT '奖励类型',
    `reward_points` INTEGER NOT NULL DEFAULT 0 COMMENT '奖励积分数',
    `reward_level_id` VARCHAR(36) NULL COMMENT '奖励会员等级ID',
    `reward_days` INTEGER NULL COMMENT '奖励会员天数',
    `remark` VARCHAR(255) NULL COMMENT '备注',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    INDEX `idx_card_redeem_records_user_created_at`(`user_id`, `created_at`),
    UNIQUE INDEX `uk_card_redeem_records_card_code_id`(`card_code_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='卡密兑换记录表';

-- 创建积分账户流水表。
CREATE TABLE `point_account_logs` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `user_id` VARCHAR(36) NOT NULL COMMENT '用户ID',
    `subscription_id` VARCHAR(36) NULL COMMENT '关联订阅ID',
    `recharge_order_id` VARCHAR(36) NULL COMMENT '关联充值订单ID',
    `account_no` VARCHAR(64) NOT NULL COMMENT '流水编号',
    `change_type` ENUM('RECHARGE', 'REWARD', 'CARD_REDEEM', 'MEMBERSHIP_BONUS', 'CONSUME', 'REFUND', 'EXPIRE', 'ADJUST') NOT NULL COMMENT '变动类型',
    `action` ENUM('INCREASE', 'DECREASE') NOT NULL COMMENT '增减方向',
    `change_amount` INTEGER NOT NULL COMMENT '变动数量',
    `balance_after` INTEGER NOT NULL COMMENT '变动后余额',
    `available_amount` INTEGER NOT NULL DEFAULT 0 COMMENT '当前记录剩余可用数量',
    `source_type` ENUM('RECHARGE_ORDER', 'MEMBERSHIP_ORDER', 'REWARD_RULE', 'CHECKIN', 'CARD_REDEEM', 'GENERATION_CONSUME', 'ADMIN_ADJUST') NOT NULL COMMENT '来源类型',
    `source_id` VARCHAR(64) NULL COMMENT '来源业务ID',
    `association_no` VARCHAR(64) NULL COMMENT '关联单号',
    `remark` VARCHAR(255) NULL COMMENT '备注',
    `expire_at` DATETIME(3) NULL COMMENT '过期时间',
    `meta_json` JSON NULL COMMENT '扩展元数据',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    UNIQUE INDEX `uk_point_account_logs_account_no`(`account_no`),
    INDEX `idx_point_account_logs_user_created_at`(`user_id`, `created_at`),
    INDEX `idx_point_account_logs_source_type_source_id`(`source_type`, `source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='积分账户流水表';

-- 创建奖励规则表。
CREATE TABLE `reward_rules` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `code` VARCHAR(50) NOT NULL COMMENT '规则编码',
    `trigger_type` ENUM('LOGIN_DAILY', 'REGISTER_ONCE', 'CHECKIN_DAILY') NOT NULL COMMENT '触发类型',
    `name` VARCHAR(64) NOT NULL COMMENT '规则名称',
    `description` VARCHAR(255) NULL COMMENT '规则描述',
    `reward_points` INTEGER NOT NULL DEFAULT 0 COMMENT '奖励积分数',
    `cycle_type` ENUM('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY') NOT NULL DEFAULT 'ONCE' COMMENT '奖励周期类型',
    `limit_per_cycle` INTEGER NOT NULL DEFAULT 1 COMMENT '周期内领取上限',
    `is_enabled` BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用',
    `condition_json` JSON NULL COMMENT '规则条件配置',
    `sort_order` INTEGER NOT NULL DEFAULT 0 COMMENT '排序值',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    UNIQUE INDEX `uk_reward_rules_code`(`code`),
    INDEX `idx_reward_rules_trigger_enabled_sort`(`trigger_type`, `is_enabled`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='奖励规则表';

-- 创建奖励领取记录表。
CREATE TABLE `reward_claim_records` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `user_id` VARCHAR(36) NOT NULL COMMENT '用户ID',
    `rule_id` VARCHAR(36) NOT NULL COMMENT '规则ID',
    `trigger_type` ENUM('LOGIN_DAILY', 'REGISTER_ONCE', 'CHECKIN_DAILY') NOT NULL COMMENT '触发类型',
    `cycle_key` VARCHAR(32) NOT NULL COMMENT '去重周期键',
    `reward_points` INTEGER NOT NULL DEFAULT 0 COMMENT '奖励积分数',
    `claim_status` ENUM('SUCCESS', 'FAILED', 'REVOKED') NOT NULL DEFAULT 'SUCCESS' COMMENT '领取状态',
    `source_id` VARCHAR(64) NULL COMMENT '来源业务ID',
    `meta_json` JSON NULL COMMENT '扩展元数据',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    INDEX `idx_reward_claim_records_user_trigger_created_at`(`user_id`, `trigger_type`, `created_at`),
    UNIQUE INDEX `uk_reward_claim_records_user_rule_cycle`(`user_id`, `rule_id`, `cycle_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='奖励领取记录表';

-- 创建用户签到记录表。
CREATE TABLE `user_checkin_records` (
    `id` VARCHAR(36) NOT NULL COMMENT '主键ID',
    `user_id` VARCHAR(36) NOT NULL COMMENT '用户ID',
    `reward_claim_id` VARCHAR(36) NULL COMMENT '奖励领取记录ID',
    `checkin_date` VARCHAR(10) NOT NULL COMMENT '签到日期',
    `consecutive_days` INTEGER NOT NULL DEFAULT 1 COMMENT '连续签到天数',
    `reward_points` INTEGER NOT NULL DEFAULT 0 COMMENT '本次签到奖励积分',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    INDEX `idx_user_checkin_records_user_created_at`(`user_id`, `created_at`),
    UNIQUE INDEX `uk_user_checkin_records_user_date`(`user_id`, `checkin_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='用户签到记录表';

-- AddForeignKey
ALTER TABLE `membership_plans` ADD CONSTRAINT `membership_plans_level_id_fkey` FOREIGN KEY (`level_id`) REFERENCES `membership_levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_level_id_fkey` FOREIGN KEY (`level_id`) REFERENCES `membership_levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `membership_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_orders` ADD CONSTRAINT `membership_orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_orders` ADD CONSTRAINT `membership_orders_level_id_fkey` FOREIGN KEY (`level_id`) REFERENCES `membership_levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_orders` ADD CONSTRAINT `membership_orders_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `membership_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recharge_orders` ADD CONSTRAINT `recharge_orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recharge_orders` ADD CONSTRAINT `recharge_orders_recharge_package_id_fkey` FOREIGN KEY (`recharge_package_id`) REFERENCES `recharge_packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `card_batches` ADD CONSTRAINT `card_batches_reward_level_id_fkey` FOREIGN KEY (`reward_level_id`) REFERENCES `membership_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `card_codes` ADD CONSTRAINT `card_codes_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `card_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `card_codes` ADD CONSTRAINT `card_codes_used_by_user_id_fkey` FOREIGN KEY (`used_by_user_id`) REFERENCES `app_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `card_codes` ADD CONSTRAINT `card_codes_reward_level_id_fkey` FOREIGN KEY (`reward_level_id`) REFERENCES `membership_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `card_redeem_records` ADD CONSTRAINT `card_redeem_records_card_code_id_fkey` FOREIGN KEY (`card_code_id`) REFERENCES `card_codes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `card_redeem_records` ADD CONSTRAINT `card_redeem_records_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `card_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `card_redeem_records` ADD CONSTRAINT `card_redeem_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `card_redeem_records` ADD CONSTRAINT `card_redeem_records_reward_level_id_fkey` FOREIGN KEY (`reward_level_id`) REFERENCES `membership_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_account_logs` ADD CONSTRAINT `point_account_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_account_logs` ADD CONSTRAINT `point_account_logs_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `user_subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_account_logs` ADD CONSTRAINT `point_account_logs_recharge_order_id_fkey` FOREIGN KEY (`recharge_order_id`) REFERENCES `recharge_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reward_claim_records` ADD CONSTRAINT `reward_claim_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reward_claim_records` ADD CONSTRAINT `reward_claim_records_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `reward_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_checkin_records` ADD CONSTRAINT `user_checkin_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_checkin_records` ADD CONSTRAINT `user_checkin_records_reward_claim_id_fkey` FOREIGN KEY (`reward_claim_id`) REFERENCES `reward_claim_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 初始化默认奖励规则。
-- 说明：
-- 1. 登录奖励：每天登录可领取一次积分。
-- 2. 注册奖励：新用户注册后仅可领取一次积分。
-- 3. 签到奖励：用户每日签到可领取一次积分。
INSERT INTO `reward_rules` (
    `id`,
    `code`,
    `trigger_type`,
    `name`,
    `description`,
    `reward_points`,
    `cycle_type`,
    `limit_per_cycle`,
    `is_enabled`,
    `condition_json`,
    `sort_order`,
    `created_at`,
    `updated_at`
) VALUES
(
    UUID(),
    'LOGIN_DAILY_DEFAULT',
    'LOGIN_DAILY',
    '登录奖励',
    '用户每日首次登录可领取积分奖励',
    5,
    'DAILY',
    1,
    TRUE,
    JSON_OBJECT('dailyLimit', 1),
    10,
    NOW(3),
    NOW(3)
),
(
    UUID(),
    'REGISTER_ONCE_DEFAULT',
    'REGISTER_ONCE',
    '注册奖励',
    '新用户完成注册后可领取一次积分奖励',
    20,
    'ONCE',
    1,
    TRUE,
    JSON_OBJECT('onceOnly', TRUE),
    20,
    NOW(3),
    NOW(3)
),
(
    UUID(),
    'CHECKIN_DAILY_DEFAULT',
    'CHECKIN_DAILY',
    '签到奖励',
    '用户每日签到可领取积分奖励',
    3,
    'DAILY',
    1,
    TRUE,
    JSON_OBJECT('dailyLimit', 1),
    30,
    NOW(3),
    NOW(3)
);
