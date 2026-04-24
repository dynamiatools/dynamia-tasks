<script setup lang="ts">
const props = defineProps<{ label: { name: string; color?: string } }>()

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const sat = saturation / 100
  const light = lightness / 100
  const chroma = (1 - Math.abs(2 * light - 1)) * sat
  const segment = hue / 60
  const x = chroma * (1 - Math.abs(segment % 2 - 1))

  let red = 0
  let green = 0
  let blue = 0

  if (segment >= 0 && segment < 1) {
    red = chroma
    green = x
  } else if (segment < 2) {
    red = x
    green = chroma
  } else if (segment < 3) {
    green = chroma
    blue = x
  } else if (segment < 4) {
    green = x
    blue = chroma
  } else if (segment < 5) {
    red = x
    blue = chroma
  } else {
    red = chroma
    blue = x
  }

  const match = light - chroma / 2
  const toHex = (value: number) => Math.round((value + match) * 255).toString(16).padStart(2, '0')
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return hslToHex(hue, 52, 48)
}

function resolveColor(input: string | undefined, labelName: string): string {
  if (!input) return colorForName(labelName)
  const raw = input.trim()
  const noHash = raw.replace(/^#/, '')

  if (/^[0-9a-fA-F]{3}$/.test(noHash) || /^[0-9a-fA-F]{6}$/.test(noHash) || /^[0-9a-fA-F]{8}$/.test(noHash)) {
    return `#${noHash}`
  }

  // Accept valid CSS color formats (rgb/hsl/named) as-is.
  return raw || colorForName(labelName)
}

const hex = computed(() => resolveColor(props.label.color, props.label.name))

const labelStyle = computed(() => ({
  '--label-color': hex.value,
  backgroundColor: `color-mix(in srgb, ${hex.value} 22%, #1e1e1e)`,
  color:           `color-mix(in srgb, ${hex.value} 75%, #ffffff)`,
  borderColor:     `color-mix(in srgb, ${hex.value} 55%, transparent)`,
}))
</script>

<template>
  <span
    :style="labelStyle"
    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide border"
  >
    <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: hex }" />
    {{ label.name }}
  </span>
</template>
