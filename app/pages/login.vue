<script setup lang="ts">
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'

definePageMeta({
  middleware() {
    const { loggedIn } = useUserSession()

    if (loggedIn.value)
      return navigateTo('/me')
  },
})

useSeoMeta({
  title: '用 Passkey 登入 · 拉麵Now',
  description: '用一把 passkey 登入，之後的回報就會記在你名下。',
})

const { register, authenticate } = useWebAuthn({
  registerEndpoint: '/api/webauthn/register',
  authenticateEndpoint: '/api/webauthn/authenticate',
})
const { fetch: fetchSession } = useUserSession()

// Null until mounted: the server can't know, and guessing either way would
// desync the markup it sent.
const supported = ref<boolean | null>(null)
onMounted(() => (supported.value = browserSupportsWebAuthn()))

const working = ref<'signin' | 'create' | null>(null)
const notice = ref('')

const statusLine = computed(() => {
  if (notice.value)
    return notice.value
  if (supported.value === false)
    return '這個瀏覽器不支援 Passkey，換一個瀏覽器再試試。'

  return '不用填任何東西，系統會問你要用哪一把。'
})

/** The label is only what the OS passkey picker shows; collisions don't matter. */
function randomTag() {
  const bytes = crypto.getRandomValues(new Uint8Array(2))
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

const CANCELLED = {
  signin: '已取消，想登入的時候再按一次就好。',
  create: '已取消，想建立的時候再按一次就好。',
}

const FAILED = {
  signin: '登入失敗，請再試一次',
  create: '建立失敗，請再試一次',
}

async function startPasskey(kind: 'signin' | 'create') {
  if (!supported.value || working.value)
    return

  working.value = kind
  notice.value = ''

  try {
    // Signing in takes no arguments at all — no userName means no
    // allowCredentials, so the browser lists every passkey it holds for us.
    await (kind === 'signin'
      ? authenticate()
      : register({ userName: `拉麵Now #${randomTag()}` }))

    await fetchSession()
    await navigateTo('/me')
  }
  catch (error) {
    // Backing out of the system dialog isn't a failure, so it doesn't read as one.
    notice.value = (error as Error)?.name === 'NotAllowedError' ? CANCELLED[kind] : FAILED[kind]
  }
  finally {
    working.value = null
  }
}
</script>

<template>
  <main class="mx-auto min-h-[100dvh] w-full max-w-[30rem] px-6 pb-24 pt-20">
    <header>
      <h1 class="text-[22px] leading-7 tracking-tight text-black/90">
        用 Passkey 登入
      </h1>
      <p class="mt-1.5 text-[13px] leading-5 text-black/35">
        回報次數要記在誰身上，得先有一把 passkey。沒有帳號、沒有密碼，也不影響匿名回報。
      </p>
    </header>

    <!-- Most people arriving here already have a passkey, so signing in leads. -->
    <div class="mt-10 flex items-baseline gap-6">
      <button
        type="button"
        :disabled="supported === false || working !== null"
        class="text-[15px] leading-6 text-black/90 transition-[opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-25"
        @click="startPasskey('signin')"
      >
        {{ working === 'signin' ? '登入中…' : '用 Passkey 登入' }}
      </button>

      <button
        type="button"
        :disabled="supported === false || working !== null"
        class="text-[13px] leading-5 text-black/40 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-25 hover-fine:hover:text-black/80"
        @click="startPasskey('create')"
      >
        {{ working === 'create' ? '建立中…' : '建立新的 Passkey' }}
      </button>
    </div>

    <p
      class="mt-6 text-[11px] leading-4 transition-colors duration-200"
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
  </main>
</template>
