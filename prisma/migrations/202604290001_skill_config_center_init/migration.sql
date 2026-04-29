-- 技能配置中心初始化迁移
-- 说明：
-- 1. 新增技能主表、依赖表、提示词模板表、工作流模板表、计划模板表、阶段模板表
-- 2. 预置 general、ecommerce-pack、poster-design 三个内置技能
-- 3. 所有表结构和字段注释均使用中文，便于后续后台维护

CREATE TABLE ai_skills (
  id VARCHAR(36) NOT NULL COMMENT '技能主键 ID',
  provider_id VARCHAR(36) NULL COMMENT '关联默认厂商 ID，可为空',
  skill_key VARCHAR(100) NOT NULL COMMENT '技能唯一标识',
  label VARCHAR(100) NOT NULL COMMENT '技能展示名称',
  description VARCHAR(255) NULL COMMENT '技能描述',
  icon_type VARCHAR(50) NULL COMMENT '技能图标类型',
  category VARCHAR(50) NULL COMMENT '技能分类',
  ui_mode ENUM('PLAIN_CHAT', 'WORKSPACE') NOT NULL DEFAULT 'WORKSPACE' COMMENT '前端交互模式',
  execution_mode ENUM('CHAT_ONLY', 'PLANNER_THEN_GENERATE', 'PLANNER_THEN_STORYBOARD', 'DIRECT_GENERATE') NOT NULL DEFAULT 'PLANNER_THEN_GENERATE' COMMENT '技能执行模式',
  workflow_type VARCHAR(50) NULL COMMENT '默认工作流类型',
  planner_model_category ENUM('CHAT', 'IMAGE', 'VIDEO') NOT NULL DEFAULT 'CHAT' COMMENT '规划器模型分类',
  expected_image_count INT NOT NULL DEFAULT 4 COMMENT '默认期望图片数量',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  is_built_in TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否内置技能',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序值',
  config_json JSON NULL COMMENT '技能扩展配置 JSON',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_ai_skills_skill_key (skill_key),
  KEY idx_ai_skills_provider_id (provider_id),
  KEY idx_ai_skills_enabled_sort (is_enabled, sort_order),
  CONSTRAINT fk_ai_skills_provider_id FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='技能配置主表';

CREATE TABLE ai_skill_dependencies (
  id VARCHAR(36) NOT NULL COMMENT '依赖关系主键 ID',
  skill_id VARCHAR(36) NOT NULL COMMENT '主技能 ID',
  dependency_skill_id VARCHAR(36) NOT NULL COMMENT '依赖技能 ID',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '依赖排序值',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_ai_skill_dependencies_skill_dependency (skill_id, dependency_skill_id),
  KEY idx_ai_skill_dependencies_skill_sort (skill_id, sort_order),
  CONSTRAINT fk_ai_skill_dependencies_skill_id FOREIGN KEY (skill_id) REFERENCES ai_skills(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ai_skill_dependencies_dependency_skill_id FOREIGN KEY (dependency_skill_id) REFERENCES ai_skills(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='技能依赖关系表';

CREATE TABLE ai_skill_prompt_templates (
  id VARCHAR(36) NOT NULL COMMENT '提示词模板主键 ID',
  skill_id VARCHAR(36) NOT NULL COMMENT '技能 ID',
  scene ENUM('CHAT', 'PLANNER') NOT NULL COMMENT '模板场景',
  system_prompt LONGTEXT NOT NULL COMMENT '系统提示词',
  user_prompt_template LONGTEXT NOT NULL COMMENT '用户提示词模板',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_ai_skill_prompt_templates_skill_scene (skill_id, scene),
  CONSTRAINT fk_ai_skill_prompt_templates_skill_id FOREIGN KEY (skill_id) REFERENCES ai_skills(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='技能提示词模板表';

CREATE TABLE ai_skill_workflow_templates (
  id VARCHAR(36) NOT NULL COMMENT '工作流模板主键 ID',
  skill_id VARCHAR(36) NOT NULL COMMENT '技能 ID',
  workflow_label VARCHAR(100) NOT NULL COMMENT '工作流展示名称',
  workflow_type VARCHAR(50) NOT NULL COMMENT '工作流类型',
  expected_image_count INT NOT NULL DEFAULT 4 COMMENT '默认图片数量',
  workflow_params_template_json JSON NULL COMMENT '工作流参数模板 JSON',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_ai_skill_workflow_templates_skill (skill_id),
  CONSTRAINT fk_ai_skill_workflow_templates_skill_id FOREIGN KEY (skill_id) REFERENCES ai_skills(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='技能工作流模板表';

CREATE TABLE ai_skill_plan_templates (
  id VARCHAR(36) NOT NULL COMMENT '计划模板主键 ID',
  skill_id VARCHAR(36) NOT NULL COMMENT '技能 ID',
  item_key VARCHAR(100) NOT NULL COMMENT '计划项标识',
  title_template VARCHAR(255) NOT NULL COMMENT '计划项标题模板',
  prompt_template LONGTEXT NOT NULL COMMENT '图片提示词模板',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序值',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_ai_skill_plan_templates_skill_item_key (skill_id, item_key),
  KEY idx_ai_skill_plan_templates_skill_sort (skill_id, sort_order),
  CONSTRAINT fk_ai_skill_plan_templates_skill_id FOREIGN KEY (skill_id) REFERENCES ai_skills(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='技能计划项模板表';

CREATE TABLE ai_skill_stage_templates (
  id VARCHAR(36) NOT NULL COMMENT '阶段模板主键 ID',
  skill_id VARCHAR(36) NOT NULL COMMENT '技能 ID',
  stage_key VARCHAR(100) NOT NULL COMMENT '阶段标识',
  stage_label VARCHAR(100) NOT NULL COMMENT '阶段标题',
  indicator_title VARCHAR(100) NULL COMMENT '指示器标题',
  indicator_description_template LONGTEXT NULL COMMENT '指示器描述模板',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序值',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_ai_skill_stage_templates_skill_stage_key (skill_id, stage_key),
  KEY idx_ai_skill_stage_templates_skill_sort (skill_id, sort_order),
  CONSTRAINT fk_ai_skill_stage_templates_skill_id FOREIGN KEY (skill_id) REFERENCES ai_skills(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='技能阶段文案模板表';

-- 初始化内置技能主数据
INSERT INTO ai_skills (
  id, provider_id, skill_key, label, description, icon_type, category, ui_mode, execution_mode,
  workflow_type, planner_model_category, expected_image_count, is_enabled, is_built_in, sort_order, config_json
) VALUES
  ('skill_general_builtin', NULL, 'general', '通用助手', '通用对话与创意辅助技能', 'message', 'assistant', 'PLAIN_CHAT', 'CHAT_ONLY', NULL, 'CHAT', 0, 1, 1, 0, NULL),
  ('skill_ecommerce_builtin', NULL, 'ecommerce-pack', '电商套图', '面向电商商品的主图、卖点图、场景图和细节图生成技能', 'shop', 'commerce', 'WORKSPACE', 'PLANNER_THEN_GENERATE', 'text_to_image', 'CHAT', 4, 1, 1, 10, JSON_OBJECT('result_parser', 'text_to_image_default')),
  ('skill_poster_builtin', NULL, 'poster-design', '海报设计', '面向品牌宣传与营销传播的海报设计技能', 'poster', 'marketing', 'WORKSPACE', 'PLANNER_THEN_GENERATE', 'text_to_image', 'CHAT', 4, 1, 1, 20, JSON_OBJECT('workspace_skill_key', 'image-poster', 'dependency_skill_keys', JSON_ARRAY('image-main'), 'result_parser', 'text_to_image_default'));

-- 初始化提示词模板
INSERT INTO ai_skill_prompt_templates (id, skill_id, scene, system_prompt, user_prompt_template, is_enabled) VALUES
  ('skill_prompt_general_chat', 'skill_general_builtin', 'CHAT', '你是一个中文创作助理。请准确理解用户需求，优先给出结构清晰、直接可执行的结果。', '{{input}}', 1),
  ('skill_prompt_ecommerce_chat', 'skill_ecommerce_builtin', 'CHAT', '你是一名电商视觉策划与商品拍摄导演。请把用户需求整理为适合电商商品套图生成的视觉方案。要强调主图、卖点图、场景图、细节图的一致风格。', '请将下面需求整理成电商套图策划案。\n\n用户原始需求：\n{{input}}\n\n生成要求：\n1. 突出商品主体、材质、卖点与适用场景\n2. 保持整套视觉风格统一\n3. 描述要适合商品主图与详情图生成\n4. 输出中文', 1),
  ('skill_prompt_ecommerce_planner', 'skill_ecommerce_builtin', 'PLANNER', '你是一个 AI 技能工作流规划器，需要把电商套图需求转成结构化执行计划。', '请根据用户需求输出 analysis_lines、workflow_label、workflow_params、plan_items、image_tasks、submit_lines，所有字段必须使用中文。\n用户需求：{{input}}', 1),
  ('skill_prompt_poster_chat', 'skill_poster_builtin', 'CHAT', '你是一名海报创意总监。请将用户需求扩展为适合宣传海报生产的视觉创意与文案结构。重点关注主视觉、版式焦点、气氛与传播主题。', '请将下面需求整理成海报设计方案。\n\n用户原始需求：\n{{input}}\n\n生成要求：\n1. 突出海报主题与视觉焦点\n2. 补充氛围、色彩、构图与文字区域预留建议\n3. 结果适合后续图像生成\n4. 输出中文', 1),
  ('skill_prompt_poster_planner', 'skill_poster_builtin', 'PLANNER', '你是一个 AI 技能工作流规划器，需要把海报设计需求转成结构化执行计划。', '请根据用户需求输出 analysis_lines、workflow_label、workflow_params、plan_items、image_tasks、submit_lines，所有字段必须使用中文。\n用户需求：{{input}}', 1);

-- 初始化工作流模板
INSERT INTO ai_skill_workflow_templates (
  id, skill_id, workflow_label, workflow_type, expected_image_count, workflow_params_template_json, is_enabled
) VALUES
  ('workflow_ecommerce_default', 'skill_ecommerce_builtin', '电商套图', 'text_to_image', 4, JSON_OBJECT('image_prompt', '电商商品视觉主图，主体清晰，棚拍级打光，商业修图质感，背景简洁，突出商品卖点与品牌调性，适合电商套图起始图。需求：{{input}}'), 1),
  ('workflow_poster_default', 'skill_poster_builtin', '海报设计', 'text_to_image', 4, JSON_OBJECT('image_prompt', '创意宣传海报主视觉，构图鲜明，视觉中心突出，具备营销传播感与版式空间，适合活动海报或品牌宣传。需求：{{input}}'), 1);

-- 初始化计划模板
INSERT INTO ai_skill_plan_templates (
  id, skill_id, item_key, title_template, prompt_template, sort_order, is_enabled
) VALUES
  ('plan_ecommerce_main', 'skill_ecommerce_builtin', 'main', '商品主图', '{{base_prompt}}，电商主图风格，主体清晰，背景干净，卖点突出。', 10, 1),
  ('plan_ecommerce_scene', 'skill_ecommerce_builtin', 'scene', '场景展示', '{{base_prompt}}，加入真实使用场景，强化代入感与生活方式表达。', 20, 1),
  ('plan_ecommerce_detail', 'skill_ecommerce_builtin', 'detail', '卖点细节', '{{base_prompt}}，突出材质、工艺和功能细节，商业摄影质感。', 30, 1),
  ('plan_ecommerce_brand', 'skill_ecommerce_builtin', 'brand', '氛围延展', '{{base_prompt}}，做一张偏品牌感的延展海报，兼顾商品与情绪氛围。', 40, 1),
  ('plan_poster_main', 'skill_poster_builtin', 'main', '主视觉构图', '{{base_prompt}}，海报主视觉方案一，强调唯一视觉中心、主体识别度、营销传播感与纵深空间。', 10, 1),
  ('plan_poster_layout', 'skill_poster_builtin', 'layout', '版式留白', '{{base_prompt}}，海报主视觉方案二，强化版式设计与留白控制，预留清晰主标题、副标题和辅助卖点排版空间。', 20, 1),
  ('plan_poster_mood', 'skill_poster_builtin', 'mood', '氛围强化', '{{base_prompt}}，海报主视觉方案三，强化色彩氛围、光影戏剧感和商业传播张力。', 30, 1),
  ('plan_poster_detail', 'skill_poster_builtin', 'detail', '细节特写', '{{base_prompt}}，海报主视觉方案四，突出局部细节、材质层次与高级设计语言。', 40, 1);

-- 初始化阶段模板
INSERT INTO ai_skill_stage_templates (
  id, skill_id, stage_key, stage_label, indicator_title, indicator_description_template, sort_order, is_enabled
) VALUES
  ('stage_ecommerce_analyze', 'skill_ecommerce_builtin', 'reasoning-analyze', '需求分析', '再思考片刻...', '正在理解你的意图，并匹配合适的电商套图工作流。', 10, 1),
  ('stage_ecommerce_plan', 'skill_ecommerce_builtin', 'reasoning-plan', '任务规划', '准备生成方案', '已根据技能指南确定电商套图执行方案。', 20, 1),
  ('stage_ecommerce_submit', 'skill_ecommerce_builtin', 'reasoning-submit', '提交任务', '提交生成任务', '正在把电商套图子任务提交到图片生成服务。', 30, 1),
  ('stage_poster_analyze', 'skill_poster_builtin', 'reasoning-analyze', '需求分析', '再思考片刻...', '正在理解你的意图，并匹配合适的海报设计工作流。', 10, 1),
  ('stage_poster_dependency', 'skill_poster_builtin', 'reasoning-dependency', '依赖技能', '读取技能指南', '正在加载海报设计所需的依赖技能。', 20, 1),
  ('stage_poster_plan', 'skill_poster_builtin', 'reasoning-plan', '任务规划', '准备生成方案', '已根据技能指南确定海报设计执行方案。', 30, 1),
  ('stage_poster_submit', 'skill_poster_builtin', 'reasoning-submit', '提交任务', '提交生成任务', '正在把海报设计子任务提交到图片生成服务。', 40, 1);
