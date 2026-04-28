import { defineStore } from 'pinia'
import { ide, type IdeThemeSnapshot } from '@dynamia-tools/ide-bridge'

const DEFAULT_DARK_BG = '#1e1e1e'
const DEFAULT_LIGHT_BG = '#f3f3f3'

function normalizeHexColor(value: string | null | undefined): string | null {
  const candidate = (value ?? '').trim()
  const match = candidate.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
  if (!match) return null
  const hex = match[1]
  if (hex.length === 3) {
    const [r, g, b] = hex.split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return `#${hex.slice(0, 6)}`.toLowerCase()
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.slice(1)
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function mix(base: string, target: string, amount: number): string {
  const ratio = Math.max(0, Math.min(1, amount))
  const [r1, g1, b1] = hexToRgb(base)
  const [r2, g2, b2] = hexToRgb(target)
  return rgbToHex(
    r1 + (r2 - r1) * ratio,
    g1 + (g2 - g1) * ratio,
    b1 + (b2 - b1) * ratio,
  )
}

function toRgbValue(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  return `${r} ${g} ${b}`
}

function textPaletteFor(isDarkMode: boolean) {
  if (isDarkMode) {
    return {
      text: '#d4d4d4',
      muted: '#858585',
      dim: '#6a6a6a',
      body: '#a0a0a0',
    }
  }

  return {
    text: '#1f2937',
    muted: '#4b5563',
    dim: '#6b7280',
    body: '#374151',
  }
}

function applyThemeCssVars(snapshot: { isDarkMode: boolean; backgroundColor: string }) {
  if (!process.client) return

  const root = document.documentElement
  const background = snapshot.backgroundColor
  const surface = snapshot.isDarkMode ? mix(background, '#ffffff', 0.05) : mix(background, '#000000', 0.03)
  const raised = snapshot.isDarkMode ? mix(background, '#ffffff', 0.10) : mix(background, '#000000', 0.07)
  const border = snapshot.isDarkMode ? mix(background, '#ffffff', 0.18) : mix(background, '#000000', 0.18)
  const text = textPaletteFor(snapshot.isDarkMode)

  root.classList.toggle('dark', snapshot.isDarkMode)

  root.style.setProperty('--dt-bg-rgb', toRgbValue(background))
  root.style.setProperty('--dt-surface-rgb', toRgbValue(surface))
  root.style.setProperty('--dt-raised-rgb', toRgbValue(raised))
  root.style.setProperty('--dt-border-rgb', toRgbValue(border))
  root.style.setProperty('--dt-text-rgb', toRgbValue(text.text))
  root.style.setProperty('--dt-muted-rgb', toRgbValue(text.muted))
  root.style.setProperty('--dt-dim-rgb', toRgbValue(text.dim))
  root.style.setProperty('--dt-body-rgb', toRgbValue(text.body))

  // Keep legacy variables in sync for existing raw CSS selectors.
  root.style.setProperty('--bg-base', background)
  root.style.setProperty('--bg-surface', surface)
  root.style.setProperty('--bg-raised', raised)
  root.style.setProperty('--border', border)
  root.style.setProperty('--text-base', text.text)
  root.style.setProperty('--text-muted', text.muted)
  root.style.setProperty('--text-dim', text.dim)
  root.style.setProperty('--text-body', text.body)
}

export const useIdeThemeStore = defineStore('ideTheme', () => {
  const isDarkMode = ref<boolean>(true)
  const backgroundColor = ref<string>(DEFAULT_DARK_BG)
  const isInitialized = ref(false)
  let unsubscribeTheme: (() => void) | null = null

  function applySnapshot(theme: IdeThemeSnapshot) {
    const normalizedDark = typeof theme.isDarkMode === 'boolean' ? theme.isDarkMode : isDarkMode.value
    const fallbackBackground = normalizedDark ? DEFAULT_DARK_BG : DEFAULT_LIGHT_BG
    const normalizedBackground = normalizeHexColor(theme.backgroundColor) ?? fallbackBackground

    isDarkMode.value = normalizedDark
    backgroundColor.value = normalizedBackground
    isInitialized.value = true

    applyThemeCssVars({
      isDarkMode: normalizedDark,
      backgroundColor: normalizedBackground,
    })
  }

  async function syncFromIde() {
    if (!process.client) return

    try {
      const [darkMode, background] = await Promise.all([
        ide.ui.isDarkMode(),
        ide.ui.getBackgroundColor(),
      ])

      applySnapshot({
        isDarkMode: darkMode,
        backgroundColor: background,
        accentColor: null,
      })
    } catch {
      applySnapshot({
        isDarkMode: true,
        backgroundColor: DEFAULT_DARK_BG,
        accentColor: null,
      })
    }
  }

  function startListening() {
    if (!process.client) return
    if (unsubscribeTheme) return

    unsubscribeTheme = ide.ui.onThemeChange((theme) => {
      applySnapshot(theme)
    })
  }

  function stopListening() {
    unsubscribeTheme?.()
    unsubscribeTheme = null
  }

  return {
    isDarkMode,
    backgroundColor,
    isInitialized,
    syncFromIde,
    startListening,
    stopListening,
  }
})

