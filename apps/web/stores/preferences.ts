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
}

export const usePreferencesStore = defineStore('preferences', () => {
    const autoGroups = ref(true)
    const showLabels = ref(true)
    const compactMode = ref(false)
    const showOrigin = ref(true)
    const showDescription = ref(false)
    const smallFonts = ref(false)

    function apply(p: Partial<PreferencesPayload>) {
        if (typeof p.autoGroups === 'boolean') autoGroups.value = p.autoGroups
        if (typeof p.showLabels === 'boolean') showLabels.value = p.showLabels
        if (typeof p.compactMode === 'boolean') compactMode.value = p.compactMode
        if (typeof p.showOrigin === 'boolean') showOrigin.value = p.showOrigin
        if (typeof p.showDescription === 'boolean') showDescription.value = p.showDescription
        if (typeof p.smallFonts === 'boolean') smallFonts.value = p.smallFonts
    }

    function snapshot(): PreferencesPayload {
        return {
            autoGroups: autoGroups.value,
            showLabels: showLabels.value,
            compactMode: compactMode.value,
            showOrigin: showOrigin.value,
            showDescription: showDescription.value,
            smallFonts: smallFonts.value,
        }
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
    }

    return { autoGroups, showLabels, compactMode, showOrigin, showDescription, smallFonts, load, persist }
})
