import { defineStore } from 'pinia'

const STORAGE_KEY = 'dt-preferences'

export const usePreferencesStore = defineStore('preferences', () => {
    const autoGroups = ref(true)
    const showLabels = ref(true)
    const compactMode = ref(false)
    const showOrigin = ref(true)
    const showDescription = ref(false)

    function load() {
        if (!process.client) return
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return
            const p = JSON.parse(raw)
            if (typeof p.autoGroups === 'boolean') autoGroups.value = p.autoGroups
            if (typeof p.showLabels === 'boolean') showLabels.value = p.showLabels
            if (typeof p.compactMode === 'boolean') compactMode.value = p.compactMode
            if (typeof p.showOrigin === 'boolean') showOrigin.value = p.showOrigin
            if (typeof p.showDescription === 'boolean') showDescription.value = p.showDescription
        } catch { }
    }

    function persist() {
        if (!process.client) return
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            autoGroups: autoGroups.value,
            showLabels: showLabels.value,
            compactMode: compactMode.value,
            showOrigin: showOrigin.value,
            showDescription: showDescription.value,
        }))
    }

    return { autoGroups, showLabels, compactMode, showOrigin, showDescription, load, persist }
})
