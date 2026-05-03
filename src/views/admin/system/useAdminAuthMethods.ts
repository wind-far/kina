import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import {
  listAuthMethodConfigs,
  saveAuthMethodConfigs,
  type AuthMethodCategory,
  type AuthMethodConfigPayload,
  type AuthMethodType,
  type PublicAuthMethod,
} from '@/api/auth'

export interface EditableAuthMethod extends PublicAuthMethod {
  configText: string
  targetLabel: string
  placeholder: string
  codePlaceholder: string
  debugSendEnabled: boolean
  senderName: string
  senderAddress: string
  providerCode: string
  accessKeyId: string
  accessKeySecret: string
  signName: string
  templateCode: string
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
  smtpUser: string
  smtpPassword: string
  authorizeUrl: string
  tokenUrl: string
  userInfoUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
  responseType: string
  scope: string
}

interface AuthMethodTemplate {
  methodType: AuthMethodType
  category: AuthMethodCategory
  displayName: string
  description: string
  iconType: string
  iconUrl: string
  isEnabled: boolean
  isVisible: boolean
  sortOrder: number
  allowAutoFill: boolean
  allowSignUp: boolean
  config: Record<string, any>
}

const AUTH_METHOD_TEMPLATES: AuthMethodTemplate[] = [
  {
    methodType: 'PHONE_CODE',
    category: 'CODE',
    displayName: '手机号登录',
    description: '使用短信验证码登录',
    iconType: 'phone',
    iconUrl: '',
    isEnabled: true,
    isVisible: true,
    sortOrder: 10,
    allowAutoFill: true,
    allowSignUp: true,
    config: {
      targetLabel: '手机号',
      placeholder: '请输入手机号',
      codePlaceholder: '请输入验证码',
      providerCode: '',
      accessKeyId: '',
      accessKeySecret: '',
      signName: '',
      templateCode: '',
    },
  },
  {
    methodType: 'EMAIL_CODE',
    category: 'CODE',
    displayName: '邮箱登录',
    description: '使用邮箱验证码登录',
    iconType: 'mail',
    iconUrl: '',
    isEnabled: true,
    isVisible: true,
    sortOrder: 20,
    allowAutoFill: true,
    allowSignUp: true,
    config: {
      targetLabel: '邮箱',
      placeholder: '请输入邮箱',
      codePlaceholder: '请输入验证码',
      senderName: '',
      senderAddress: '',
      smtpHost: '',
      smtpPort: '',
      smtpSecure: true,
      smtpUser: '',
      smtpPassword: '',
    },
  },
  {
    methodType: 'WECHAT_OAUTH',
    category: 'OAUTH',
    displayName: '微信登录',
    description: '使用微信账号登录',
    iconType: 'wechat',
    iconUrl: '',
    isEnabled: false,
    isVisible: true,
    sortOrder: 30,
    allowAutoFill: false,
    allowSignUp: true,
    config: {
      authorizeUrl: '',
      tokenUrl: '',
      userInfoUrl: '',
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      responseType: 'code',
      scope: '',
    },
  },
  {
    methodType: 'GITHUB_OAUTH',
    category: 'OAUTH',
    displayName: 'GitHub 登录',
    description: '使用 GitHub 账号登录',
    iconType: 'github',
    iconUrl: '',
    isEnabled: false,
    isVisible: true,
    sortOrder: 40,
    allowAutoFill: false,
    allowSignUp: true,
    config: {
      authorizeUrl: '',
      tokenUrl: '',
      userInfoUrl: '',
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      responseType: 'code',
      scope: 'read:user user:email',
    },
  },
  {
    methodType: 'GOOGLE_OAUTH',
    category: 'OAUTH',
    displayName: 'Google 登录',
    description: '使用 Google 账号登录',
    iconType: 'google',
    iconUrl: '',
    isEnabled: false,
    isVisible: true,
    sortOrder: 50,
    allowAutoFill: false,
    allowSignUp: true,
    config: {
      authorizeUrl: '',
      tokenUrl: '',
      userInfoUrl: '',
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      responseType: 'code',
      scope: 'openid email profile',
    },
  },
  {
    methodType: 'CUSTOM_OAUTH',
    category: 'OAUTH',
    displayName: '自定义 OAuth',
    description: '接入自定义第三方 OAuth 登录',
    iconType: 'link',
    iconUrl: '',
    isEnabled: false,
    isVisible: true,
    sortOrder: 60,
    allowAutoFill: false,
    allowSignUp: true,
    config: {
      authorizeUrl: '',
      tokenUrl: '',
      userInfoUrl: '',
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      responseType: 'code',
      scope: '',
    },
  },
]

function toEditableAuthMethod(method: PublicAuthMethod): EditableAuthMethod {
  return {
    ...method,
    configText: JSON.stringify(method.config || {}, null, 2),
    targetLabel: String(method.config?.targetLabel || ''),
    placeholder: String(method.config?.placeholder || ''),
    codePlaceholder: String(method.config?.codePlaceholder || ''),
    debugSendEnabled: method.allowAutoFill !== false,
    senderName: String(method.config?.senderName || ''),
    senderAddress: String(method.config?.senderAddress || ''),
    providerCode: String(method.config?.providerCode || ''),
    accessKeyId: String(method.config?.accessKeyId || ''),
    accessKeySecret: String(method.config?.accessKeySecret || ''),
    signName: String(method.config?.signName || ''),
    templateCode: String(method.config?.templateCode || ''),
    smtpHost: String(method.config?.smtpHost || ''),
    smtpPort: String(method.config?.smtpPort || ''),
    smtpSecure: method.config?.smtpSecure === true,
    smtpUser: String(method.config?.smtpUser || ''),
    smtpPassword: String(method.config?.smtpPassword || ''),
    authorizeUrl: String(method.config?.authorizeUrl || ''),
    tokenUrl: String(method.config?.tokenUrl || ''),
    userInfoUrl: String(method.config?.userInfoUrl || ''),
    clientId: String(method.config?.clientId || ''),
    clientSecret: String(method.config?.clientSecret || ''),
    redirectUri: String(method.config?.redirectUri || ''),
    responseType: String(method.config?.responseType || 'code'),
    scope: String(method.config?.scope || ''),
  }
}

function createEditableAuthMethod(template: AuthMethodTemplate): EditableAuthMethod {
  return toEditableAuthMethod({
    methodType: template.methodType,
    category: template.category,
    displayName: template.displayName,
    description: template.description,
    iconType: template.iconType,
    iconUrl: template.iconUrl,
    isEnabled: template.isEnabled,
    isVisible: template.isVisible,
    sortOrder: template.sortOrder,
    allowAutoFill: template.allowAutoFill,
    allowSignUp: template.allowSignUp,
    config: template.config,
  })
}

function applyEditableMethod(target: EditableAuthMethod, source: EditableAuthMethod) {
  target.methodType = source.methodType
  target.category = source.category
  target.displayName = source.displayName
  target.description = source.description
  target.iconType = source.iconType
  target.iconUrl = source.iconUrl
  target.isEnabled = source.isEnabled
  target.isVisible = source.isVisible
  target.sortOrder = source.sortOrder
  target.allowAutoFill = source.allowAutoFill
  target.allowSignUp = source.allowSignUp
  target.config = { ...(source.config || {}) }
  target.configText = source.configText
  target.targetLabel = source.targetLabel
  target.placeholder = source.placeholder
  target.codePlaceholder = source.codePlaceholder
  target.debugSendEnabled = source.debugSendEnabled
  target.senderName = source.senderName
  target.senderAddress = source.senderAddress
  target.providerCode = source.providerCode
  target.accessKeyId = source.accessKeyId
  target.accessKeySecret = source.accessKeySecret
  target.signName = source.signName
  target.templateCode = source.templateCode
  target.smtpHost = source.smtpHost
  target.smtpPort = source.smtpPort
  target.smtpSecure = source.smtpSecure
  target.smtpUser = source.smtpUser
  target.smtpPassword = source.smtpPassword
  target.authorizeUrl = source.authorizeUrl
  target.tokenUrl = source.tokenUrl
  target.userInfoUrl = source.userInfoUrl
  target.clientId = source.clientId
  target.clientSecret = source.clientSecret
  target.redirectUri = source.redirectUri
  target.responseType = source.responseType
  target.scope = source.scope
}

function cloneEditableMethod(source: EditableAuthMethod): EditableAuthMethod {
  return {
    ...source,
    config: { ...(source.config || {}) },
  }
}

function sortEditableAuthMethods(methods: EditableAuthMethod[]) {
  return [...methods].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder
    }
    return left.methodType.localeCompare(right.methodType)
  })
}

export function getMethodCategoryLabel(category: AuthMethodCategory) {
  return category === 'CODE' ? '验证码登录' : 'OAuth 登录'
}

export function useAdminAuthMethods() {
  const methodSaving = ref(false)
  const methodDialogVisible = ref(false)
  const activeMethodMenuType = ref<AuthMethodType | ''>('')
  const editingMethodType = ref<AuthMethodType | ''>('')
  const authMethods = ref<EditableAuthMethod[]>([])
  const methodForm = reactive<EditableAuthMethod>(createEditableAuthMethod(AUTH_METHOD_TEMPLATES[0]))

  const enabledMethodCount = computed(() => authMethods.value.filter(item => item.isEnabled && item.isVisible).length)
  const sortedAuthMethods = computed(() => sortEditableAuthMethods(authMethods.value))
  const creatableMethodTemplates = computed(() => {
    const existingTypes = new Set(authMethods.value.map(item => item.methodType))
    return AUTH_METHOD_TEMPLATES.filter(item => !existingTypes.has(item.methodType))
  })

  const setAuthMethods = (methods: PublicAuthMethod[]) => {
    authMethods.value = sortEditableAuthMethods(Array.isArray(methods) ? methods.map(toEditableAuthMethod) : [])
  }

  const getMethodTypeLabel = (methodType: AuthMethodType) => {
    const currentTemplate = AUTH_METHOD_TEMPLATES.find(item => item.methodType === methodType)
    return currentTemplate?.displayName || methodType
  }

  const closeMethodMenu = () => {
    activeMethodMenuType.value = ''
  }

  const toggleMethodMenu = (methodType: AuthMethodType) => {
    activeMethodMenuType.value = activeMethodMenuType.value === methodType ? '' : methodType
  }

  const replaceMethodInList = (methodType: AuthMethodType, updater: (method: EditableAuthMethod) => EditableAuthMethod) => {
    authMethods.value = sortEditableAuthMethods(
      authMethods.value.map(item => item.methodType === methodType ? updater(cloneEditableMethod(item)) : item),
    )
  }

  const toggleMethodEnabled = (methodType: AuthMethodType) => {
    replaceMethodInList(methodType, (method) => {
      method.isEnabled = !method.isEnabled
      return method
    })
  }

  const toggleMethodVisible = (methodType: AuthMethodType) => {
    replaceMethodInList(methodType, (method) => {
      method.isVisible = !method.isVisible
      return method
    })
  }

  const removeMethod = (methodType: AuthMethodType) => {
    const targetMethod = authMethods.value.find(item => item.methodType === methodType)
    if (!targetMethod) {
      return
    }

    if (!window.confirm(`确认删除登录方式“${targetMethod.displayName || targetMethod.methodType}”吗？删除后需点击“保存登录方式”才会同步到后端。`)) {
      return
    }

    authMethods.value = authMethods.value.filter(item => item.methodType !== methodType)
    closeMethodMenu()
    ElMessage.success('登录方式已从待保存列表移除')
  }

  const openEditMethodDialog = (method: EditableAuthMethod) => {
    closeMethodMenu()
    editingMethodType.value = method.methodType
    applyEditableMethod(methodForm, cloneEditableMethod(method))
    methodDialogVisible.value = true
  }

  const handleMethodMenuEdit = (method: EditableAuthMethod) => {
    closeMethodMenu()
    openEditMethodDialog(method)
  }

  const handleMethodMenuToggleEnabled = (method: EditableAuthMethod) => {
    closeMethodMenu()
    toggleMethodEnabled(method.methodType)
  }

  const handleMethodMenuToggleVisible = (method: EditableAuthMethod) => {
    closeMethodMenu()
    toggleMethodVisible(method.methodType)
  }

  const handleMethodMenuDelete = (method: EditableAuthMethod) => {
    closeMethodMenu()
    removeMethod(method.methodType)
  }

  const buildMethodPreviewItems = (method: EditableAuthMethod) => {
    const items: string[] = []

    if (method.category === 'CODE') {
      items.push(`账号标签：${method.targetLabel || '未设置'}`)
      items.push(`输入占位：${method.placeholder || '未设置'}`)
      items.push(`验证码占位：${method.codePlaceholder || '未设置'}`)

      if (method.methodType === 'PHONE_CODE') {
        items.push(`短信服务商：${method.providerCode || '未设置'}`)
        items.push(`签名名称：${method.signName || '未设置'}`)
        items.push(`模板编号：${method.templateCode || '未设置'}`)
      }

      if (method.methodType === 'EMAIL_CODE') {
        items.push(`发件邮箱：${method.senderAddress || '未设置'}`)
        items.push(`SMTP Host：${method.smtpHost || '未设置'}`)
        items.push(`SMTP Port：${method.smtpPort || '未设置'}`)
      }
    }

    if (method.category === 'OAUTH') {
      items.push(`授权地址：${method.authorizeUrl || '未设置'}`)
      items.push(`Token 地址：${method.tokenUrl || '未设置'}`)
      items.push(`用户信息地址：${method.userInfoUrl || '未设置'}`)
      items.push(`Client ID：${method.clientId || '未设置'}`)
      items.push(`回调地址：${method.redirectUri || '未设置'}`)
    }

    return items.slice(0, 5)
  }

  const createEditableMethodSnapshot = (source: EditableAuthMethod) => {
    if (!source.displayName.trim()) {
      throw new Error('请先填写登录方式显示名称')
    }

    let normalizedConfigText = ''
    if (String(source.configText || '').trim()) {
      try {
        const parsed = JSON.parse(source.configText)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('扩展配置 JSON 必须是对象')
        }
        normalizedConfigText = JSON.stringify(parsed, null, 2)
      } catch (error: any) {
        throw new Error(error?.message || '扩展配置 JSON 格式不正确')
      }
    }

    return cloneEditableMethod({
      ...source,
      displayName: source.displayName.trim(),
      description: source.description.trim(),
      iconType: source.iconType.trim(),
      iconUrl: source.iconUrl.trim(),
      configText: normalizedConfigText,
      targetLabel: source.targetLabel.trim(),
      placeholder: source.placeholder.trim(),
      codePlaceholder: source.codePlaceholder.trim(),
      senderName: source.senderName.trim(),
      senderAddress: source.senderAddress.trim(),
      providerCode: source.providerCode.trim(),
      accessKeyId: source.accessKeyId.trim(),
      accessKeySecret: source.accessKeySecret.trim(),
      signName: source.signName.trim(),
      templateCode: source.templateCode.trim(),
      smtpHost: source.smtpHost.trim(),
      smtpPort: source.smtpPort.trim(),
      smtpUser: source.smtpUser.trim(),
      smtpPassword: source.smtpPassword.trim(),
      authorizeUrl: source.authorizeUrl.trim(),
      tokenUrl: source.tokenUrl.trim(),
      userInfoUrl: source.userInfoUrl.trim(),
      clientId: source.clientId.trim(),
      clientSecret: source.clientSecret.trim(),
      redirectUri: source.redirectUri.trim(),
      responseType: source.responseType.trim() || 'code',
      scope: source.scope.trim(),
    })
  }

  const buildAuthMethodPayload = (): AuthMethodConfigPayload[] => {
    return authMethods.value.map((method) => {
      let extraConfig: Record<string, any> = {}

      if (String(method.configText || '').trim()) {
        try {
          const parsed = JSON.parse(method.configText)
          extraConfig = parsed && typeof parsed === 'object' ? parsed : {}
        } catch {
          throw new Error(`登录方式“${method.displayName || method.methodType}”的扩展配置 JSON 格式不正确`)
        }
      }

      if (method.category === 'CODE') {
        extraConfig.targetLabel = method.targetLabel
        extraConfig.placeholder = method.placeholder
        extraConfig.codePlaceholder = method.codePlaceholder
        extraConfig.providerCode = method.providerCode
        extraConfig.senderName = method.senderName
        extraConfig.senderAddress = method.senderAddress
        extraConfig.accessKeyId = method.accessKeyId
        extraConfig.accessKeySecret = method.accessKeySecret
        extraConfig.signName = method.signName
        extraConfig.templateCode = method.templateCode
        extraConfig.smtpHost = method.smtpHost
        extraConfig.smtpPort = method.smtpPort
        extraConfig.smtpSecure = method.smtpSecure
        extraConfig.smtpUser = method.smtpUser
        extraConfig.smtpPassword = method.smtpPassword
      }

      if (method.category === 'OAUTH') {
        extraConfig.authorizeUrl = method.authorizeUrl
        extraConfig.tokenUrl = method.tokenUrl
        extraConfig.userInfoUrl = method.userInfoUrl
        extraConfig.clientId = method.clientId
        extraConfig.clientSecret = method.clientSecret
        extraConfig.redirectUri = method.redirectUri
        extraConfig.responseType = method.responseType || 'code'
        extraConfig.scope = method.scope
      }

      return {
        methodType: method.methodType,
        category: method.category,
        displayName: method.displayName,
        description: method.description,
        iconType: method.iconType,
        iconUrl: method.iconUrl,
        isEnabled: method.isEnabled,
        isVisible: method.isVisible,
        sortOrder: Number.isFinite(Number(method.sortOrder)) ? Number(method.sortOrder) : 0,
        allowAutoFill: method.category === 'CODE' ? method.debugSendEnabled : false,
        allowSignUp: method.allowSignUp,
        config: extraConfig,
      }
    })
  }

  const openCreateMethodDialog = () => {
    const [firstTemplate] = creatableMethodTemplates.value
    if (!firstTemplate) {
      ElMessage.warning('预设登录方式已全部添加，无需重复创建')
      return
    }

    editingMethodType.value = ''
    applyEditableMethod(methodForm, createEditableAuthMethod(firstTemplate))
    closeMethodMenu()
    methodDialogVisible.value = true
  }

  const closeMethodDialog = () => {
    methodDialogVisible.value = false
    editingMethodType.value = ''
  }

  const handleCreateMethodTypeChange = (methodType: string) => {
    const currentTemplate = creatableMethodTemplates.value.find(item => item.methodType === methodType)
    if (!currentTemplate) {
      return
    }

    applyEditableMethod(methodForm, createEditableAuthMethod(currentTemplate))
  }

  const handleSubmitMethodDialog = () => {
    try {
      const snapshot = createEditableMethodSnapshot(methodForm)

      if (editingMethodType.value) {
        authMethods.value = sortEditableAuthMethods(
          authMethods.value.map(item => item.methodType === editingMethodType.value ? snapshot : item),
        )
        ElMessage.success('登录方式已更新到待保存列表')
      } else {
        if (authMethods.value.some(item => item.methodType === snapshot.methodType)) {
          ElMessage.warning('该登录方式已存在，无需重复添加')
          return
        }
        authMethods.value = sortEditableAuthMethods([...authMethods.value, snapshot])
        ElMessage.success('登录方式已加入待保存列表')
      }

      closeMethodDialog()
    } catch (error: any) {
      ElMessage.error(error?.message || '登录方式配置保存失败')
    }
  }

  const loadAuthMethodData = async () => {
    const methods = await listAuthMethodConfigs()
    setAuthMethods(Array.isArray(methods) ? methods : [])
  }

  const handleSaveAuthMethods = async () => {
    methodSaving.value = true
    try {
      const saved = await saveAuthMethodConfigs(buildAuthMethodPayload())
      setAuthMethods(Array.isArray(saved) ? saved : [])
      ElMessage.success('登录方式已更新')
    } catch (error: any) {
      ElMessage.error(error?.message || '保存登录方式失败')
    } finally {
      methodSaving.value = false
    }
  }

  return {
    methodSaving,
    methodDialogVisible,
    activeMethodMenuType,
    editingMethodType,
    authMethods,
    methodForm,
    enabledMethodCount,
    sortedAuthMethods,
    creatableMethodTemplates,
    setAuthMethods,
    getMethodTypeLabel,
    buildMethodPreviewItems,
    openCreateMethodDialog,
    openEditMethodDialog,
    closeMethodDialog,
    handleCreateMethodTypeChange,
    handleSubmitMethodDialog,
    handleSaveAuthMethods,
    toggleMethodMenu,
    handleMethodMenuEdit,
    handleMethodMenuToggleEnabled,
    handleMethodMenuToggleVisible,
    handleMethodMenuDelete,
    toggleMethodEnabled,
    toggleMethodVisible,
    removeMethod,
    loadAuthMethodData,
  }
}
