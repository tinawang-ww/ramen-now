<script setup lang="ts">
const { loggedIn, user } = useUserSession()
const { t, toggleLocale } = useLocale()
</script>

<template>
  <nav class="flex items-baseline justify-between w-full">
    <div class="flex items-baseline gap-x-6">
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
        active-class="text-ink"
        inactive-class="text-ink/30 hover-fine:hover:text-ink/60"
      >
        {{ t(surface.labelKey) }}
      </ULink>
    </div>

    <div class="flex items-baseline gap-x-6">
      <!-- Shows the language you'd switch to, not the one you're in. -->
      <ULink
        raw
        as="button"
        :aria-label="t('nav.localeAria')"
        class="text-[11px] leading-4 text-ink/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-ink/60"
        @click="toggleLocale()"
      >
        {{ t('nav.localeButton') }}
      </ULink>

      <!-- Signing out lives on /me, not here. -->
      <ULink
        raw
        :to="loggedIn ? '/me' : '/login'"
        class="max-w-[7rem] truncate text-[11px] leading-4 text-ink/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-ink/60"
      >
        {{ loggedIn ? t('nav.me') : t('nav.signIn') }}
      </ULink>
    </div>
  </nav>
</template>
