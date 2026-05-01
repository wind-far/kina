export interface AdminNavItem {
  label: string
  path: string
  description: string
}

export interface AdminNavGroup {
  title: string
  items: AdminNavItem[]
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    title: '总览',
    items: [
      {
        label: '仪表盘',
        path: '/admin/dashboard',
        description: '查看整体运行概览与趋势',
      },
    ],
  },
  {
    title: '内容管理',
    items: [
      {
        label: '资源管理',
        path: '/admin/assets',
        description: '管理图片、视频与发布状态',
      },
      {
        label: '生成记录',
        path: '/admin/generations',
        description: '查看生成历史与异常记录',
      },
      {
        label: '营销中心',
        path: '/admin/marketing',
        description: '管理会员订阅、积分充值与奖励活动',
      },
    ],
  },
  {
    title: '会话管理',
    items: [
      {
        label: '会话列表',
        path: '/admin/conversations',
        description: '管理全站创作会话与会话明细',
      },
      {
        label: '会话配置',
        path: '/admin/conversations/settings',
        description: '统一维护会话规则、入口展示与管理策略',
      },
    ],
  },
  {
    title: '系统配置',
    items: [
      {
        label: '技能配置',
        path: '/admin/skills',
        description: '管理技能目录、提示词模板与工作流模板',
      },
      {
        label: '厂商配置',
        path: '/admin/providers',
        description: '管理 AI 厂商地址、密钥与请求端点',
      },
      {
        label: '存储配置',
        path: '/admin/storage',
        description: '管理本地与对象存储方案',
      },
      {
        label: '用户管理',
        path: '/admin/users',
        description: '查看用户列表并调整后台角色',
      },
      {
        label: '系统设置',
        path: '/admin/system',
        description: '维护站点信息、协议文案与登录方式',
      },
      {
        label: '布局配置',
        path: '/admin/layout',
        description: '单独维护导航布局、首页头部与 Banner 编排',
      },
    ],
  },
]
