// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@vueuse/nuxt', '@nuxt/eslint', 'nitro-cloudflare-dev', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  auth: { webAuthn: true },
  app: {
    // A base value so transitions are on at all; the global middleware swaps the
    // name per navigation to match the direction of travel.
    pageTransition: { name: 'surface-forward', mode: 'out-in' },
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
