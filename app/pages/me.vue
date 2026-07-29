<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

useSeoMeta({
  title: '你的回報 · 拉麵Now',
  description: '你在登入狀態下回報過幾次。',
})

const { user, clear } = useUserSession()
const { data } = await useFetch('/api/me/reports')

const count = computed(() => data.value?.count ?? 0)

const working = ref(false)
const notice = ref('')

async function signOut() {
  if (working.value)
    return

  working.value = true
  notice.value = ''

  try {
    await $fetch('/api/logout', { method: 'POST' })
    await clear()
    await navigateTo('/')
  }
  catch {
    notice.value = '登出失敗，請再試一次'
    working.value = false
  }
}
</script>

<template>
  <main class="mx-auto min-h-[100dvh] w-full max-w-[30rem] px-6 pb-24 pt-20">
    <header>
      <h1 class="text-[22px] leading-7 tracking-tight text-black/90">
        你的回報
      </h1>
      <p class="mt-1.5 text-[13px] leading-5 text-black/35">
        登入之後回報的次數會記在這裡。
      </p>
    </header>

    <!-- A bare 0 reads as broken, so an empty count says something instead. -->
    <p v-if="count === 0" class="mt-12 text-[17px] leading-7 text-black/70">
      還沒有回報過，路過的時候按一下。
    </p>

    <p v-else class="mt-12 text-[17px] leading-7 text-black/70">
      你已經回報過
      <span class="mx-1.5 text-[40px] leading-none tracking-tight text-black/90 tabular-nums">{{ count }}</span>
      次
    </p>

    <p
      class="mt-8 text-[11px] leading-4 transition-colors duration-200"
      :class="notice ? 'text-black/55' : 'text-black/25'"
      role="status"
    >
      {{ notice || '匿名回報不屬於任何人，所以不算在這個數字裡。' }}
    </p>

    <NuxtLink
      to="/"
      class="mt-10 inline-block text-[13px] leading-5 text-black/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/60"
    >
      ← 回看板
    </NuxtLink>

    <footer class="mt-16 flex items-baseline gap-4 text-[11px] leading-4">
      <span class="text-black/25">現在是「{{ user?.label }}」</span>
      <button
        type="button"
        :disabled="working"
        class="text-black/35 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-black/70"
        @click="signOut()"
      >
        {{ working ? '登出中…' : '登出' }}
      </button>
    </footer>
  </main>
</template>
