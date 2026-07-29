import materialSymbols from '@iconify-json/material-symbols/icons.json'

/**
 * The two seat icons, lifted out of Material Symbols at build time.
 *
 * `serverBundle: 'auto'` resolves to `remote` for edge presets, which would leave
 * the Worker fetching icon artwork from api.iconify.design during SSR — a network
 * hop in front of the one page people open to check a queue. Bundling the whole
 * collection isn't the answer either: icons.json is 8 MB. So hand it a collection
 * holding exactly what SeatCounts.vue draws.
 */
const seatIcons = {
  prefix: materialSymbols.prefix,
  width: materialSymbols.width,
  height: materialSymbols.height,
  icons: {
    'table-bar': materialSymbols.icons['table-bar'],
    'table-restaurant': materialSymbols.icons['table-restaurant'],
  },
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@vueuse/nuxt', '@nuxt/eslint', 'nitro-cloudflare-dev', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  auth: { webAuthn: true },
  app: {
    head: {
      htmlAttrs: { lang: 'zh-Hant-TW' },
      meta: [{ name: 'theme-color', content: '#fffdf9' }],
    },
  },
  colorMode: { preference: 'light', fallback: 'light' },
  icon: {
    serverBundle: { collections: [seatIcons] },
    clientBundle: { icons: ['material-symbols:table-bar', 'material-symbols:table-restaurant'] },
  },
  eslint: { config: { standalone: false } },
  nitro: {
    preset: 'cloudflare_module',
    cloudflare: { deployConfig: true, nodeCompat: true },
  },
})
