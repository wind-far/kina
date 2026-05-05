-- 首次安装初始化：补充管理员账号密码能力与安装状态所需字段。

ALTER TABLE `app_user_auth_identities`
  DROP FOREIGN KEY `fk_app_user_auth_identities_method_type`;

ALTER TABLE `app_users`
  ADD COLUMN `username` VARCHAR(100) NULL COMMENT '管理员账号用户名' AFTER `id`,
  ADD COLUMN `password_hash` VARCHAR(255) NULL COMMENT '管理员账号密码哈希' AFTER `username`,
  ADD UNIQUE INDEX `uk_app_users_username` (`username`);

ALTER TABLE `auth_verification_codes`
  MODIFY `method_type` ENUM('ADMIN_PASSWORD', 'PHONE_CODE', 'EMAIL_CODE', 'WECHAT_OAUTH', 'GITHUB_OAUTH', 'GOOGLE_OAUTH', 'CUSTOM_OAUTH') NOT NULL COMMENT '登录方式类型';

ALTER TABLE `auth_method_configs`
  MODIFY `method_type` ENUM('ADMIN_PASSWORD', 'PHONE_CODE', 'EMAIL_CODE', 'WECHAT_OAUTH', 'GITHUB_OAUTH', 'GOOGLE_OAUTH', 'CUSTOM_OAUTH') NOT NULL COMMENT '登录方式类型',
  MODIFY `category` ENUM('PASSWORD', 'CODE', 'OAUTH') NOT NULL COMMENT '登录方式分类';

ALTER TABLE `app_user_auth_identities`
  MODIFY `method_type` ENUM('ADMIN_PASSWORD', 'PHONE_CODE', 'EMAIL_CODE', 'WECHAT_OAUTH', 'GITHUB_OAUTH', 'GOOGLE_OAUTH', 'CUSTOM_OAUTH') NOT NULL COMMENT '登录方式类型';

ALTER TABLE `app_sessions`
  MODIFY `auth_method_type` ENUM('ADMIN_PASSWORD', 'PHONE_CODE', 'EMAIL_CODE', 'WECHAT_OAUTH', 'GITHUB_OAUTH', 'GOOGLE_OAUTH', 'CUSTOM_OAUTH') NOT NULL COMMENT '登录方式类型';

ALTER TABLE `app_user_auth_identities`
  ADD CONSTRAINT `fk_app_user_auth_identities_method_type`
  FOREIGN KEY (`method_type`) REFERENCES `auth_method_configs`(`method_type`) ON DELETE CASCADE ON UPDATE CASCADE;
