<script setup lang="ts">
const route = useRoute()
const { loggedIn, user } = useUserSession()
const { t, toggleLocale } = useLocale()
</script>

<template>
  <nav class="flex items-baseline justify-between gap-4">
    <!-- Weight alone marks the current surface: this app has no boxed UI anywhere. -->
    <div class="flex min-w-0 items-baseline gap-5">
      <NuxtLink
        v-for="surface in SURFACES"
        :key="surface.path"
        :to="surface.path"
        :aria-current="route.path === surface.path ? 'page' : undefined"
        class="text-[13px] leading-5 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97]"
        :class="route.path === surface.path
          ? 'text-black/90'
          : 'text-black/30 hover-fine:hover:text-black/60'"
      >
        {{ t(surface.labelKey) }}
      </NuxtLink>
    </div>

    <div class="flex shrink-0 items-baseline gap-4">
      <!-- Shows the language you'd switch to, not the one you're in. -->
      <button
        type="button"
        :aria-label="t('nav.localeAria')"
        class="text-[11px] leading-4 text-black/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/60"
        @click="toggleLocale()"
      >
        {{ t('nav.localeButton') }}
      </button>

      <!-- Signing out lives on /me, not here. -->
      <NuxtLink
        :to="loggedIn ? '/me' : '/login'"
        class="max-w-[7rem] truncate text-[11px] leading-4 text-black/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/60"
      >
        {{ loggedIn ? user?.label : t('nav.signIn') }}
      </NuxtLink>
    </div>
  </nav>
</template>
