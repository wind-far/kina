-- 为用户表增加角色字段，用于正式区分普通用户与后台管理员。
ALTER TABLE `app_users`
  ADD COLUMN `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER' AFTER `phone`;
