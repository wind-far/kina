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
        label: '发布管理',
        path: '/admin/publish',
        description: '管理首页与展示内容发布状态',
      },
      {
        label: '营销中心',
        path: '/admin/marketing',
        description: '管理会员订阅、积分充值与奖励活动',
      },
    ],
  },
  {
    title: '系统配置',
    items: [
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
        description: '查看部署、登录与环境信息',
      },
    ],
  },
]
