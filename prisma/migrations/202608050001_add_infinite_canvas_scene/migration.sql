-- 允许复用工作流定义/版本表保存无限画布项目。
ALTER TABLE `workflow_definitions`
  MODIFY COLUMN `scene` ENUM(
    'WORKFLOW_CANVAS',
    'INFINITE_CANVAS',
    'AGENT_WORKSPACE',
    'GENERATION_PIPELINE'
  ) NOT NULL DEFAULT 'WORKFLOW_CANVAS' COMMENT '工作流或画布使用场景';
