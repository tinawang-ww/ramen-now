<script setup lang="ts">
const { loggedIn, user } = useUserSession()
const { t, toggleLocale } = useLocale()
</script>

<template>
  <nav class="flex items-baseline justify-between gap-4">
    <!-- Weight alone marks the current surface: this app has no boxed UI anywhere. -->
    <div class="flex min-w-0 items-baseline gap-5">
      <!--
        `raw` keeps ULink's own theme out of it and leaves only what it's here
        for: resolving the active route, which lands aria-current="page" too.
        `exact` matters — without it "/" reads as active on every surface.
      -->
      <ULink
        v-for="surface in SURFACES"
        :key="surface.path"
        raw
        exact
        :to="surface.path"
        class="text-[13px] leading-5 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97]"
        active-class="text-black/90"
        inactive-class="text-black/30 hover-fine:hover:text-black/60"
      >
        {{ t(surface.labelKey) }}
      </ULink>
    </div>

    <div class="flex shrink-0 items-baseline gap-4">
      <!-- Shows the language you'd switch to, not the one you're in. -->
      <ULink
        raw
        as="button"
        :aria-label="t('nav.localeAria')"
        class="text-[11px] leading-4 text-black/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/60"
        @click="toggleLocale()"
      >
        {{ t('nav.localeButton') }}
      </ULink>

      <!-- Signing out lives on /me, not here. -->
      <ULink
        raw
        :to="loggedIn ? '/me' : '/login'"
        class="max-w-[7rem] truncate text-[11px] leading-4 text-black/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/60"
      >
        {{ loggedIn ? user?.label : t('nav.signIn') }}
      </ULink>
    </div>
  </nav>
</template>
