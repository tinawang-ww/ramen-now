<script setup lang="ts">
const route = useRoute()
const { loggedIn, user } = useUserSession()
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
        {{ surface.label }}
      </NuxtLink>
    </div>

    <!-- One tappable thing only — signing out lives on /me, not here. -->
    <NuxtLink
      :to="loggedIn ? '/me' : '/login'"
      class="max-w-[7rem] shrink-0 truncate text-[11px] leading-4 text-black/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/60"
    >
      {{ loggedIn ? user?.label : '登入' }}
    </NuxtLink>
  </nav>
</template>
