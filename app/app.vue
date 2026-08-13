<script setup lang="ts">
// One listener for the whole app: the gesture no-ops on anything that isn't a
// main surface, so /login and /me need no exception here.
const shell = useTemplateRef<HTMLElement>('shell')
usePageSwipe(shell)

const { locale } = useLocale()
useHead({
  htmlAttrs: { lang: () => (locale.value === 'zh' ? 'zh-Hant-TW' : 'en') },
})
</script>

<template>
  <UApp>
    <RamenBackground />
    <div ref="shell">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
  </UApp>
</template>
