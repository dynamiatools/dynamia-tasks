<script setup lang="ts">
defineProps<{ connectorId: string; size?: number }>()
</script>

<template>
  <!-- GitHub -->
  <svg
    v-if="connectorId === 'github'"
    :width="size ?? 15"
    :height="size ?? 15"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-label="GitHub"
  >
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
      0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
      -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
      .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
      -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
      1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
      1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
      1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
  </svg>

  <!-- Local folder -->
  <svg
    v-else-if="connectorId === 'local'"
    :width="size ?? 15"
    :height="size ?? 15"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-label="Local"
  >
    <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2
      2H4a2 2 0 01-2-2V6z"/>
  </svg>

  <!-- Fallback generic connector icon -->
  <svg
    v-else
    :width="size ?? 15"
    :height="size ?? 15"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-label="Connector"
  >
    <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0
      01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1
      1 0 011.12-.38z" clip-rule="evenodd"/>
  </svg>
</template>

