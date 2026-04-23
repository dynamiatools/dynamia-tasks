// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2026-04-21',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  // Register all components by filename only, regardless of subdirectory depth
  components: [{ path: '~/components', pathPrefix: false }],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      // Empty string → useApi falls back to window.location.origin (same-origin).
      // Override with NUXT_PUBLIC_API_BASE=http://localhost:7842 for standalone dev.
      apiBase: '',
    },
  },
  app: {
    head: {
      title: 'Dynamia Tasks',
      htmlAttrs: { class: 'dark' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
  tailwindcss: {
    config: {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
            mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
          },
          colors: {
            dt: {
              // Backgrounds
              bg:           '#1e1e1e',
              surface:      '#252526',
              raised:       '#2d2d30',
              // Borders
              border:       '#3e3e42',
              // Text
              text:         '#d4d4d4',
              muted:        '#858585',
              dim:          '#6a6a6a',
              body:         '#a0a0a0',
              // Accent (teal)
              accent:       '#4d9375',
              'accent-deep':'#1e3a2f',
              // Status
              danger:       '#f87171',
              'danger-bg':  '#3b1f1f',
              'danger-bdr': '#7f1d1d',
              warning:      '#f59e0b',
              'warning-bg': '#322917',
              'warning-bdr':'#78350f',
              success:      '#6ee7b7',
              'success-bg': '#1c2b22',
              'success-bdr':'#065f46',
              // Code
              code:         '#ce9178',
            },
          },
        },
      },
    },
  },
})
