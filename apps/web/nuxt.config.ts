// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2026-04-21',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:7842',
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
        },
      },
    },
  },
})
