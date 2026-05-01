import type { SystemConfigPayload, SystemGlobalThemeSettingsConfig } from '@/api/system-config'
import { useThemePreferenceStore } from '@/stores/theme-preference'

const isClient = () => typeof window !== 'undefined' && typeof document !== 'undefined'

const normalizeHex = (value: string, fallback: string) => {
  const normalized = String(value || '').trim()
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[0-9a-fA-F]{3})$/.test(normalized) ? normalized : fallback
}

const expandHex = (hex: string) => {
  const normalized = hex.replace('#', '')
  if (normalized.length === 3) {
    return normalized.split('').map(char => `${char}${char}`).join('')
  }
  return normalized.slice(0, 6)
}

const hexToRgba = (hex: string, alpha: number) => {
  const safeHex = expandHex(normalizeHex(hex, '#6f35ff'))
  const red = Number.parseInt(safeHex.slice(0, 2), 16)
  const green = Number.parseInt(safeHex.slice(2, 4), 16)
  const blue = Number.parseInt(safeHex.slice(4, 6), 16)
  const safeAlpha = Math.max(0, Math.min(1, alpha))
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`
}

const setCssVar = (name: string, value: string) => {
  if (!isClient()) {
    return
  }
  document.documentElement.style.setProperty(name, value)
}

const clearCssVar = (name: string) => {
  if (!isClient()) {
    return
  }
  document.documentElement.style.removeProperty(name)
}

const applyBrandColors = (settings: SystemGlobalThemeSettingsConfig) => {
  const brandColors = settings.brandColors
  const gradients = settings.gradients
  const surfaces = settings.surfaces

  setCssVar('--brand-main-default', brandColors.primary)
  setCssVar('--brand-main-hover', brandColors.primaryHover)
  setCssVar('--brand-main-pressed', brandColors.primaryActive)
  setCssVar('--brand-main-block-default', hexToRgba(brandColors.primary, 0.12))
  setCssVar('--brand-main-block-hover', hexToRgba(brandColors.primaryHover, 0.18))
  setCssVar('--brand-main-block-pressed', hexToRgba(brandColors.primaryActive, 0.22))

  setCssVar('--brand-bright-default', brandColors.primary)
  setCssVar('--brand-bright-hover', brandColors.primaryHover)
  setCssVar('--brand-bright-pressed', brandColors.primaryActive)
  setCssVar('--brand-bright-text', '#f5fbff')

  setCssVar('--brand-secondary-default', brandColors.secondary)
  setCssVar('--brand-accent-default', brandColors.accent)
  setCssVar('--brand-success-default', brandColors.success)
  setCssVar('--brand-warning-default', brandColors.warning)
  setCssVar('--brand-danger-default', brandColors.danger)
  setCssVar('--theme-primary-gradient', gradients.primaryGradient)
  setCssVar('--theme-banner-glow', gradients.bannerGlow)
  setCssVar('--theme-content-max-width', `${surfaces.contentMaxWidth}px`)
  setCssVar('--theme-card-radius', `${surfaces.cardRadius}px`)

  setCssVar('--lvv-color-main-default', 'var(--brand-main-default)')
  setCssVar('--lvv-color-main-hover', 'var(--brand-main-hover)')
  setCssVar('--lvv-color-main-pressded', 'var(--brand-main-pressed)')
}

export const applySystemThemeRuntime = (settings?: SystemConfigPayload | null) => {
  if (!isClient() || !settings) {
    return
  }

  const themeStore = useThemePreferenceStore()
  themeStore.syncThemePolicy(settings.globalThemeSettings)
  applyBrandColors(settings.globalThemeSettings)
}

export const resetSystemThemeRuntime = () => {
  if (!isClient()) {
    return
  }

  ;[
    '--brand-main-default',
    '--brand-main-hover',
    '--brand-main-pressed',
    '--brand-main-block-default',
    '--brand-main-block-hover',
    '--brand-main-block-pressed',
    '--brand-bright-default',
    '--brand-bright-hover',
    '--brand-bright-pressed',
    '--brand-bright-text',
    '--brand-secondary-default',
    '--brand-accent-default',
    '--brand-success-default',
    '--brand-warning-default',
    '--brand-danger-default',
    '--theme-primary-gradient',
    '--theme-banner-glow',
    '--theme-content-max-width',
    '--theme-card-radius',
    '--lvv-color-main-default',
    '--lvv-color-main-hover',
    '--lvv-color-main-pressded',
  ].forEach(clearCssVar)
}
