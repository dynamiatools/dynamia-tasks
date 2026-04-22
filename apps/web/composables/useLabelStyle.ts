/**
 * Returns bg + text Tailwind-compatible inline styles for a label.
 * Priority: label.color (hex) → name-based palette → default zinc.
 */

const LABEL_PALETTE: Record<string, { bg: string; text: string; border: string }> = {
  // GitHub defaults
  bug:           { bg: '#4c1010', text: '#fca5a5', border: '#991b1b' },
  enhancement:   { bg: '#0f3320', text: '#6ee7b7', border: '#065f46' },
  documentation: { bg: '#0f2040', text: '#93c5fd', border: '#1d4ed8' },
  duplicate:     { bg: '#2c2c30', text: '#d4d4d8', border: '#52525b' },
  'good first issue': { bg: '#0f3020', text: '#86efac', border: '#15803d' },
  'help wanted': { bg: '#2a200a', text: '#fde047', border: '#a16207' },
  invalid:       { bg: '#3a1a08', text: '#fdba74', border: '#c2410c' },
  question:      { bg: '#200f38', text: '#d8b4fe', border: '#7c3aed' },
  wontfix:       { bg: '#2c2c30', text: '#a1a1aa', border: '#52525b' },
  'won\'t fix':  { bg: '#2c2c30', text: '#a1a1aa', border: '#52525b' },
  // Common extras
  feature:       { bg: '#0f3320', text: '#6ee7b7', border: '#065f46' },
  fix:           { bg: '#4c1010', text: '#fca5a5', border: '#991b1b' },
  chore:         { bg: '#1a1a38', text: '#a5b4fc', border: '#4338ca' },
  refactor:      { bg: '#1a1a38', text: '#c7d2fe', border: '#4f46e5' },
  test:          { bg: '#0a2828', text: '#5eead4', border: '#0f766e' },
  ci:            { bg: '#2a1e08', text: '#fcd34d', border: '#b45309' },
  security:      { bg: '#3a1010', text: '#fca5a5', border: '#b91c1c' },
  performance:   { bg: '#0a1e30', text: '#7dd3fc', border: '#0369a1' },
  breaking:      { bg: '#4c1010', text: '#fca5a5', border: '#991b1b' },
  deprecated:    { bg: '#2a1808', text: '#fbbf24', border: '#92400e' },
  design:        { bg: '#280a38', text: '#f0abfc', border: '#7e22ce' },
  ux:            { bg: '#280a38', text: '#f5d0fe', border: '#86198f' },
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function useLabelStyle(label: { name: string; color?: string }) {
  const key = label.name.toLowerCase().trim()
  const preset = LABEL_PALETTE[key]

  if (preset) {
    return {
      style: {
        backgroundColor: preset.bg,
        color: preset.text,
        borderColor: preset.border,
      },
    }
  }

  if (label.color) {
    const hex = label.color.startsWith('#') ? label.color : `#${label.color}`
    const { r, g, b } = hexToRgb(hex)
    // Dark bg: 15% opacity; text: the color itself lightened; border: 40% opacity
    return {
      style: {
        backgroundColor: `rgba(${r},${g},${b},0.18)`,
        color: `rgba(${r},${g},${b},1)`,
        borderColor: `rgba(${r},${g},${b},0.45)`,
      },
    }
  }

  // Default zinc
  return {
    style: {
      backgroundColor: '#27272a',
      color: '#a1a1aa',
      borderColor: '#3f3f46',
    },
  }
}

