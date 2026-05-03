## ⚠️ 免责声明 (Disclaimer)

本项目（CanvasMind）是一个基于 Vue 3 的**前端交互框架与界面演示原型**，旨在展示无限画布、拖拽交互及 AI 对话界面的技术实现。

1. **非官方产品**：本项目**并非**任何商业AI平台（包括但不限于即梦AI、字节跳动旗下产品）的官方软件、破解版或衍生品。项目名称、图标及视觉设计均与上述平台无关。
2. **仅供学习与研究**：本项目代码以 MIT 协议开源，**仅限于技术学习、研究与个人非商业用途**。开发者不鼓励、不支持任何侵犯第三方知识产权的行为。
3. **版权与风险提示**：本项目的界面布局、交互逻辑可能涉及第三方（如即梦AI）的独创性设计。**任何个人或组织若将本项目用于商业目的，须自行承担因界面相似性引发的全部版权侵权、不正当竞争等法律风险与后果**。项目原作者（xpnobug）不承担任何连带或赔偿责任。
4. **使用即同意**：一旦您使用、复制、修改或分发本项目代码，即表示您已阅读并同意本免责声明的所有条款。若您不同意，请立即停止使用并删除本项目。

# CanvasMind

> 一站式 AI 创作与后台运营平台

`CanvasMind` 一个包含 **Vue 3 前台创作端 + Node/Prisma 后台服务 + 管理后台** 的完整项目骨架。

当前项目重点覆盖：

- AI 创作入口与多模式生成体验
- 会话系统、生成记录、资源管理
- 技能、模型、厂商、存储等后台配置能力
- 营销中心、用户管理、登录方式管理
- Prisma + MySQL 的可落库服务端结构

## 🎯 当前项目定位

### 前台创作端

- 对话式 AI 创作入口
- 多创作模式切换：`Agent / 图片生成 / 视频生成 / 数字人 / 动作模仿`
- 会话列表、会话切换、重命名、删除
- 生成过程状态展示与结果流转
- 无限画布 / 创作区 / 工作流等页面能力

### 后台运营端

- 仪表盘与运营工作台
- 资源管理（全站资源、服务端分页、筛选）
- 会话管理、会话配置
- 技能管理、模型厂商配置、对象存储配置
- 用户管理、营销中心、系统设置
- 登录方式配置（验证码 / OAuth）

### 服务端能力

- 独立 Node 服务承载 `/api/...`
- Prisma 管理数据库结构与迁移
- 系统设置、会话配置、积分/营销/资源等数据接口
- 本地存储与 S3 兼容对象存储双通道

## ✨ 当前已实现的核心能力

### 创作与会话

- 多模式创作入口与模式配置
- 会话列表与真正可用的会话交互
- 会话管理后台
- 会话配置中心
- 生成进度文案配置与前台联动

### 管理后台

- 后台统一布局、主题色与筛选区风格
- 通用分页能力与服务端分页接入
- 用户管理
- 资源管理
- 会话管理
- 会话配置
- 技能管理
- 厂商配置
- 存储配置
- 系统设置
- 营销中心

### 基础设施

- Prisma 数据库模型与迁移
- 本地上传与对象存储上传
- 管理员权限路由守卫
- 登录方式配置与后台管理
- Docker 部署链路

## 🚀 快速开始

### 环境要求

- `Node.js >= 20.19.0`
- `npm >= 9`
- `MySQL / MariaDB`（Prisma 连接数据库）

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

该命令会同时启动：

- 前端开发服务：`http://localhost:5010`
- 本地后端服务：`http://localhost:5409`

### 生成 Prisma Client

```bash
npm run prisma:generate
```

### 开发库迁移

```bash
npm run prisma:migrate:dev
```

### 类型检查

```bash
npm run type-check
```

### 前端构建

```bash
npm run build
```

### 生产启动

```bash
npm run start
```

生产启动流程会自动处理：

1. `prisma migrate deploy`
2. 启动服务端
3. 由服务端统一托管前端静态资源与 API

## 🐳 Docker 部署

仓库已提供：

- `Dockerfile`
- `docker-compose.yml`

### 推荐最小环境变量

```env
APP_PORT=5409
VITE_API_BASE_URL=https://你的域名或接口地址
STATIC_DIST_DIR=/app/dist
UPLOADS_DIR=/app/uploads
CORS_ALLOWED_ORIGINS=https://你的前端域名
DATABASE_URL=mysql://用户名:密码@数据库地址:3306/canana_mind
PROVIDER_CONFIG_SECRET=请替换成你自己的密钥
STORAGE_CONFIG_SECRET=
AUTH_LOGIN_CODE_EXPIRE_MINUTES=5
AUTH_SESSION_EXPIRE_DAYS=30
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
npm run dev
npm run build
npm run start
npm run preview
npm run type-check
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
```

## 🗂️ 当前项目结构

```text
canana-vue/
├── src/
│   ├── api/                         # 前端 API 封装
│   ├── components/                  # 公共组件与业务组件
│   ├── composables/                 # 通用组合式函数
│   ├── router/                      # 路由配置（含后台路由）
│   ├── stores/                      # 全局状态
│   ├── views/
│   │   ├── generate/                # 创作与生成页面
│   │   ├── workflow/                # 工作流页面
│   │   └── admin/                   # 后台页面
│   │       ├── assets/              # 资源管理
│   │       ├── conversations/       # 会话管理 / 会话配置
│   │       ├── dashboard/           # 后台首页
│   │       ├── generations/         # 生成记录管理
│   │       ├── marketing/           # 营销中心
│   │       ├── models/              # 模型相关视图
│   │       ├── providers/           # 厂商配置
│   │       ├── skills/              # 技能管理
│   │       ├── storage/             # 存储配置
│   │       ├── system/              # 系统设置
│   │       └── users/               # 用户管理
│   └── utils/
├── server/
│   ├── admin-dashboard/             # 后台仪表盘接口
│   ├── admin-generation-sessions/   # 会话/生成后台接口
│   ├── admin-marketing/             # 营销中心接口
│   ├── admin-users/                 # 用户后台接口
│   ├── auth/                        # 登录认证与策略
│   ├── conversation-settings/       # 会话配置接口
│   ├── generation-records/          # 生成记录
│   ├── generation-sessions/         # 会话数据
│   ├── generation-tasks/            # 生成任务
│   ├── marketing-center/            # 营销配置
│   ├── provider-config/             # 厂商配置
│   ├── skill-config/                # 技能配置
│   ├── storage/                     # 上传与存储能力
│   ├── storage-config/              # 对象存储配置
│   └── system-config/               # 系统设置
├── prisma/
│   ├── schema.prisma                # Prisma 模型定义
│   └── migrations/                  # 数据库迁移
├── docs/
├── scripts/
└── README.md
```

## 🧠 后台模块说明

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

- 技能启用、状态管理
- 厂商模型与服务配置
- 对象存储配置与本地回退



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

- `Vue 3`
- `Vite`
- `TypeScript`
- `Element Plus`
- `Vue Router`
- `Vue Flow`
- `Prisma`
- `MySQL / MariaDB`
- `Node.js`
- `Tailwind CSS`
## 💬 交流群
微信: 加群洽谈，过期请备注 进群

欢迎加入微信群交流 AI 产品体验：
<p align="center">
  <img src="./微信图片.jpg" width="300" alt="AI 产品体验交流群" />
  <img src="./wechat.jpg" width="300" alt="AI 产品体验交流群" />
</p>

## 📄 License

MIT

## 🔗 相关链接

- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vitejs.dev/)
- [Vue Flow 文档](https://vueflow.dev/)
- [Element Plus 文档](https://element-plus.org/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- [即梦AI](https://jimeng.jianying.com/) - 字节跳动AI创作平台
- [Dreamina](https://www.capcut.com/ai-tool/platform) - 剪映AI创作工具
---

**CanvasMind** - 让 AI 创作更简单 🎨✨
