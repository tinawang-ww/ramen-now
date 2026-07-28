// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@vueuse/nuxt', '@nuxt/eslint', 'nitro-cloudflare-dev'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'zh-Hant-TW' },
      meta: [{ name: 'theme-color', content: '#ffffff' }],
    },
  },
  colorMode: { preference: 'light', fallback: 'light' },
  eslint: { config: { standalone: false } },
  nitro: {
    preset: 'cloudflare_module',
    cloudflare: { deployConfig: true, nodeCompat: true },
  },
})
