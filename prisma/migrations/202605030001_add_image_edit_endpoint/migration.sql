ALTER TABLE `ai_providers`
  ADD COLUMN `image_edit_endpoint` VARCHAR(255) NOT NULL DEFAULT '/images/edits' COMMENT '图片编辑端点' AFTER `image_endpoint`;
