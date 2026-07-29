<script setup lang="ts">
import type { MessageKey } from '~/i18n/messages'
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'

definePageMeta({ middleware: 'auth' })

const { t } = useLocale()

// Getters, not strings, so the tab title follows the language toggle too.
useSeoMeta({
  title: () => t('me.seoTitle'),
  description: () => t('me.seoDescription'),
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

// A key, not a string: nothing here clears on a timer, so a notice can still be
// on screen when the language is switched and has to follow it.
const noticeKey = ref<MessageKey | null>(null)

const statusLine = computed(() => {
  if (noticeKey.value)
    return t(noticeKey.value)
  if (supported.value === false)
    return t('me.passkeyUnsupported')

  return t('me.anonNote')
})

async function signOut() {
  if (working.value)
    return

  working.value = 'signout'
  noticeKey.value = null

  try {
    await $fetch('/api/logout', { method: 'POST' })
    await clear()
    await navigateTo('/')
  }
  catch {
    noticeKey.value = 'me.signOutFailed'
    working.value = null
  }
}

async function addPasskey() {
  const label = user.value?.label

  if (!supported.value || working.value || !label)
    return

  working.value = 'passkey'
  noticeKey.value = null

  try {
    // The request carries the session, so the server files this credential under
    // the account already signed in instead of opening a second one. Passing the
    // existing label keeps both passkeys named the same in the OS picker.
    await register({ userName: label })
    await fetchSession()
    noticeKey.value = 'me.passkeyAdded'
  }
  catch (error) {
    // Backing out of the system dialog isn't a failure, so it doesn't read as one.
    noticeKey.value = (error as Error)?.name === 'NotAllowedError'
      ? 'me.passkeyCancelled'
      : 'me.passkeyFailed'
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
        {{ t('me.title') }}
      </h1>
      <p class="mt-1.5 text-[13px] leading-5 text-black/35">
        {{ t('me.tagline') }}
      </p>
    </header>

    <!-- A bare 0 reads as broken, so an empty count says something instead. -->
    <p v-if="count === 0" class="mt-12 text-[17px] leading-7 text-black/70">
      {{ t('me.zero') }}
    </p>

    <p v-else class="mt-12 text-[17px] leading-7 text-black/70">
      {{ t('me.countPrefix') }}
      <span class="mx-1.5 text-[40px] leading-none tracking-tight text-black/90 tabular-nums">{{ count }}</span>
      {{ count === 1 ? t('me.countSuffixOne') : t('me.countSuffixMany') }}
    </p>

    <p
      class="mt-8 text-[11px] leading-4 transition-colors duration-200"
      :class="noticeKey || supported === false ? 'text-black/55' : 'text-black/25'"
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

    <!-- A second passkey is a few people's problem, so it sits at logout's weight. -->
    <footer class="mt-16 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[11px] leading-4">
      <span class="text-black/25">{{ t('me.currentUser', { label: user?.label ?? '' }) }}</span>
      <button
        type="button"
        :disabled="working !== null"
        class="text-black/35 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-black/70"
        @click="signOut()"
      >
        {{ working === 'signout' ? t('me.signingOut') : t('me.signOut') }}
      </button>
      <button
        type="button"
        :disabled="supported === false || working !== null"
        class="text-black/35 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-black/70"
        @click="addPasskey()"
      >
        {{ working === 'passkey' ? t('me.addingPasskey') : t('me.addPasskey') }}
      </button>
    </footer>
  </main>
</template>
