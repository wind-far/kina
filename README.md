## ⚠️ 免责声明 (Disclaimer)

本项目（kina）是一个包含 Vue 3 创作端、Node/Prisma 服务端与运营后台的 **AI 创作平台原型**，用于展示 Agent、多模态生成、无限画布、可视化工作流及平台运营能力的技术实现。

1. **非官方产品**：本项目**并非**任何商业AI平台（包括但不限于即梦AI、字节跳动旗下产品）的官方软件、破解版或衍生品。项目名称、图标及视觉设计均与上述平台无关。
2. **仅供学习与研究**：本项目代码以 MIT 协议开源，**仅限于技术学习、研究与个人非商业用途**。开发者不鼓励、不支持任何侵犯第三方知识产权的行为。
3. **版权与风险提示**：本项目的界面布局、交互逻辑可能涉及第三方（如即梦AI）的独创性设计。**任何个人或组织若将本项目用于商业目的，须自行承担因界面相似性引发的全部版权侵权、不正当竞争等法律风险与后果**。项目原作者不承担任何连带或赔偿责任。
4. **使用即同意**：一旦您使用、复制、修改或分发本项目代码，即表示您已阅读并同意本免责声明的所有条款。若您不同意，请立即停止使用并删除本项目。

# Kina

> 一站式 AI 创作与后台运营平台

## 项目背景

面向内容创作者、营销运营和小型创意团队，传统 AI 创作流程通常分散在对话、图片生成、视频生成、画布、素材管理和剪辑等多个工具中，存在创作上下文容易丢失、提示词与模型参数难以复用、长任务状态不可追踪，以及生成结果难以继续编辑和沉淀等问题。

多模型接入还会带来能力协议不统一、参考素材传输方式不同、生成质量与成本难治理等平台问题。Kina 希望将这些分散环节连接为可执行、可追踪、可复用的创作过程。

## 平台定位

Kina 定位为集 **Agent 创作、图片及视频生成、无限画布、可视化工作流、视频编辑和资产管理** 于一体的 AI 创作与运营平台，同时为平台运营人员提供模型、厂商、技能、存储、用户、会员积分和生成记录等后台能力。

核心产品链路：

`创意输入 → Agent/技能规划 → 多模态生成 → 画布组织 → 工作流复用 → 视频编辑 → 资产沉淀`

Kina 的重点不是增加一个孤立的生成入口，而是让创作过程具备以下特征：

- **可执行**：将自然语言需求转成模型参数、生成任务或工作流节点
- **可追踪**：记录任务、节点、模型、状态、输出及异常信息
- **可恢复**：页面刷新或服务异常后仍能恢复任务状态，支持停止与失败重试
- **可复用**：将有效创作方式沉淀为技能、Prompt、模板和工作流版本
- **可运营**：统一管理模型厂商、内容资产、用户权限、积分和运行配置

## 职责描述

本项目围绕以下产品与工程建设职责展开：

1. **产品规划与创作链路设计**：围绕多工具切换、上下文断裂和生成结果难复用等问题，拆解创作者、营销运营和平台管理员的核心需求，规划 Agent、图片、视频、无限画布、工作流、视频编辑及资产中心等模块，并形成 PRD、功能边界和验收口径。
2. **Agent 与技能体系设计**：设计“意图理解—信息澄清—技能选择—任务规划—生成执行—结果回传”的 Agent 链路，将 Prompt、执行模式、模型类型、工作流模板和阶段状态抽象为可配置技能。
3. **多模态模型接入设计**：梳理对话、视觉理解、图片生成、图片编辑和视频生成等能力，建立厂商、模型、端点、默认参数和能力标签配置，并处理不同厂商在参考图、任务查询和媒体返回协议上的差异。
4. **无限画布与可视化工作流**：设计素材上传、自由布局、撤销重做、自动保存、版本冲突及导入导出能力；通过 DAG 校验、拓扑执行、版本快照、运行记录和失败节点重试，使单次创作方法能够沉淀为可复用流程。
5. **长任务体验与稳定性设计**：针对图片、视频等长耗时任务，建设任务落库、SSE 进度推送、状态快照、断线恢复、停止生成、服务重启恢复及并发控制机制。
6. **运营后台与数据闭环**：建设用户、会话、生成记录、内容资产、模型厂商、技能、存储、会员积分和审计日志等运营模块，并围绕成功率、生成时延、失败重试、结果复用和单位成本设计观察口径。

## 项目成果

- 建成包含 **Vue 3 主应用、React 无限画布、Node 服务、Prisma/PostgreSQL 数据层及运营后台** 的全栈平台原型。
- 形成图片、视频、Agent 对话、Agent 工作台和深度研究 **5 类任务执行策略**，统一任务状态、输出记录和 SSE 事件协议。
- 落地自由布局无限画布，以及文生图、文生图生视频、故事板、多角度故事板 **4 类内置工作流模板**。
- 实现工作流版本快照、DAG 校验、服务端拓扑执行、运行记录、刷新恢复和失败节点重试。
- 建立覆盖用户、模型、技能、工作流、生成任务、媒体资产、视频工程和会员积分等业务域的 Prisma 数据结构。
- 建设模型厂商、技能、资产、用户、会话、生成记录、营销、存储、Redis 和审计等后台管理能力。

> 当前仓库处于功能原型与工程验证阶段。上述成果来自代码、数据结构和自动化检查，不代表已经获得真实 DAU、留存、付费转化或生产规模结论；模型效果、生成成本和线上稳定性仍需结合真实厂商与运行数据验证。

## 📚 项目文档

- [Kina 产品需求文档（PRD V1.0）](docs/KINA_PRD_V1.0.md)
- [无限画布与工作流功能状态](docs/CANVAS_WORKFLOW_STATUS.md)
- [智能画布本地参考页规格](docs/CANVAS_REFERENCE_SPEC.md)
- [2026-08-07 发布说明](docs/RELEASE_NOTES_2026-08-07.md)

## 🧭 产品组成

### 前台创作端

- 对话式 AI 创作入口
- 多创作模式切换：`Agent / 图片生成 / 视频生成`
- 会话列表、会话切换、重命名、删除
- 生成过程状态展示与结果流转（基于 SSE 实时推送）
- 无限画布、创作区
- 可视化工作流：节点拖拽、连线、撤销/重做、模板插入、版本回滚

### 后台运营端

- 仪表盘与运营工作台
- 资源管理（全站资源、服务端分页、筛选、批量操作）
- 生成记录管理（任务状态、模型、用户维度筛选）
- 会话管理、会话配置（生成进度文案、入口展示、列表字段）
- 技能管理、厂商配置、模型管理、对象存储配置
- 用户管理、营销中心（会员/积分/卡密/奖励）、系统设置
- 登录方式配置（验证码 / OAuth）
- Redis 健康监控、主题色配置

### 服务端能力

- 独立 Node 服务承载 `/api/...`（基于策略模式的轻量分发，未引入 Express/Koa）
- Prisma 管理数据库结构与迁移（50+ 数据模型）
- 生成任务统一调度（图片 / 视频 / Agent 对话 / Agent 工作台 / 深度研究五类策略）
- AI 网关统一转发上游 OpenAI 兼容厂商
- 系统设置、会话配置、积分/营销/资源等数据接口
- 本地存储与 S3 兼容对象存储双通道
- 任务级 SSE 事件总线（本地 EventEmitter + Redis Pub/Sub 双通道）

## ✨ 当前已实现的核心能力

### 创作与会话

- 多模式创作入口与模式配置
- 会话列表与真正可用的会话交互
- 会话管理后台
- 会话配置中心
- 生成进度文案配置与前台联动
- 任务级 SSE 流式订阅（`connected / snapshot / progress / content_delta / agent_event / completed / failed / stopped`）

### 可视化工作流

- 基于 Vue Flow 的画布交互（节点 / 边 / 视口 / 撤销重做 / 小地图）
- 6 类自定义节点：`text / imageConfig / image / videoConfig / video / llmConfig`
- 3 类自定义边：`imageRole / promptOrder / imageOrder`
- 4 类内置工作流模板：`text_to_image / text_to_image_to_video / storyboard / multi_angle_storyboard`
- 工作流定义入库与版本快照（`WorkflowDefinition + WorkflowDefinitionVersion`）
- 历史版本回滚会创建新草稿版本，不覆盖既有快照
- 整图运行前校验依赖图，由服务端按拓扑顺序执行 LLM / 图片 / 视频生成节点
- 页面关闭后服务端任务继续运行；重新进入可恢复运行状态和结果，失败或中断后可从失败节点重试
- 节点生成统一通过任务事件订阅获取进度

无限画布与工作流的当前完成度、运行边界和验收步骤见 [功能状态说明](docs/CANVAS_WORKFLOW_STATUS.md)。

### 管理后台

- 用户管理、资源管理
- 会话管理、会话配置
- 生成记录管理
- 技能管理、厂商配置、存储配置
- 营销中心、系统设置、Redis 监控、主题色配置

### 基础设施

- Prisma 数据库模型与迁移（当前 Schema 使用 PostgreSQL）
- 本地上传与对象存储上传（含路径穿越保护）
- 管理员权限路由守卫
- 登录方式配置与后台管理（验证码 + 多平台 OAuth）
- 任务限流（固定窗口）与并发控制（用户 / 厂商 / 技能三维）
- Docker 单容器统一部署链路

## 🚀 快速开始

### 环境要求

- `Node.js >= 20.19.0`
- `pnpm 11`（仓库声明版本：`pnpm@11.11.0`）
- `PostgreSQL 17+`（Prisma 连接数据库）
- `Redis`（可选；用于任务运行态、缓存、跨实例事件广播）

### 安装依赖

```bash
pnpm install
```

### 本地开发

```bash
pnpm dev
```

该命令会同时启动：

- 前端开发服务：`http://localhost:5010`
- 本地后端服务：`http://localhost:5409`

### Redis 可选配置

如果你希望启用任务运行态共享、配置缓存和跨实例事件广播，可以补充以下环境变量：

```env
REDIS_ENABLED=true
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DATABASE=1
REDIS_PREFIX=canana
REDIS_ENV=development
REDIS_URL=
REDIS_DEFAULT_TTL_SECONDS=60
REDIS_TASK_RUNTIME_TTL_SECONDS=1800
REDIS_TASK_SNAPSHOT_TTL_SECONDS=1800
REDIS_TASK_ABORT_TTL_SECONDS=300
REDIS_TASK_LOCK_TTL_MS=30000
REDIS_TASK_IDEMPOTENCY_TTL_SECONDS=600
REDIS_TASK_CONCURRENCY_TTL_SECONDS=1800
REDIS_RATE_LIMIT_WINDOW_SECONDS=60
REDIS_TASK_SUBMIT_RATE_LIMIT=6
REDIS_TASK_USER_CONCURRENCY_LIMIT=3
REDIS_TASK_PROVIDER_CONCURRENCY_LIMIT=8
REDIS_TASK_SKILL_CONCURRENCY_LIMIT=4
REDIS_AUTH_VERIFICATION_RATE_LIMIT=5
REDIS_AUTH_LOGIN_RATE_LIMIT=10
```

说明：

- `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`、`REDIS_DATABASE` 为推荐写法
- `REDIS_URL` 为兼容保留字段，不填时会根据以上拆分字段自动拼接
- `REDIS_PREFIX`、`REDIS_ENV` 以及各类 TTL 配置均为可选项，不配置会使用服务端默认值
当前实现支持“无 Redis 降级运行”：

- 未配置 Redis：继续使用本机内存态，不影响现有开发流程
- 已配置 Redis：额外启用共享任务运行态、SSE 事件广播和运行时缓存

后台可通过以下接口快速验证 Redis 是否联通：

```text
GET /api/system-config/admin/redis-health
```

该接口需要管理员登录态。

### 生成 Prisma Client

```bash
pnpm prisma:generate
```

### 开发库迁移

```bash
pnpm prisma:migrate:dev
```

### 类型检查

```bash
pnpm type-check
```

### 前端构建

```bash
pnpm build
```

### 生产启动

```bash
pnpm start
```

生产启动流程会自动处理：

1. `prisma migrate deploy`
2. 启动服务端
3. 由服务端统一托管前端静态资源与 API

## 🖼️ 图片生成与编辑链路

当前项目已经将“纯文生图”和“带参考图的图片编辑”拆成两条长期可维护的正式链路。

### 后台供应商配置

后台 `厂商配置` 页面现在支持以下图片相关端点：

- `图片生成端点`：默认 `/images/generations`
- `图片编辑端点`：默认 `/images/edits`

- 文生图：`/v1/images/generations`
- 图编辑：`/v1/images/edits`

### 生成页行为

- 没有参考图时：走标准图片生成接口
- 有参考图时：自动切换到图片编辑接口
- 服务端生成任务会按 `requestMode` 分流，不再把参考图继续塞进旧 JSON 请求体


其中图片编辑请求会发送如下核心字段：

- `model`
- `prompt`
- `n`
- `size`（有值时发送）
- 一个或多个 `image`

## 🎬 视频生成与参考图链路

视频任务支持文生视频、图生视频和工作流视频节点。参考图会先被规范化为服务端可持久访问的资源，再按不同厂商的接口协议发送：

- `auto`：默认策略；OpenAI 官方端点使用 multipart 文件，其余厂商默认使用 HTTPS URL
- `url`：向上游发送公网 HTTPS 图片 URL
- `file`：由服务端读取参考图并以 multipart 文件上传

管理员可在 `厂商配置` 中选择参考图传输方式，也可通过环境变量配置：

```env
# 站内 /uploads 图片转换为厂商可访问 URL 时使用；必须为公网 HTTPS 地址
VIDEO_REFERENCE_PUBLIC_BASE_URL=https://your-domain.com

# 可选：url 或 file；省略时自动判断
VIDEO_PROVIDER_REFERENCE_TRANSPORT=url
```

注意：

- URL 模式不接受 localhost、内网、保留地址或携带凭据的 URL
- 使用公网对象存储且上传结果已包含公网地址时，可不配置 `VIDEO_REFERENCE_PUBLIC_BASE_URL`
- 页面停止任务会终止本地请求和轮询，但第三方视频任务是否真正取消取决于厂商协议
- 视频任务的参考素材数量、字段角色和格式仍以所选模型能力为准

## 🐳 Docker 部署

仓库已提供：

- `Dockerfile`
- `docker-compose.yml`

### 推荐最小环境变量

```env
APP_PORT=5409
VITE_API_BASE_URL=https://你的域名或接口地址
VIDEO_REFERENCE_PUBLIC_BASE_URL=https://你的域名或接口地址
STATIC_DIST_DIR=/app/dist
UPLOADS_DIR=/app/uploads
CORS_ALLOWED_ORIGINS=https://你的前端域名
SERVER_HOST=127.0.0.1
DATABASE_URL=postgresql://用户名:密码@数据库地址:5432/canvasmind
PROVIDER_CONFIG_SECRET=请替换成你自己的密钥
STORAGE_CONFIG_SECRET=
AUTH_LOGIN_CODE_EXPIRE_MINUTES=5
AUTH_SESSION_EXPIRE_DAYS=30
REDIS_ENABLED=true
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DATABASE=1
REDIS_PREFIX=canana
REDIS_ENV=production
REDIS_URL=
```

### 启动方式

```bash
docker compose pull
docker compose up -d --force-recreate --remove-orphans
```

如果需要本机构建镜像：

```bash
docker build -t canana-vue:latest .
docker compose up -d --force-recreate --remove-orphans
```

## 🧩 常用脚本

```bash
pnpm dev
pnpm build
pnpm build:service
pnpm start
pnpm preview
pnpm type-check
pnpm test:scripts
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:migrate:deploy:local
pnpm prisma:migrate:deploy:prod
```

## 🗂️ 当前项目结构

```text
kina/
├── src/                              # Vue 3 前端
│   ├── api/                          # 前端 API 封装（含 admin/ai-gateway/storage/...）
│   ├── components/                   # 公共组件 + 业务组件
│   ├── composables/                  # 通用组合式函数（分页、画布、视口、拖拽等）
│   ├── config/                       # 模型与技能配置常量
│   ├── router/                       # 路由配置（含管理后台守卫）
│   ├── shared/                       # 前后端共享类型与协议
│   ├── stores/                       # 全局状态（轻量 Composable Store）
│   ├── styles/                       # 全局样式
│   ├── utils/                        # 通用工具（请求、SSE、错误处理）
│   └── views/
│       ├── generate/                 # 创作与生成页面
│       ├── workflow/                 # 可视化工作流（components/composables/config/api）
│       ├── infinite-canvas-replica/  # 无限画布入口与宿主集成
│       ├── agentic-assets-canvas/    # 画布 / 工作流项目工作台
│       ├── video-editor/             # 视频工程与编辑器
│       ├── home/                     # 首页
│       ├── account/                  # 账户中心
│       ├── publish/                  # 发布中心
│       ├── asset/                    # 资源管理
│       ├── install/                  # 系统初始化引导
│       ├── policies/                 # 政策协议页
│       └── admin/                    # 管理后台
│           ├── assets/               # 资源管理
│           ├── conversations/        # 会话管理 / 会话配置
│           ├── dashboard/            # 后台首页
│           ├── generations/          # 生成记录管理
│           ├── marketing/            # 营销中心
│           ├── providers/            # 厂商配置
│           ├── plugins/              # 画布插件管理
│           ├── redis/                # Redis 健康监控
│           ├── skills/               # 技能管理
│           ├── storage/              # 存储配置
│           ├── system/               # 系统设置
│           ├── theme/                # 主题色配置
│           └── users/                # 用户管理
├── src-infinite-canvas/               # React 无限画布工作台源码
├── server/                           # 独立 Node 后端（无 Express/Koa）
│   ├── ai-gateway/                   # AI 上游网关转发
│   ├── auth/                         # 验证码、管理员密码与 OAuth 认证
│   ├── admin-dashboard/              # 后台仪表盘接口
│   ├── admin-generation-sessions/    # 后台会话/生成接口
│   ├── admin-marketing/              # 营销中心后台接口
│   ├── admin-users/                  # 用户后台接口
│   ├── asset-items/                  # 资源中心接口
│   ├── canvas-plugins/               # 受信画布插件管理
│   ├── canvas-projects/              # 画布项目接口
│   ├── canvas-prompts/               # 画布提示词库与来源
│   ├── conversation-settings/        # 会话配置接口
│   ├── generation-records/           # 生成记录
│   ├── generation-sessions/          # 会话数据
│   ├── generation-tasks/             # 生成任务调度（核心，含 SSE 事件总线）
│   ├── marketing-center/             # 营销中心前台接口
│   ├── provider-config/              # 厂商配置
│   ├── research/                     # 深度研究执行链路
│   ├── skill-config/                 # 技能配置
│   ├── storage/                      # 上传服务
│   ├── storage-config/               # 对象存储配置
│   ├── system-config/                # 系统设置
│   ├── system-init/                  # 首次初始化
│   ├── video-projects/               # 视频工程接口
│   ├── workflow-definitions/         # 工作流定义与版本
│   ├── workflow-runs/                # 工作流运行与节点状态
│   ├── redis/                        # Redis 全套能力（缓存/锁/限流/Pub-Sub）
│   ├── db/                           # Prisma 客户端单例
│   └── shared/                       # 共享日志
├── prisma/
│   ├── schema.prisma                 # PostgreSQL 数据模型与枚举
│   └── migrations/                   # 数据库迁移
├── docs/                             # PRD、功能状态、规格与发布说明
├── scripts/                          # 构建、生产启动、类清理脚本
├── public/                           # 公共静态资源
├── uploads/                          # 本地上传根目录（运行时）
├── dist/                             # 前端构建产物
├── dist-service/                     # 后端独立打包产物
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🧠 后台模块说明

### `仪表盘`

- 总览统计（用户、会话、生成、资源等）
- 最近若干天的逐日趋势统计
- 当前默认厂商概览

### `会话管理`

- 查看全站会话
- 服务端分页、筛选、详情抽屉
- 支持会话标题维护
- 会话记录明细联查

### `会话配置`

- 基础规则
- 列表展示字段
- 入口展示配置
- 管理策略
- 生成进度文案配置

### `生成记录管理`

- 任务状态、模型、用户维度筛选
- 服务端分页与详情联查

### `资源管理`

- 我的资源 / 全站资源切换
- 用户维度筛选
- 服务端分页
- 批量操作

### `系统设置`

- 站点信息
- 政策协议
- 登录方式管理

### `技能 / 厂商 / 存储`

- 技能启用、状态管理、提示词模板
- 厂商模型与服务配置（含图编辑端点）
- 对象存储配置与本地回退

### `Redis 监控 / 主题配置`

- Redis 健康状态、运行时配置查看
- 主题色与布局配置



## 🖼️ 存储与上传

### 本地上传

- 上传接口：`POST /api/storage/upload`
- 默认公开访问前缀：`/uploads/...`
- 默认目录：`uploads/`

### 对象存储

当前支持统一的 **S3 兼容对象存储**：

- 配置接口：`/api/storage/configs`
- 上传接口：`/api/storage/upload`
- 上传策略：**优先上传启用中的对象存储；未配置时自动回退本地存储**

对象存储配置项包括：

- 名称
- 编码
- Access Key
- Secret Key
- Endpoint
- Bucket
- 域名
- 区域
- 排序
- 描述
- 状态

## 🔐 登录与权限

后台路由已接入管理员权限控制：

- 普通用户不可访问 `/admin/...`
- 管理后台包含独立的访问拒绝页
- 登录方式支持验证码与 OAuth 配置

当前后台已提供登录方式管理能力：

- 手机验证码登录
- 邮箱验证码登录
- 微信 OAuth
- GitHub OAuth
- Google OAuth
- 自定义 OAuth

## 📦 技术栈

### 前端

- `Vue 3`（主应用，`<script setup>` + Composition API）
- `React 19`（无限画布工作台）
- `Vue Router 4`
- `Vite 7`
- `TypeScript 5`
- `Element Plus`
- `Vue Flow`（`@vue-flow/core / background / minimap`）— 可视化工作流画布
- `Tailwind CSS 4`（通过 `@tailwindcss/vite`）

### 后端

- `Node.js >= 20.19.0`
- 原生 `node:http`（基于策略表的轻量路由分发）
- `Prisma 7` + `@prisma/adapter-pg`
- `PostgreSQL 17+`
- `ioredis`（可选，用于限流、锁、Pub/Sub、缓存）
- `@aws-sdk/client-s3`（S3 兼容对象存储）
- `tsx`（开发态热更新）+ `esbuild`（生产打包）

## 📄 License

MIT

## 🔗 相关链接

- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vitejs.dev/)
- [Vue Flow 文档](https://vueflow.dev/)
- [Element Plus 文档](https://element-plus.org/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- [Prisma 文档](https://www.prisma.io/docs)
- [即梦AI](https://jimeng.jianying.com/) - 字节跳动AI创作平台
- [Dreamina](https://www.capcut.com/ai-tool/platform) - 剪映AI创作工具
---

**kina** - 让 AI 创作更简单 🎨✨
