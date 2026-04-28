import { defineStore } from 'pinia'
import { ide } from '@dynamia-tools/ide-bridge'

const STORAGE_KEY = 'dt-preferences'
const STORE_KEY = 'preferences.ui'
const STORE_OPTIONS = { scope: 'global' as const }

type PreferencesPayload = {
    autoGroups: boolean
    showLabels: boolean
    compactMode: boolean
    showOrigin: boolean
    showDescription: boolean
    smallFonts: boolean
    accentColor: string
}

const DEFAULT_ACCENT = '#4d9375'

function normalizeHexColor(value: string | undefined | null): string {
    const candidate = (value ?? '').trim()
    if (!/^#[0-9a-fA-F]{6}$/.test(candidate)) return DEFAULT_ACCENT
    return candidate.toLowerCase()
}

function hexToRgb(hex: string): [number, number, number] {
    const normalized = normalizeHexColor(hex).slice(1)
    return [
        parseInt(normalized.slice(0, 2), 16),
        parseInt(normalized.slice(2, 4), 16),
        parseInt(normalized.slice(4, 6), 16),
    ]
}

function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
    return `#${[clamp(r), clamp(g), clamp(b)].map(n => n.toString(16).padStart(2, '0')).join('')}`
}

function toAccentDeep(accent: string): string {
    const [r, g, b] = hexToRgb(accent)
    const factor = 0.34
    return rgbToHex(r * factor, g * factor, b * factor)
}

function applyAccentCssVars(accent: string) {
    if (!process.client) return
    const root = document.documentElement
    const normalized = normalizeHexColor(accent)
    const deep = toAccentDeep(normalized)
    const [ar, ag, ab] = hexToRgb(normalized)
    const [dr, dg, db] = hexToRgb(deep)

    root.style.setProperty('--accent', normalized)
    root.style.setProperty('--accent-deep', deep)
    root.style.setProperty('--dt-accent-rgb', `${ar} ${ag} ${ab}`)
    root.style.setProperty('--dt-accent-deep-rgb', `${dr} ${dg} ${db}`)
}

export const usePreferencesStore = defineStore('preferences', () => {
    const autoGroups = ref(true)
    const showLabels = ref(true)
    const compactMode = ref(false)
    const showOrigin = ref(true)
    const showDescription = ref(false)
    const smallFonts = ref(false)
    const accentColor = ref(DEFAULT_ACCENT)

    function apply(p: Partial<PreferencesPayload>) {
        if (typeof p.autoGroups === 'boolean') autoGroups.value = p.autoGroups
        if (typeof p.showLabels === 'boolean') showLabels.value = p.showLabels
        if (typeof p.compactMode === 'boolean') compactMode.value = p.compactMode
        if (typeof p.showOrigin === 'boolean') showOrigin.value = p.showOrigin
        if (typeof p.showDescription === 'boolean') showDescription.value = p.showDescription
        if (typeof p.smallFonts === 'boolean') smallFonts.value = p.smallFonts
        if (typeof p.accentColor === 'string') accentColor.value = normalizeHexColor(p.accentColor)
        applyAccentCssVars(accentColor.value)
    }

    function snapshot(): PreferencesPayload {
        return {
            autoGroups: autoGroups.value,
            showLabels: showLabels.value,
            compactMode: compactMode.value,
            showOrigin: showOrigin.value,
            showDescription: showDescription.value,
            smallFonts: smallFonts.value,
            accentColor: accentColor.value,
        }
    }

    async function setAccentColor(color: string) {
        accentColor.value = normalizeHexColor(color)
        applyAccentCssVars(accentColor.value)
        await persist()
    }

    async function load() {
        if (!process.client) return
        try {
            const stored = await ide.store.get<PreferencesPayload>(STORE_KEY, STORE_OPTIONS)
            if (stored) {
                apply(stored)
                return
            }
        } catch {
            // Fallback for standalone web dev without an active IDE bridge host.
        }

        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return
            const legacy = JSON.parse(raw) as Partial<PreferencesPayload>
            apply(legacy)
            await persist()
        } catch { }
    }

    async function persist() {
        if (!process.client) return
        const current = snapshot()
        try {
            await ide.store.set(STORE_KEY, current, STORE_OPTIONS)
        } catch {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
        }

        applyAccentCssVars(accentColor.value)
    }

    return { autoGroups, showLabels, compactMode, showOrigin, showDescription, smallFonts, accentColor, setAccentColor, load, persist }
})
