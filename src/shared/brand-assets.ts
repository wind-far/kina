const LEGACY_EMOJI_LOGO_PATTERNS = [
  /lobehub\/fluent-emoji/i,
  /\/1f929\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i,
]

export function resolveSiteLogoUrl(value: unknown) {
  const url = String(value || '').trim()

  if (LEGACY_EMOJI_LOGO_PATTERNS.some(pattern => pattern.test(url))) {
    return ''
  }

  return url
}
