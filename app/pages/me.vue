<script setup lang="ts">
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'

definePageMeta({ middleware: 'auth' })

useSeoMeta({
  title: '你的回報 · 拉麵Now',
  description: '你在登入狀態下回報過幾次。',
})

const { user, clear, fetch: fetchSession } = useUserSession()
const { register } = useWebAuthn({ registerEndpoint: '/api/webauthn/register' })
const { data } = await useFetch('/api/me/reports')

const count = computed(() => data.value?.count ?? 0)

// Null until mounted: the server can't know, and guessing either way would
// desync the markup it sent.
const supported = ref<boolean | null>(null)
onMounted(() => (supported.value = browserSupportsWebAuthn()))

const working = ref<'signout' | 'passkey' | null>(null)
const notice = ref('')

const statusLine = computed(() => {
  if (notice.value)
    return notice.value
  if (supported.value === false)
    return '這個瀏覽器不支援 Passkey，加不了新的一把。'

  return '匿名回報不屬於任何人，所以不算在這個數字裡。'
})

async function signOut() {
  if (working.value)
    return

  working.value = 'signout'
  notice.value = ''

  try {
    await $fetch('/api/logout', { method: 'POST' })
    await clear()
    await navigateTo('/')
  }
  catch {
    notice.value = '登出失敗，請再試一次'
    working.value = null
  }
}

async function addPasskey() {
  const label = user.value?.label

  if (!supported.value || working.value || !label)
    return

  working.value = 'passkey'
  notice.value = ''

  try {
    // The request carries the session, so the server files this credential under
    // the account already signed in instead of opening a second one. Passing the
    // existing label keeps both passkeys named the same in the OS picker.
    await register({ userName: label })
    await fetchSession()
    notice.value = '已加入這台裝置'
  }
  catch (error) {
    // Backing out of the system dialog isn't a failure, so it doesn't read as one.
    notice.value = (error as Error)?.name === 'NotAllowedError'
      ? '已取消，想加的時候再按一次就好。'
      : '加入失敗，請再試一次'
  }
  finally {
    working.value = null
  }
}
</script>

<template>
  <!-- The right edge is wider on phones, where the scroll indicator rides over it. -->
  <main class="mx-auto min-h-[100dvh] w-full max-w-[30rem] pb-24 pl-6 pr-8 pt-20 sm:pr-6">
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
      :class="notice || supported === false ? 'text-black/55' : 'text-black/25'"
      role="status"
    >
      {{ statusLine }}
    </p>

    <NuxtLink
      to="/"
      class="mt-10 inline-block text-[13px] leading-5 text-black/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/60"
    >
      ← 回看板
    </NuxtLink>

    <!-- A second passkey is a few people's problem, so it sits at logout's weight. -->
    <footer class="mt-16 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[11px] leading-4">
      <span class="text-black/25">現在是「{{ user?.label }}」</span>
      <button
        type="button"
        :disabled="working !== null"
        class="text-black/35 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-black/70"
        @click="signOut()"
      >
        {{ working === 'signout' ? '登出中…' : '登出' }}
      </button>
      <button
        type="button"
        :disabled="supported === false || working !== null"
        class="text-black/35 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-black/70"
        @click="addPasskey()"
      >
        {{ working === 'passkey' ? '加入中…' : '在這台裝置也加一把 Passkey' }}
      </button>
    </footer>
  </main>
</template>
