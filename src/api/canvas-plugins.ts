import { buildApiUrl } from './http'
import { readApiData } from './response'

export interface AdminCanvasPluginRelease {
  id: string
  version: string
  sourcePackageUrl: string
  packageUrl: string
  integritySha256: string
  isTrusted: boolean
  isMirrored: boolean
  createdAt: string
}

export interface AdminCanvasPlugin {
  id: string
  slug: string
  name: string
  description: string
  isEnabled: boolean
  manifest: Record<string, unknown>
  releases: AdminCanvasPluginRelease[]
}

export interface PublishCanvasPluginPayload {
  slug: string
  name: string
  description?: string
  version: string
  packageUrl: string
  integritySha256: string
  manifest: { entry: string; capabilities: string[] }
}

const registryUrl = '/api/canvas/plugins/registry'

export const listAdminCanvasPlugins = async () => {
  const response = await fetch(buildApiUrl(registryUrl), { credentials: 'include', cache: 'no-store' })
  return await readApiData<AdminCanvasPlugin[]>(response)
}

export const publishCanvasPlugin = async (payload: PublishCanvasPluginPayload) => {
  const response = await fetch(buildApiUrl(registryUrl), {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })
  return await readApiData<{ plugin: AdminCanvasPlugin; release: AdminCanvasPluginRelease }>(response, {
    showSuccessMessage: true, showErrorMessage: true,
  })
}
