<script setup lang="ts">
const route = useRoute()
const { loggedIn, user } = useUserSession()
const { t, toggleLocale } = useLocale()
</script>

<template>
  <!--
    Sticky, with the page's own paper blurred behind it: on a long board the
    other surface stays one tap away. Negative margins mirror <main>'s padding
    so the bar bleeds edge to edge.
  -->
  <nav class="sticky top-0 z-20 -ml-6 -mr-8 flex items-baseline justify-between gap-4 bg-paper/85 py-3 pl-6 pr-8 backdrop-blur-sm sm:-mr-6 sm:pr-6">
    <div class="flex min-w-0 items-baseline gap-5">
      <!-- The mark makes it a product; weight alone still marks the current surface. -->
      <NuxtLink to="/" class="flex items-center gap-1.5 transition-transform duration-150 ease-out-strong active:scale-[0.97]">
        <BrandMark class="translate-y-[1px]" />
        <span class="text-[13px] font-semibold leading-5 tracking-tight text-ink/90">{{ t('nav.brand') }}</span>
      </NuxtLink>

      <NuxtLink
        v-for="surface in SURFACES"
        :key="surface.path"
        :to="surface.path"
        :aria-current="route.path === surface.path ? 'page' : undefined"
        class="text-[13px] leading-5 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97]"
        :class="route.path === surface.path
          ? 'text-ink/90'
          : 'text-ink/30 hover-fine:hover:text-ink/60'"
      >
        {{ t(surface.labelKey) }}
      </NuxtLink>
    </div>

    <div class="flex shrink-0 items-baseline gap-4">
      <!-- Shows the language you'd switch to, not the one you're in. -->
      <button
        type="button"
        :aria-label="t('nav.localeAria')"
        class="text-[11px] leading-4 text-ink/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-ink/60"
        @click="toggleLocale()"
      >
        {{ t('nav.localeButton') }}
      </button>

      <!-- Signing out lives on /me, not here. -->
      <NuxtLink
        :to="loggedIn ? '/me' : '/login'"
        class="max-w-[7rem] truncate text-[11px] leading-4 text-ink/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-ink/60"
      >
        {{ loggedIn ? user?.label : t('nav.signIn') }}
      </NuxtLink>
    </div>
  </nav>
</template>
