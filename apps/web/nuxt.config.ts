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
              bg:           'rgb(var(--dt-bg-rgb) / <alpha-value>)',
              surface:      'rgb(var(--dt-surface-rgb) / <alpha-value>)',
              raised:       'rgb(var(--dt-raised-rgb) / <alpha-value>)',
              // Borders
              border:       'rgb(var(--dt-border-rgb) / <alpha-value>)',
              // Text
              text:         'rgb(var(--dt-text-rgb) / <alpha-value>)',
              muted:        'rgb(var(--dt-muted-rgb) / <alpha-value>)',
              dim:          'rgb(var(--dt-dim-rgb) / <alpha-value>)',
              body:         'rgb(var(--dt-body-rgb) / <alpha-value>)',
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
