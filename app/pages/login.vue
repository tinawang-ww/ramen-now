<script setup lang="ts">
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'

definePageMeta({
  middleware() {
    const { loggedIn } = useUserSession()

    if (loggedIn.value)
      return navigateTo('/me')
  },
})

const { t } = useLocale()

// Getters, not strings, so the tab title follows the language toggle too.
useSeoMeta({
  title: () => t('login.seoTitle'),
  description: () => t('login.seoDescription'),
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
    return t('login.unsupported')

  return t('login.hint')
})

/** The label is only what the OS passkey picker shows; collisions don't matter. */
function randomTag() {
  const bytes = crypto.getRandomValues(new Uint8Array(2))
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

const CANCELLED = {
  signin: 'login.signInCancelled',
  create: 'login.createCancelled',
} as const

const FAILED = {
  signin: 'login.signInFailed',
  create: 'login.createFailed',
} as const

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
    notice.value = t((error as Error)?.name === 'NotAllowedError' ? CANCELLED[kind] : FAILED[kind])
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
        {{ t('login.title') }}
      </h1>
      <p class="mt-1.5 text-[13px] leading-5 text-black/35">
        {{ t('login.tagline') }}
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
        {{ working === 'signin' ? t('login.signingIn') : t('login.signIn') }}
      </button>

      <button
        type="button"
        :disabled="supported === false || working !== null"
        class="text-[13px] leading-5 text-black/40 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-25 hover-fine:hover:text-black/80"
        @click="startPasskey('create')"
      >
        {{ working === 'create' ? t('login.creating') : t('login.create') }}
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
      {{ t('common.backToBoard') }}
    </NuxtLink>
  </main>
</template>
