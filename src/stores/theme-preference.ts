import { computed, ref } from 'vue'
import type { SystemGlobalThemeSettingsConfig } from '@/api/system-config'

export type ThemeMode = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

const THEME_MODE_STORAGE_KEY = 'theme-mode'
const themeMode = ref<ThemeMode>('dark')
const currentTheme = ref<ResolvedTheme>('dark')
const allowUserToggle = ref(true)
const supportSystemMode = ref(true)
const mediaListenerBound = ref(false)

const isClient = () => typeof window !== 'undefined' && typeof document !== 'undefined'

const getSystemTheme = (): ResolvedTheme => {
  if (!isClient()) {
    return 'dark'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const normalizeThemeMode = (value: unknown): ThemeMode => {
  return value === 'light' || value === 'system' ? value : 'dark'
}

const normalizeResolvedTheme = (mode: ThemeMode): ResolvedTheme => {
  if (mode === 'system') {
    return getSystemTheme()
  }
  return mode
}

const applyThemeAttributes = (theme: ResolvedTheme) => {
  if (!isClient()) {
    return
  }

  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
  document.body.setAttribute('lv-theme', theme)
  document.body.setAttribute('lv-theme-version', '2.0')
}

const setStoredThemeMode = (mode: ThemeMode) => {
  if (!isClient()) {
    return
  }

  if (allowUserToggle.value) {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode)
    return
  }

  window.localStorage.removeItem(THEME_MODE_STORAGE_KEY)
}

const syncCurrentTheme = () => {
  currentTheme.value = normalizeResolvedTheme(themeMode.value)
  applyThemeAttributes(currentTheme.value)
}

const bindSystemThemeListener = () => {
  if (!isClient() || mediaListenerBound.value) {
    return
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    if (themeMode.value !== 'system') {
      return
    }

    syncCurrentTheme()
  })
  mediaListenerBound.value = true
}

const resolveEffectiveThemeMode = (settings?: SystemGlobalThemeSettingsConfig | null) => {
  const modePolicy = settings?.modePolicy
  const nextAllowUserToggle = modePolicy?.allowUserToggle !== false
  const nextSupportSystemMode = modePolicy?.supportSystemMode !== false
  const normalizedDefaultMode = normalizeThemeMode(modePolicy?.defaultMode)
  const defaultMode = normalizedDefaultMode === 'system' && !nextSupportSystemMode
    ? 'dark'
    : normalizedDefaultMode

  allowUserToggle.value = nextAllowUserToggle
  supportSystemMode.value = nextSupportSystemMode

  const savedThemeMode = isClient() && nextAllowUserToggle
    ? normalizeThemeMode(window.localStorage.getItem(THEME_MODE_STORAGE_KEY))
    : null

  if (savedThemeMode === 'system' && !nextSupportSystemMode) {
    return defaultMode
  }

  return savedThemeMode || defaultMode
}

export function useThemePreferenceStore() {
  const setThemeMode = (mode: ThemeMode, persist = true) => {
    const normalizedMode = mode === 'system' && !supportSystemMode.value ? 'dark' : mode
    themeMode.value = normalizedMode
    syncCurrentTheme()

    if (persist) {
      setStoredThemeMode(normalizedMode)
    }
  }

  const syncThemePolicy = (settings?: SystemGlobalThemeSettingsConfig | null) => {
    bindSystemThemeListener()
    const nextMode = resolveEffectiveThemeMode(settings)
    setThemeMode(nextMode, allowUserToggle.value)
  }

  return {
    themeMode,
    currentTheme: computed(() => currentTheme.value),
    allowUserToggle: computed(() => allowUserToggle.value),
    supportSystemMode: computed(() => supportSystemMode.value),
    getSystemTheme,
    setThemeMode,
    syncThemePolicy,
  }
}
