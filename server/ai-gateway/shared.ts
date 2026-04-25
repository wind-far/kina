import { Readable } from 'node:stream'

export interface GatewayForwardBody {
  upstream?: {
    baseUrl?: string
    apiKey?: string
    endpoint?: string
  }
  request?: {
    method?: string
    headers?: Record<string, string>
    body?: unknown
  }
}

export const readJsonBody = async (req: any): Promise<GatewayForwardBody> => {
  const raw = await readRawBody(req)
  if (!raw) return {}

  return JSON.parse(raw) as GatewayForwardBody
}

export const readRawBody = async (req: any): Promise<string> => {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString('utf8').trim()
}

export const readRawBuffer = async (req: any): Promise<Buffer> => {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

export const sendJson = (res: any, statusCode: number, data: unknown) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

export const toDebugSnippet = (value: string, maxLength = 320) => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength)}...`
}

export const setGatewayDebugHeaders = (res: any, input: {
  upstreamUrl: string
  upstreamMethod: string
  upstreamStatus?: number
}) => {
  res.setHeader('x-ai-gateway-upstream-url', input.upstreamUrl)
  res.setHeader('x-ai-gateway-upstream-method', input.upstreamMethod)
  if (typeof input.upstreamStatus === 'number') {
    res.setHeader('x-ai-gateway-upstream-status', String(input.upstreamStatus))
  }
}

export const joinUpstreamUrl = (baseUrl: string, endpoint: string) => {
  const normalizedEndpoint = endpoint.trim()
  if (/^https?:\/\//i.test(normalizedEndpoint)) {
    return normalizedEndpoint
  }

  return `${baseUrl.replace(/\/+$/, '')}/${normalizedEndpoint.replace(/^\/+/, '')}`
}

export const normalizeGatewayPayload = (payload: GatewayForwardBody) => {
  const baseUrl = payload.upstream?.baseUrl?.trim() || ''
  const endpoint = payload.upstream?.endpoint?.trim() || ''

  if (!baseUrl) {
    throw new Error('缺少上游 baseUrl 配置')
  }

  if (!endpoint) {
    throw new Error('缺少上游 endpoint 配置')
  }

  return {
    upstreamUrl: joinUpstreamUrl(baseUrl, endpoint),
    apiKey: payload.upstream?.apiKey?.trim() || '',
    method: (payload.request?.method || 'GET').toUpperCase(),
    headers: payload.request?.headers || {},
    body: payload.request?.body,
  }
}

export const proxyUpstreamResponse = async (upstreamResponse: Response, res: any) => {
  res.statusCode = upstreamResponse.status

  upstreamResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-encoding') return
    if (key.toLowerCase() === 'content-length') return
    res.setHeader(key, value)
  })

  if (!upstreamResponse.body) {
    res.end()
    return
  }

  Readable.fromWeb(upstreamResponse.body as any).pipe(res)
}
