-- 插件运行时只能加载服务端已经校验并托管的镜像，保留源地址用于审计与重新发布。
ALTER TABLE `canvas_plugin_releases`
  ADD COLUMN `source_package_url` TEXT NULL,
  ADD COLUMN `package_storage_path` TEXT NULL,
  ADD COLUMN `package_storage_type` VARCHAR(20) NOT NULL DEFAULT 'local',
  ADD COLUMN `package_storage_code` VARCHAR(100) NULL;
