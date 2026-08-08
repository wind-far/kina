export const USER_PROVIDER_CONFIG_BASE_PATH = '/api/user-provider-config'

export const isUserProviderConfigPath = (requestPath: string) => (
  requestPath === USER_PROVIDER_CONFIG_BASE_PATH
  || requestPath.startsWith(`${USER_PROVIDER_CONFIG_BASE_PATH}/`)
)
