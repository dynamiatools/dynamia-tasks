// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2026-04-21',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  // Register all components by filename only, regardless of subdirectory depth
  components: [{ path: '~/components', pathPrefix: false }],
  css: ['~/assets/css/main.css'],

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
              // Accent (runtime via CSS variables)
              accent:       'rgb(var(--dt-accent-rgb) / <alpha-value>)',
              'accent-deep':'rgb(var(--dt-accent-deep-rgb) / <alpha-value>)',
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
