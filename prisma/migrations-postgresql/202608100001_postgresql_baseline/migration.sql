-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ANONYMOUS', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthMethodType" AS ENUM ('ADMIN_PASSWORD', 'PHONE_CODE', 'EMAIL_CODE', 'WECHAT_OAUTH', 'GITHUB_OAUTH', 'GOOGLE_OAUTH', 'CUSTOM_OAUTH');

-- CreateEnum
CREATE TYPE "AuthMethodCategory" AS ENUM ('PASSWORD', 'CODE', 'OAUTH');

-- CreateEnum
CREATE TYPE "VerificationChannel" AS ENUM ('PHONE', 'EMAIL');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('OPENAI_COMPATIBLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StorageProviderType" AS ENUM ('S3_COMPATIBLE');

-- CreateEnum
CREATE TYPE "ModelCategory" AS ENUM ('CHAT', 'IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "AiSkillUiMode" AS ENUM ('PLAIN_CHAT', 'WORKSPACE');

-- CreateEnum
CREATE TYPE "AiSkillExecutionMode" AS ENUM ('CHAT_ONLY', 'PLANNER_THEN_GENERATE', 'PLANNER_THEN_STORYBOARD', 'DIRECT_GENERATE');

-- CreateEnum
CREATE TYPE "AiSkillPlannerModelCategory" AS ENUM ('CHAT', 'IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "AiSkillPromptScene" AS ENUM ('CHAT', 'PLANNER');

-- CreateEnum
CREATE TYPE "WorkflowScene" AS ENUM ('WORKFLOW_CANVAS', 'INFINITE_CANVAS', 'AGENT_WORKSPACE', 'GENERATION_PIPELINE');

-- CreateEnum
CREATE TYPE "WorkflowSourceType" AS ENUM ('VISUAL', 'SKILL_TEMPLATE', 'SYSTEM_BUILTIN');

-- CreateEnum
CREATE TYPE "WorkflowDefinitionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'INTERRUPTED');

-- CreateEnum
CREATE TYPE "WorkflowNodeRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GenerationType" AS ENUM ('AGENT', 'IMAGE', 'VIDEO', 'DIGITAL_HUMAN', 'MOTION');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'STOPPED');

-- CreateEnum
CREATE TYPE "OutputType" AS ENUM ('IMAGE', 'VIDEO', 'TEXT', 'FILE');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "AssetVisibility" AS ENUM ('PRIVATE', 'PUBLIC', 'UNLISTED');

-- CreateEnum
CREATE TYPE "AssetPublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "AssetReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssetSource" AS ENUM ('GENERATED', 'UPLOADED', 'IMPORTED', 'EDITOR_UPLOAD');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('IDLE', 'THINKING', 'RUNNING', 'COMPLETED', 'ERROR', 'STOPPED');

-- CreateEnum
CREATE TYPE "AgentIndicatorStatus" AS ENUM ('IDLE', 'THINKING', 'RUNNING', 'COMPLETED', 'ERROR', 'STOPPED');

-- CreateEnum
CREATE TYPE "AgentStepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "AgentProcessSectionKind" AS ENUM ('SKILL', 'REASONING');

-- CreateEnum
CREATE TYPE "MembershipDurationType" AS ENUM ('MONTH', 'QUARTER', 'HALF_YEAR', 'YEAR', 'FOREVER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MembershipOrderSource" AS ENUM ('DIRECT_PURCHASE', 'CARD_REDEEM', 'SYSTEM_GRANT', 'ADMIN_ADJUST');

-- CreateEnum
CREATE TYPE "MembershipOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED', 'REFUNDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PayChannelType" AS ENUM ('ALIPAY', 'WECHAT', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PROCESSING', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CardRewardType" AS ENUM ('POINTS', 'MEMBERSHIP');

-- CreateEnum
CREATE TYPE "CardCodeStatus" AS ENUM ('UNUSED', 'USED', 'EXPIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PointChangeType" AS ENUM ('RECHARGE', 'REWARD', 'CARD_REDEEM', 'MEMBERSHIP_BONUS', 'CONSUME', 'REFUND', 'EXPIRE', 'ADJUST');

-- CreateEnum
CREATE TYPE "PointActionType" AS ENUM ('INCREASE', 'DECREASE');

-- CreateEnum
CREATE TYPE "PointSourceType" AS ENUM ('RECHARGE_ORDER', 'MEMBERSHIP_ORDER', 'REWARD_RULE', 'CHECKIN', 'CARD_REDEEM', 'GENERATION_CONSUME', 'ADMIN_ADJUST');

-- CreateEnum
CREATE TYPE "RewardTriggerType" AS ENUM ('LOGIN_DAILY', 'REGISTER_ONCE', 'CHECKIN_DAILY');

-- CreateEnum
CREATE TYPE "RewardCycleType" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RewardClaimStatus" AS ENUM ('SUCCESS', 'FAILED', 'REVOKED');

-- CreateTable
CREATE TABLE "app_users" (
    "id" VARCHAR(36) NOT NULL,
    "username" VARCHAR(100),
    "password_hash" VARCHAR(255),
    "name" VARCHAR(100),
    "avatar_url" TEXT,
    "email" VARCHAR(191),
    "phone" VARCHAR(32),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ANONYMOUS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" VARCHAR(36) NOT NULL,
    "operator_user_id" VARCHAR(36) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(100) NOT NULL,
    "target_id" VARCHAR(100),
    "before_json" JSONB,
    "after_json" JSONB,
    "ip_address" VARCHAR(100),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verification_codes" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36),
    "method_type" "AuthMethodType" NOT NULL,
    "channel" "VerificationChannel" NOT NULL,
    "scene" VARCHAR(50) NOT NULL DEFAULT 'login',
    "target" VARCHAR(191) NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "requester_ip" VARCHAR(100),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_method_configs" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36),
    "method_type" "AuthMethodType" NOT NULL,
    "category" "AuthMethodCategory" NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "icon_type" VARCHAR(50),
    "icon_url" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "allow_auto_fill" BOOLEAN NOT NULL DEFAULT true,
    "allow_sign_up" BOOLEAN NOT NULL DEFAULT true,
    "config_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_method_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user_auth_identities" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "method_type" "AuthMethodType" NOT NULL,
    "provider_user_id" VARCHAR(191),
    "provider_union_id" VARCHAR(191),
    "identifier" VARCHAR(191) NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT true,
    "verified_at" TIMESTAMP(3),
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_sessions" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "auth_method_type" "AuthMethodType" NOT NULL,
    "identifier_snapshot" VARCHAR(191),
    "ip_address" VARCHAR(100),
    "user_agent" VARCHAR(500),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_active_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_configs" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36),
    "scene" VARCHAR(50) NOT NULL DEFAULT 'generate',
    "name" VARCHAR(100) NOT NULL,
    "provider_type" "ProviderType" NOT NULL DEFAULT 'OPENAI_COMPATIBLE',
    "base_url" TEXT NOT NULL,
    "api_key_encrypted" TEXT,
    "api_key_hint" VARCHAR(64),
    "chat_endpoint" VARCHAR(255) NOT NULL DEFAULT '/chat/completions',
    "image_endpoint" VARCHAR(255) NOT NULL DEFAULT '/images/generations',
    "video_endpoint" VARCHAR(255) NOT NULL DEFAULT '/videos',
    "default_chat_model" VARCHAR(191),
    "default_image_model" VARCHAR(191),
    "default_video_model" VARCHAR(191),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "extra_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_custom_models" (
    "id" VARCHAR(36) NOT NULL,
    "provider_config_id" VARCHAR(36) NOT NULL,
    "category" "ModelCategory" NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "model_key" VARCHAR(191) NOT NULL,
    "capability_json" JSONB,
    "default_params_json" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_custom_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" VARCHAR(36) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "icon_url" TEXT,
    "base_url" TEXT NOT NULL,
    "api_key_encrypted" TEXT,
    "api_key_hint" VARCHAR(64),
    "chat_endpoint" VARCHAR(255) NOT NULL DEFAULT '/chat/completions',
    "image_endpoint" VARCHAR(255) NOT NULL DEFAULT '/images/generations',
    "image_edit_endpoint" VARCHAR(255) NOT NULL DEFAULT '/images/edits',
    "video_endpoint" VARCHAR(255) NOT NULL DEFAULT '/videos',
    "default_chat_model" VARCHAR(191),
    "supported_types_json" JSONB,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_built_in" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "extra_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" VARCHAR(36) NOT NULL,
    "provider_id" VARCHAR(36) NOT NULL,
    "category" "ModelCategory" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "model_key" VARCHAR(191) NOT NULL,
    "description" VARCHAR(255),
    "capability_json" JSONB,
    "default_params_json" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_built_in" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_skills" (
    "id" VARCHAR(36) NOT NULL,
    "provider_id" VARCHAR(36),
    "source_package_id" VARCHAR(36),
    "skill_key" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "icon_type" VARCHAR(50),
    "category" VARCHAR(50),
    "ui_mode" "AiSkillUiMode" NOT NULL DEFAULT 'WORKSPACE',
    "execution_mode" "AiSkillExecutionMode" NOT NULL DEFAULT 'PLANNER_THEN_GENERATE',
    "workflow_type" VARCHAR(50),
    "planner_model_category" "AiSkillPlannerModelCategory" NOT NULL DEFAULT 'CHAT',
    "expected_image_count" INTEGER NOT NULL DEFAULT 4,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_built_in" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "config_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_source_packages" (
    "id" VARCHAR(36) NOT NULL,
    "package_key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "repository_url" TEXT,
    "license_url" TEXT,
    "source_revision" VARCHAR(191),
    "integrity_sha256" VARCHAR(128),
    "terms_version" VARCHAR(100),
    "compliance_json" JSONB,
    "is_trusted" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_source_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_source_artifacts" (
    "id" VARCHAR(36) NOT NULL,
    "source_package_id" VARCHAR(36) NOT NULL,
    "artifact_path" VARCHAR(500) NOT NULL,
    "artifact_type" VARCHAR(50) NOT NULL,
    "locale" VARCHAR(32),
    "content" TEXT NOT NULL,
    "integrity_sha256" VARCHAR(128) NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_source_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_compliance_acceptances" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "source_package_id" VARCHAR(36) NOT NULL,
    "terms_version" VARCHAR(100) NOT NULL,
    "country_code" VARCHAR(8) NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB,

    CONSTRAINT "skill_compliance_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_execution_runs" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "skill_id" VARCHAR(36),
    "generation_record_id" VARCHAR(36),
    "status" VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    "plan_json" JSONB NOT NULL,
    "state_json" JSONB,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_execution_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_skill_dependencies" (
    "id" VARCHAR(36) NOT NULL,
    "skill_id" VARCHAR(36) NOT NULL,
    "dependency_skill_id" VARCHAR(36) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_skill_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_skill_prompt_templates" (
    "id" VARCHAR(36) NOT NULL,
    "skill_id" VARCHAR(36) NOT NULL,
    "scene" "AiSkillPromptScene" NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "user_prompt_template" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_skill_prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_skill_workflow_templates" (
    "id" VARCHAR(36) NOT NULL,
    "skill_id" VARCHAR(36) NOT NULL,
    "workflow_label" VARCHAR(100) NOT NULL,
    "workflow_type" VARCHAR(50) NOT NULL,
    "expected_image_count" INTEGER NOT NULL DEFAULT 4,
    "workflow_params_template_json" JSONB,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_skill_workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_skill_plan_templates" (
    "id" VARCHAR(36) NOT NULL,
    "skill_id" VARCHAR(36) NOT NULL,
    "item_key" VARCHAR(100) NOT NULL,
    "title_template" VARCHAR(255) NOT NULL,
    "prompt_template" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_skill_plan_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_skill_stage_templates" (
    "id" VARCHAR(36) NOT NULL,
    "skill_id" VARCHAR(36) NOT NULL,
    "stage_key" VARCHAR(100) NOT NULL,
    "stage_label" VARCHAR(100) NOT NULL,
    "indicator_title" VARCHAR(100),
    "indicator_description_template" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_skill_stage_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36),
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "category" VARCHAR(50),
    "scene" "WorkflowScene" NOT NULL DEFAULT 'WORKFLOW_CANVAS',
    "source_type" "WorkflowSourceType" NOT NULL DEFAULT 'VISUAL',
    "status" "WorkflowDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
    "current_version_id" VARCHAR(36),
    "latest_version_no" INTEGER NOT NULL DEFAULT 0,
    "is_built_in" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "tags_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definition_versions" (
    "id" VARCHAR(36) NOT NULL,
    "workflow_id" VARCHAR(36) NOT NULL,
    "created_by" VARCHAR(36),
    "version_no" INTEGER NOT NULL,
    "version_name" VARCHAR(100),
    "change_summary" VARCHAR(255),
    "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "definition_json" JSONB,
    "nodes_json" JSONB,
    "edges_json" JSONB,
    "viewport_json" JSONB,
    "input_schema_json" JSONB,
    "output_schema_json" JSONB,
    "runtime_config_json" JSONB,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_definition_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" VARCHAR(36) NOT NULL,
    "workflow_id" VARCHAR(36) NOT NULL,
    "workflow_version_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'PENDING',
    "executor" VARCHAR(32) NOT NULL DEFAULT 'BROWSER',
    "total_nodes" INTEGER NOT NULL DEFAULT 0,
    "completed_nodes" INTEGER NOT NULL DEFAULT 0,
    "current_node_id" VARCHAR(191),
    "error_message" TEXT,
    "result_json" JSONB,
    "heartbeat_at" TIMESTAMP(3),
    "stop_requested_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_node_runs" (
    "id" VARCHAR(36) NOT NULL,
    "workflow_run_id" VARCHAR(36) NOT NULL,
    "generation_record_id" VARCHAR(36),
    "node_id" VARCHAR(191) NOT NULL,
    "node_type" VARCHAR(50) NOT NULL,
    "label" VARCHAR(191),
    "status" "WorkflowNodeRunStatus" NOT NULL DEFAULT 'PENDING',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "output_json" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_node_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_storage_configs" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36),
    "scene" VARCHAR(50) NOT NULL DEFAULT 'global',
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "provider_type" "StorageProviderType" NOT NULL DEFAULT 'S3_COMPATIBLE',
    "access_key_encrypted" TEXT NOT NULL,
    "secret_key_encrypted" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "region" VARCHAR(100),
    "bucket" VARCHAR(255) NOT NULL,
    "domain" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 999,
    "description" VARCHAR(200),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "object_storage_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_sessions" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "source" VARCHAR(64) NOT NULL DEFAULT 'generate',
    "title" VARCHAR(120) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "last_record_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_plugins" (
    "id" VARCHAR(36) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "manifest_json" JSONB NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_plugin_releases" (
    "id" VARCHAR(36) NOT NULL,
    "plugin_id" VARCHAR(36) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "package_url" TEXT NOT NULL,
    "source_package_url" TEXT,
    "package_storage_path" TEXT,
    "package_storage_type" VARCHAR(20) NOT NULL DEFAULT 'local',
    "package_storage_code" VARCHAR(100),
    "integrity_sha256" VARCHAR(128) NOT NULL,
    "manifest_json" JSONB NOT NULL,
    "is_trusted" BOOLEAN NOT NULL DEFAULT false,
    "published_by_id" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvas_plugin_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_plugin_installs" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "plugin_id" VARCHAR(36) NOT NULL,
    "release_id" VARCHAR(36) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_plugin_installs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_prompt_sources" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36),
    "name" VARCHAR(100) NOT NULL,
    "source_url" TEXT,
    "source_kind" VARCHAR(32) NOT NULL DEFAULT 'JSON',
    "category" VARCHAR(100),
    "permission_scope" VARCHAR(32) NOT NULL DEFAULT 'PRIVATE',
    "allowed_roles_json" JSONB,
    "current_version_no" INTEGER NOT NULL DEFAULT 0,
    "last_sync_status" VARCHAR(32) NOT NULL DEFAULT 'NEVER',
    "last_sync_error" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "config_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_prompt_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_prompts" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36),
    "source_id" VARCHAR(36),
    "external_key" VARCHAR(191),
    "title" VARCHAR(191) NOT NULL,
    "content" TEXT NOT NULL,
    "summary" VARCHAR(500),
    "kind" VARCHAR(32) NOT NULL DEFAULT 'TEXT',
    "target_node_type" VARCHAR(32),
    "source_data_json" JSONB,
    "tags_json" JSONB,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_prompt_source_versions" (
    "id" VARCHAR(36) NOT NULL,
    "source_id" VARCHAR(36) NOT NULL,
    "version_no" INTEGER NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "prompt_count" INTEGER NOT NULL DEFAULT 0,
    "snapshot_json" JSONB NOT NULL,
    "change_type" VARCHAR(32) NOT NULL DEFAULT 'SYNC',
    "change_note" VARCHAR(255),
    "created_by_id" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvas_prompt_source_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_prompt_sync_runs" (
    "id" VARCHAR(36) NOT NULL,
    "source_id" VARCHAR(36) NOT NULL,
    "trigger_user_id" VARCHAR(36),
    "action" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "source_version_no" INTEGER,
    "target_version_no" INTEGER,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "detail_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "canvas_prompt_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_records" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "session_id" VARCHAR(36) NOT NULL,
    "provider_config_id" VARCHAR(36),
    "client_record_id" INTEGER,
    "type" "GenerationType" NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT NOT NULL,
    "content" TEXT,
    "error_message" TEXT,
    "model_label" VARCHAR(100),
    "model_key" VARCHAR(191),
    "ratio" VARCHAR(32),
    "resolution" VARCHAR(64),
    "duration_label" VARCHAR(64),
    "feature" VARCHAR(100),
    "skill" VARCHAR(100),
    "agent_task_id" VARCHAR(191),
    "meta_json" JSONB,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_outputs" (
    "id" VARCHAR(36) NOT NULL,
    "generation_record_id" VARCHAR(36) NOT NULL,
    "output_type" "OutputType" NOT NULL,
    "url" TEXT,
    "text_content" TEXT,
    "mime_type" VARCHAR(100),
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "file_size_bytes" BIGINT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_items" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "generation_record_id" VARCHAR(36),
    "generation_output_id" VARCHAR(36),
    "asset_type" "AssetType" NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "cover_url" TEXT,
    "file_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "file_size_bytes" BIGINT,
    "mime_type" VARCHAR(128),
    "prompt_text" TEXT,
    "model_label" VARCHAR(100),
    "aspect_ratio" VARCHAR(32),
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "publish_status" "AssetPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "review_status" "AssetReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "source" "AssetSource" NOT NULL DEFAULT 'GENERATED',
    "source_meta_json" JSONB,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_projects" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "thumbnail" TEXT,
    "version" INTEGER NOT NULL DEFAULT 3,
    "metadata_json" JSONB NOT NULL,
    "settings_json" JSONB NOT NULL,
    "scenes_json" JSONB NOT NULL,
    "timeline_view_state_json" JSONB,
    "agent_messages_json" JSONB,
    "current_scene_id" VARCHAR(64),
    "duration_seconds" INTEGER,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_favorites" (
    "id" VARCHAR(36) NOT NULL,
    "asset_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" VARCHAR(36) NOT NULL,
    "generation_record_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "query" TEXT NOT NULL,
    "skill" VARCHAR(100),
    "status" "AgentRunStatus" NOT NULL DEFAULT 'IDLE',
    "agent_name" VARCHAR(100),
    "agent_avatar_url" TEXT,
    "indicator_status" "AgentIndicatorStatus" DEFAULT 'IDLE',
    "indicator_title" VARCHAR(100),
    "indicator_description" TEXT,
    "result_title" VARCHAR(255),
    "result_summary" TEXT,
    "expected_image_count" INTEGER DEFAULT 0,
    "output_visible" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "stop_reason" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_run_steps" (
    "id" VARCHAR(36) NOT NULL,
    "agent_run_id" VARCHAR(36) NOT NULL,
    "step_key" VARCHAR(100) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "status" "AgentStepStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_process_sections" (
    "id" VARCHAR(36) NOT NULL,
    "agent_run_id" VARCHAR(36) NOT NULL,
    "section_key" VARCHAR(100) NOT NULL,
    "kind" "AgentProcessSectionKind" NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "paragraphs_json" JSONB,
    "task_items_json" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_collapsed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_process_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_levels" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "level" INTEGER NOT NULL,
    "description" VARCHAR(255),
    "icon_url" TEXT,
    "monthly_bonus_points" INTEGER NOT NULL DEFAULT 0,
    "storage_capacity" BIGINT NOT NULL DEFAULT 0,
    "benefits_json" JSONB,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" VARCHAR(36) NOT NULL,
    "level_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "label" VARCHAR(64),
    "description" VARCHAR(255),
    "duration_type" "MembershipDurationType" NOT NULL,
    "duration_value" INTEGER NOT NULL DEFAULT 1,
    "duration_unit" VARCHAR(20) NOT NULL DEFAULT 'month',
    "sales_price" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2),
    "bonus_points" INTEGER NOT NULL DEFAULT 0,
    "benefits_json" JSONB,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "level_id" VARCHAR(36) NOT NULL,
    "order_id" VARCHAR(36),
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_orders" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "level_id" VARCHAR(36) NOT NULL,
    "plan_id" VARCHAR(36),
    "order_no" VARCHAR(64) NOT NULL,
    "source_type" "MembershipOrderSource" NOT NULL DEFAULT 'DIRECT_PURCHASE',
    "status" "MembershipOrderStatus" NOT NULL DEFAULT 'PENDING',
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bonus_points" INTEGER NOT NULL DEFAULT 0,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recharge_packages" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "label" VARCHAR(64),
    "description" VARCHAR(255),
    "points" INTEGER NOT NULL,
    "bonus_points" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2),
    "badge_text" VARCHAR(64),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recharge_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recharge_orders" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "recharge_package_id" VARCHAR(36),
    "order_no" VARCHAR(64) NOT NULL,
    "pay_channel" "PayChannelType" NOT NULL,
    "pay_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "refund_status" "RefundStatus" NOT NULL DEFAULT 'NONE',
    "points" INTEGER NOT NULL,
    "bonus_points" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "package_snapshot_json" JSONB,
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recharge_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_batches" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "batch_no" VARCHAR(64) NOT NULL,
    "description" VARCHAR(255),
    "reward_type" "CardRewardType" NOT NULL,
    "reward_points" INTEGER NOT NULL DEFAULT 0,
    "reward_level_id" VARCHAR(36),
    "reward_days" INTEGER,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_codes" (
    "id" VARCHAR(36) NOT NULL,
    "batch_id" VARCHAR(36) NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "status" "CardCodeStatus" NOT NULL DEFAULT 'UNUSED',
    "used_by_user_id" VARCHAR(36),
    "reward_level_id" VARCHAR(36),
    "reward_snapshot_json" JSONB,
    "expires_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_redeem_records" (
    "id" VARCHAR(36) NOT NULL,
    "card_code_id" VARCHAR(36) NOT NULL,
    "batch_id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "reward_type" "CardRewardType" NOT NULL,
    "reward_points" INTEGER NOT NULL DEFAULT 0,
    "reward_level_id" VARCHAR(36),
    "reward_days" INTEGER,
    "remark" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_redeem_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_account_logs" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "subscription_id" VARCHAR(36),
    "recharge_order_id" VARCHAR(36),
    "account_no" VARCHAR(64) NOT NULL,
    "change_type" "PointChangeType" NOT NULL,
    "action" "PointActionType" NOT NULL,
    "change_amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "available_amount" INTEGER NOT NULL DEFAULT 0,
    "source_type" "PointSourceType" NOT NULL,
    "source_id" VARCHAR(64),
    "association_no" VARCHAR(64),
    "remark" VARCHAR(255),
    "expire_at" TIMESTAMP(3),
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "point_account_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_rules" (
    "id" VARCHAR(36) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "trigger_type" "RewardTriggerType" NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" VARCHAR(255),
    "reward_points" INTEGER NOT NULL DEFAULT 0,
    "cycle_type" "RewardCycleType" NOT NULL DEFAULT 'ONCE',
    "limit_per_cycle" INTEGER NOT NULL DEFAULT 1,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "condition_json" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_claim_records" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "rule_id" VARCHAR(36) NOT NULL,
    "trigger_type" "RewardTriggerType" NOT NULL,
    "cycle_key" VARCHAR(32) NOT NULL,
    "reward_points" INTEGER NOT NULL DEFAULT 0,
    "claim_status" "RewardClaimStatus" NOT NULL DEFAULT 'SUCCESS',
    "source_id" VARCHAR(64),
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_claim_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_checkin_records" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "reward_claim_id" VARCHAR(36),
    "checkin_date" VARCHAR(10) NOT NULL,
    "consecutive_days" INTEGER NOT NULL DEFAULT 1,
    "reward_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_checkin_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" VARCHAR(36) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "config_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uk_app_users_username" ON "app_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "uk_app_users_email" ON "app_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uk_app_users_phone" ON "app_users"("phone");

-- CreateIndex
CREATE INDEX "idx_admin_audit_logs_operator_created_at" ON "admin_audit_logs"("operator_user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_admin_audit_logs_target_created_at" ON "admin_audit_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_admin_audit_logs_action_created_at" ON "admin_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "idx_auth_verification_codes_method_target_scene_created_at" ON "auth_verification_codes"("method_type", "target", "scene", "created_at");

-- CreateIndex
CREATE INDEX "idx_auth_verification_codes_expires_at" ON "auth_verification_codes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "uk_auth_method_configs_method_type" ON "auth_method_configs"("method_type");

-- CreateIndex
CREATE INDEX "idx_auth_method_configs_enabled_visible_sort" ON "auth_method_configs"("is_enabled", "is_visible", "sort_order");

-- CreateIndex
CREATE INDEX "idx_app_user_auth_identities_user_method" ON "app_user_auth_identities"("user_id", "method_type");

-- CreateIndex
CREATE UNIQUE INDEX "uk_app_user_auth_identities_method_identifier" ON "app_user_auth_identities"("method_type", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "uk_app_user_auth_identities_method_provider_user_id" ON "app_user_auth_identities"("method_type", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_app_sessions_token_hash" ON "app_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_app_sessions_user_expires_at" ON "app_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "idx_app_sessions_expires_at" ON "app_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "idx_ai_provider_configs_user_scene" ON "ai_provider_configs"("user_id", "scene");

-- CreateIndex
CREATE INDEX "idx_ai_provider_configs_user_default" ON "ai_provider_configs"("user_id", "is_default");

-- CreateIndex
CREATE INDEX "idx_ai_provider_custom_models_config_category_sort" ON "ai_provider_custom_models"("provider_config_id", "category", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uk_ai_provider_custom_models_config_category_key" ON "ai_provider_custom_models"("provider_config_id", "category", "model_key");

-- CreateIndex
CREATE UNIQUE INDEX "uk_ai_providers_code" ON "ai_providers"("code");

-- CreateIndex
CREATE INDEX "idx_ai_providers_enabled_sort" ON "ai_providers"("is_enabled", "sort_order");

-- CreateIndex
CREATE INDEX "idx_ai_models_provider_category_sort" ON "ai_models"("provider_id", "category", "sort_order");

-- CreateIndex
CREATE INDEX "idx_ai_models_enabled_category" ON "ai_models"("is_enabled", "category");

-- CreateIndex
CREATE UNIQUE INDEX "uk_ai_models_provider_category_key" ON "ai_models"("provider_id", "category", "model_key");

-- CreateIndex
CREATE UNIQUE INDEX "uk_ai_skills_skill_key" ON "ai_skills"("skill_key");

-- CreateIndex
CREATE INDEX "idx_ai_skills_provider_id" ON "ai_skills"("provider_id");

-- CreateIndex
CREATE INDEX "idx_ai_skills_source_package_id" ON "ai_skills"("source_package_id");

-- CreateIndex
CREATE INDEX "idx_ai_skills_enabled_sort" ON "ai_skills"("is_enabled", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uk_skill_source_packages_package_key" ON "skill_source_packages"("package_key");

-- CreateIndex
CREATE INDEX "idx_skill_source_packages_trusted_enabled" ON "skill_source_packages"("is_trusted", "is_enabled", "updated_at");

-- CreateIndex
CREATE INDEX "idx_skill_source_artifacts_package_type" ON "skill_source_artifacts"("source_package_id", "artifact_type");

-- CreateIndex
CREATE UNIQUE INDEX "uk_skill_source_artifacts_package_path" ON "skill_source_artifacts"("source_package_id", "artifact_path");

-- CreateIndex
CREATE INDEX "idx_skill_compliance_acceptances_package_terms" ON "skill_compliance_acceptances"("source_package_id", "terms_version");

-- CreateIndex
CREATE UNIQUE INDEX "uk_skill_compliance_acceptances_user_package_terms" ON "skill_compliance_acceptances"("user_id", "source_package_id", "terms_version");

-- CreateIndex
CREATE INDEX "idx_skill_execution_runs_user_status_created" ON "skill_execution_runs"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "idx_skill_execution_runs_generation_record" ON "skill_execution_runs"("generation_record_id");

-- CreateIndex
CREATE INDEX "idx_ai_skill_dependencies_skill_sort" ON "ai_skill_dependencies"("skill_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uk_ai_skill_dependencies_skill_dependency" ON "ai_skill_dependencies"("skill_id", "dependency_skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_ai_skill_prompt_templates_skill_scene" ON "ai_skill_prompt_templates"("skill_id", "scene");

-- CreateIndex
CREATE INDEX "idx_ai_skill_workflow_templates_skill" ON "ai_skill_workflow_templates"("skill_id");

-- CreateIndex
CREATE INDEX "idx_ai_skill_plan_templates_skill_sort" ON "ai_skill_plan_templates"("skill_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uk_ai_skill_plan_templates_skill_item_key" ON "ai_skill_plan_templates"("skill_id", "item_key");

-- CreateIndex
CREATE INDEX "idx_ai_skill_stage_templates_skill_sort" ON "ai_skill_stage_templates"("skill_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uk_ai_skill_stage_templates_skill_stage_key" ON "ai_skill_stage_templates"("skill_id", "stage_key");

-- CreateIndex
CREATE UNIQUE INDEX "uk_workflow_definitions_code" ON "workflow_definitions"("code");

-- CreateIndex
CREATE INDEX "idx_workflow_definitions_user_scene_status" ON "workflow_definitions"("user_id", "scene", "status");

-- CreateIndex
CREATE INDEX "idx_workflow_definitions_enabled_sort" ON "workflow_definitions"("is_enabled", "sort_order");

-- CreateIndex
CREATE INDEX "idx_workflow_definition_versions_workflow_status_created_at" ON "workflow_definition_versions"("workflow_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uk_workflow_definition_versions_workflow_version" ON "workflow_definition_versions"("workflow_id", "version_no");

-- CreateIndex
CREATE INDEX "idx_workflow_runs_workflow_created_at" ON "workflow_runs"("workflow_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_workflow_runs_user_status_created_at" ON "workflow_runs"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "idx_workflow_runs_status_heartbeat_at" ON "workflow_runs"("status", "heartbeat_at");

-- CreateIndex
CREATE INDEX "idx_workflow_node_runs_run_sort" ON "workflow_node_runs"("workflow_run_id", "sort_order");

-- CreateIndex
CREATE INDEX "idx_workflow_node_runs_generation_record" ON "workflow_node_runs"("generation_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_workflow_node_runs_run_node" ON "workflow_node_runs"("workflow_run_id", "node_id");

-- CreateIndex
CREATE INDEX "idx_object_storage_configs_user_scene" ON "object_storage_configs"("user_id", "scene");

-- CreateIndex
CREATE INDEX "idx_object_storage_configs_scene_default" ON "object_storage_configs"("scene", "is_default");

-- CreateIndex
CREATE INDEX "idx_object_storage_configs_scene_enabled_sort" ON "object_storage_configs"("scene", "is_enabled", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uk_object_storage_configs_scene_code" ON "object_storage_configs"("scene", "code");

-- CreateIndex
CREATE INDEX "idx_generation_sessions_user_default_updated_at" ON "generation_sessions"("user_id", "is_default", "updated_at");

-- CreateIndex
CREATE INDEX "idx_generation_sessions_user_last_record_at" ON "generation_sessions"("user_id", "last_record_at");

-- CreateIndex
CREATE INDEX "idx_generation_sessions_user_source_last_record_at" ON "generation_sessions"("user_id", "source", "last_record_at");

-- CreateIndex
CREATE UNIQUE INDEX "uk_canvas_plugins_slug" ON "canvas_plugins"("slug");

-- CreateIndex
CREATE INDEX "idx_canvas_plugins_enabled_updated" ON "canvas_plugins"("is_enabled", "updated_at");

-- CreateIndex
CREATE INDEX "idx_canvas_plugin_releases_plugin_created" ON "canvas_plugin_releases"("plugin_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uk_canvas_plugin_releases_plugin_version" ON "canvas_plugin_releases"("plugin_id", "version");

-- CreateIndex
CREATE INDEX "idx_canvas_plugin_installs_user_enabled" ON "canvas_plugin_installs"("user_id", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "uk_canvas_plugin_installs_user_plugin" ON "canvas_plugin_installs"("user_id", "plugin_id");

-- CreateIndex
CREATE INDEX "idx_canvas_prompt_sources_user_enabled" ON "canvas_prompt_sources"("user_id", "is_enabled", "updated_at");

-- CreateIndex
CREATE INDEX "idx_canvas_prompts_user_enabled" ON "canvas_prompts"("user_id", "is_enabled", "updated_at");

-- CreateIndex
CREATE INDEX "idx_canvas_prompts_source_enabled" ON "canvas_prompts"("source_id", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "uk_canvas_prompts_source_external" ON "canvas_prompts"("source_id", "external_key");

-- CreateIndex
CREATE INDEX "idx_canvas_prompt_source_versions_source_created" ON "canvas_prompt_source_versions"("source_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uk_canvas_prompt_source_versions_source_version" ON "canvas_prompt_source_versions"("source_id", "version_no");

-- CreateIndex
CREATE INDEX "idx_canvas_prompt_sync_runs_source_created" ON "canvas_prompt_sync_runs"("source_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_generation_records_user_created_at" ON "generation_records"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_generation_records_session_created_at" ON "generation_records"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_generation_records_type_status_created_at" ON "generation_records"("type", "status", "created_at");

-- CreateIndex
CREATE INDEX "idx_generation_records_provider_created_at" ON "generation_records"("provider_config_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_generation_outputs_record_sort" ON "generation_outputs"("generation_record_id", "sort_order");

-- CreateIndex
CREATE INDEX "idx_generation_outputs_type_created_at" ON "generation_outputs"("output_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_asset_items_user_type_created_at" ON "asset_items"("user_id", "asset_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_asset_items_public_feed" ON "asset_items"("asset_type", "visibility", "publish_status", "review_status", "created_at");

-- CreateIndex
CREATE INDEX "idx_asset_items_generation_record_id" ON "asset_items"("generation_record_id");

-- CreateIndex
CREATE INDEX "idx_asset_items_generation_output_id" ON "asset_items"("generation_output_id");

-- CreateIndex
CREATE INDEX "idx_video_projects_user_updated_at" ON "video_projects"("user_id", "is_deleted", "updated_at");

-- CreateIndex
CREATE INDEX "idx_asset_favorites_user_created_at" ON "asset_favorites"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uk_asset_favorites_asset_user" ON "asset_favorites"("asset_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_agent_runs_generation_record_id" ON "agent_runs"("generation_record_id");

-- CreateIndex
CREATE INDEX "idx_agent_runs_user_created_at" ON "agent_runs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_agent_runs_status_created_at" ON "agent_runs"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_agent_run_steps_run_sort" ON "agent_run_steps"("agent_run_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uk_agent_run_steps_run_step_key" ON "agent_run_steps"("agent_run_id", "step_key");

-- CreateIndex
CREATE INDEX "idx_agent_process_sections_run_sort" ON "agent_process_sections"("agent_run_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uk_agent_process_sections_run_section_key" ON "agent_process_sections"("agent_run_id", "section_key");

-- CreateIndex
CREATE INDEX "idx_membership_levels_enabled_sort" ON "membership_levels"("is_enabled", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uk_membership_levels_level" ON "membership_levels"("level");

-- CreateIndex
CREATE INDEX "idx_membership_plans_level_enabled_sort" ON "membership_plans"("level_id", "is_enabled", "sort_order");

-- CreateIndex
CREATE INDEX "idx_user_subscriptions_user_status_end_time" ON "user_subscriptions"("user_id", "status", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "uk_user_subscriptions_user_level" ON "user_subscriptions"("user_id", "level_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_membership_orders_order_no" ON "membership_orders"("order_no");

-- CreateIndex
CREATE INDEX "idx_membership_orders_user_status_created_at" ON "membership_orders"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "idx_membership_orders_plan_id" ON "membership_orders"("plan_id");

-- CreateIndex
CREATE INDEX "idx_recharge_packages_enabled_sort" ON "recharge_packages"("is_enabled", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uk_recharge_orders_order_no" ON "recharge_orders"("order_no");

-- CreateIndex
CREATE INDEX "idx_recharge_orders_user_pay_status_created_at" ON "recharge_orders"("user_id", "pay_status", "created_at");

-- CreateIndex
CREATE INDEX "idx_recharge_orders_package_id" ON "recharge_orders"("recharge_package_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_card_batches_batch_no" ON "card_batches"("batch_no");

-- CreateIndex
CREATE INDEX "idx_card_batches_reward_type_enabled_created_at" ON "card_batches"("reward_type", "is_enabled", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uk_card_codes_code" ON "card_codes"("code");

-- CreateIndex
CREATE INDEX "idx_card_codes_batch_status" ON "card_codes"("batch_id", "status");

-- CreateIndex
CREATE INDEX "idx_card_codes_used_by_user_id" ON "card_codes"("used_by_user_id");

-- CreateIndex
CREATE INDEX "idx_card_redeem_records_user_created_at" ON "card_redeem_records"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uk_card_redeem_records_card_code_id" ON "card_redeem_records"("card_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_point_account_logs_account_no" ON "point_account_logs"("account_no");

-- CreateIndex
CREATE INDEX "idx_point_account_logs_user_created_at" ON "point_account_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_point_account_logs_source_type_source_id" ON "point_account_logs"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_reward_rules_code" ON "reward_rules"("code");

-- CreateIndex
CREATE INDEX "idx_reward_rules_trigger_enabled_sort" ON "reward_rules"("trigger_type", "is_enabled", "sort_order");

-- CreateIndex
CREATE INDEX "idx_reward_claim_records_user_trigger_created_at" ON "reward_claim_records"("user_id", "trigger_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uk_reward_claim_records_user_rule_cycle" ON "reward_claim_records"("user_id", "rule_id", "cycle_key");

-- CreateIndex
CREATE INDEX "idx_user_checkin_records_user_created_at" ON "user_checkin_records"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uk_user_checkin_records_user_date" ON "user_checkin_records"("user_id", "checkin_date");

-- CreateIndex
CREATE UNIQUE INDEX "uk_system_settings_code" ON "system_settings"("code");

-- AddForeignKey
ALTER TABLE "auth_verification_codes" ADD CONSTRAINT "auth_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_method_configs" ADD CONSTRAINT "auth_method_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user_auth_identities" ADD CONSTRAINT "app_user_auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user_auth_identities" ADD CONSTRAINT "app_user_auth_identities_method_type_fkey" FOREIGN KEY ("method_type") REFERENCES "auth_method_configs"("method_type") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_sessions" ADD CONSTRAINT "app_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_provider_configs" ADD CONSTRAINT "ai_provider_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_provider_custom_models" ADD CONSTRAINT "ai_provider_custom_models_provider_config_id_fkey" FOREIGN KEY ("provider_config_id") REFERENCES "ai_provider_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_skills" ADD CONSTRAINT "ai_skills_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_skills" ADD CONSTRAINT "ai_skills_source_package_id_fkey" FOREIGN KEY ("source_package_id") REFERENCES "skill_source_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_source_artifacts" ADD CONSTRAINT "skill_source_artifacts_source_package_id_fkey" FOREIGN KEY ("source_package_id") REFERENCES "skill_source_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_compliance_acceptances" ADD CONSTRAINT "skill_compliance_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_compliance_acceptances" ADD CONSTRAINT "skill_compliance_acceptances_source_package_id_fkey" FOREIGN KEY ("source_package_id") REFERENCES "skill_source_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_execution_runs" ADD CONSTRAINT "skill_execution_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_skill_dependencies" ADD CONSTRAINT "ai_skill_dependencies_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "ai_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_skill_dependencies" ADD CONSTRAINT "ai_skill_dependencies_dependency_skill_id_fkey" FOREIGN KEY ("dependency_skill_id") REFERENCES "ai_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_skill_prompt_templates" ADD CONSTRAINT "ai_skill_prompt_templates_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "ai_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_skill_workflow_templates" ADD CONSTRAINT "ai_skill_workflow_templates_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "ai_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_skill_plan_templates" ADD CONSTRAINT "ai_skill_plan_templates_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "ai_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_skill_stage_templates" ADD CONSTRAINT "ai_skill_stage_templates_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "ai_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "workflow_definition_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_definition_versions" ADD CONSTRAINT "workflow_definition_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_definition_versions" ADD CONSTRAINT "workflow_definition_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_definition_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_node_runs" ADD CONSTRAINT "workflow_node_runs_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_node_runs" ADD CONSTRAINT "workflow_node_runs_generation_record_id_fkey" FOREIGN KEY ("generation_record_id") REFERENCES "generation_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_storage_configs" ADD CONSTRAINT "object_storage_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_sessions" ADD CONSTRAINT "generation_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_plugin_releases" ADD CONSTRAINT "canvas_plugin_releases_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "canvas_plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_plugin_installs" ADD CONSTRAINT "canvas_plugin_installs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_plugin_installs" ADD CONSTRAINT "canvas_plugin_installs_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "canvas_plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_prompt_sources" ADD CONSTRAINT "canvas_prompt_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_prompts" ADD CONSTRAINT "canvas_prompts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_prompts" ADD CONSTRAINT "canvas_prompts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "canvas_prompt_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_prompt_source_versions" ADD CONSTRAINT "canvas_prompt_source_versions_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "canvas_prompt_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_prompt_sync_runs" ADD CONSTRAINT "canvas_prompt_sync_runs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "canvas_prompt_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_records" ADD CONSTRAINT "generation_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_records" ADD CONSTRAINT "generation_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "generation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_records" ADD CONSTRAINT "generation_records_provider_config_id_fkey" FOREIGN KEY ("provider_config_id") REFERENCES "ai_provider_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_outputs" ADD CONSTRAINT "generation_outputs_generation_record_id_fkey" FOREIGN KEY ("generation_record_id") REFERENCES "generation_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_items" ADD CONSTRAINT "asset_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_items" ADD CONSTRAINT "asset_items_generation_record_id_fkey" FOREIGN KEY ("generation_record_id") REFERENCES "generation_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_items" ADD CONSTRAINT "asset_items_generation_output_id_fkey" FOREIGN KEY ("generation_output_id") REFERENCES "generation_outputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_favorites" ADD CONSTRAINT "asset_favorites_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_favorites" ADD CONSTRAINT "asset_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_generation_record_id_fkey" FOREIGN KEY ("generation_record_id") REFERENCES "generation_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run_steps" ADD CONSTRAINT "agent_run_steps_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_process_sections" ADD CONSTRAINT "agent_process_sections_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "membership_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "membership_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "membership_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_orders" ADD CONSTRAINT "membership_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_orders" ADD CONSTRAINT "membership_orders_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "membership_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_orders" ADD CONSTRAINT "membership_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recharge_orders" ADD CONSTRAINT "recharge_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recharge_orders" ADD CONSTRAINT "recharge_orders_recharge_package_id_fkey" FOREIGN KEY ("recharge_package_id") REFERENCES "recharge_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_batches" ADD CONSTRAINT "card_batches_reward_level_id_fkey" FOREIGN KEY ("reward_level_id") REFERENCES "membership_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_codes" ADD CONSTRAINT "card_codes_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "card_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_codes" ADD CONSTRAINT "card_codes_used_by_user_id_fkey" FOREIGN KEY ("used_by_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_codes" ADD CONSTRAINT "card_codes_reward_level_id_fkey" FOREIGN KEY ("reward_level_id") REFERENCES "membership_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_redeem_records" ADD CONSTRAINT "card_redeem_records_card_code_id_fkey" FOREIGN KEY ("card_code_id") REFERENCES "card_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_redeem_records" ADD CONSTRAINT "card_redeem_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "card_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_redeem_records" ADD CONSTRAINT "card_redeem_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_redeem_records" ADD CONSTRAINT "card_redeem_records_reward_level_id_fkey" FOREIGN KEY ("reward_level_id") REFERENCES "membership_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_account_logs" ADD CONSTRAINT "point_account_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_account_logs" ADD CONSTRAINT "point_account_logs_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "user_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_account_logs" ADD CONSTRAINT "point_account_logs_recharge_order_id_fkey" FOREIGN KEY ("recharge_order_id") REFERENCES "recharge_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claim_records" ADD CONSTRAINT "reward_claim_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_claim_records" ADD CONSTRAINT "reward_claim_records_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "reward_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_checkin_records" ADD CONSTRAINT "user_checkin_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_checkin_records" ADD CONSTRAINT "user_checkin_records_reward_claim_id_fkey" FOREIGN KEY ("reward_claim_id") REFERENCES "reward_claim_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
