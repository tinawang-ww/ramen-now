<script setup lang="ts">
import type { StampSummary } from '~~/shared/types'
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
const { data: stamps } = await useFetch('/api/me/stamps', {
  default: (): StampSummary[] => [],
})

const count = computed(() => data.value?.count ?? 0)

/**
 * Stamp inks. Which shop gets which ink is arbitrary but stable — keyed on the
 * id, so a stamp never changes color between visits.
 */
const STAMP_TONES = [
  'border-accent/70 text-accent',
  'border-mist text-mist',
  'border-matcha text-matcha',
  'border-ink/40 text-ink/55',
]

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
    return t('me.passkeyUnsupported')

  return t('me.anonNote')
})

const sharingStamps = ref(false)

/**
 * The stamp book as a PNG — native share sheet where files can be shared,
 * a plain download everywhere else. Either way it leaves as an image, which
 * is the format feeds and chats actually pass around.
 */
async function shareStamps() {
  if (sharingStamps.value || !stamps.value.length)
    return

  sharingStamps.value = true
  notice.value = ''

  try {
    const blob = await renderStampBook(stamps.value, {
      title: t('me.stamps'),
      subtitle: `${user.value?.label ?? ''} · ${t('me.shareCardShops', { count: stamps.value.length })}`,
      more: stamps.value.length > 12
        ? t('me.shareCardMore', { count: stamps.value.length - 12 })
        : '',
      tagline: t('board.tagline'),
      origin: location.host,
      regularLabel: t('me.regular'),
    })
    const file = new File([blob], 'ramen-now-stamps.png', { type: 'image/png' })

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] })
    }
    else {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      URL.revokeObjectURL(url)
      notice.value = t('me.stampsDownloaded')
    }
  }
  catch (error) {
    // Closing the share sheet isn't a failure, so it doesn't read as one.
    if ((error as Error)?.name !== 'AbortError')
      notice.value = t('me.shareStampsFailed')
  }
  finally {
    sharingStamps.value = false
  }
}

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
    notice.value = t('me.signOutFailed')
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
    notice.value = t('me.passkeyAdded')
  }
  catch (error) {
    // Backing out of the system dialog isn't a failure, so it doesn't read as one.
    notice.value = (error as Error)?.name === 'NotAllowedError'
      ? t('me.passkeyCancelled')
      : t('me.passkeyFailed')
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
      <h1 class="text-[22px] leading-7 tracking-tight text-ink/90">
        {{ t('me.title') }}
      </h1>
      <p class="mt-1.5 text-[13px] leading-5 text-ink/35">
        {{ t('me.tagline') }}
      </p>
    </header>

    <!-- A bare 0 reads as broken, so an empty count says something instead. -->
    <p v-if="count === 0" class="mt-12 text-[17px] leading-7 text-ink/70">
      {{ t('me.zero') }}
    </p>

    <p v-else class="mt-12 text-[17px] leading-7 text-ink/70">
      {{ t('me.countPrefix') }}
      <span class="mx-1.5 text-[40px] leading-none tracking-tight text-ink/90 tabular-nums">{{ count }}</span>
      {{ t('me.countSuffix') }}
    </p>

    <!-- The stamp book: one page-worth of round inked stamps, oldest first. -->
    <section v-if="stamps.length" class="mt-12">
      <h2 class="text-[13px] leading-5 text-ink/70">
        {{ t('me.stamps') }}
      </h2>
      <p class="mt-0.5 text-[11px] leading-4 text-ink/35">
        {{ t('me.stampsHint') }}
      </p>

      <ul class="mt-5 flex flex-wrap gap-x-5 gap-y-6">
        <li v-for="stamp in stamps" :key="stamp.shopId" class="w-[4.5rem]">
          <!--
            Rotation is keyed on the id too: hand-stamped, but never re-inked.
            The chop earns its look: a dashed second ring at ×3, gold at ×10 —
            the outline inherits the tone via currentColor.
          -->
          <span
            class="mx-auto flex size-[4.5rem] flex-col items-center justify-center rounded-full border-2"
            :class="[
              STAMP_TONES[stamp.shopId % STAMP_TONES.length],
              stamp.reports >= 3 ? 'outline outline-1 outline-offset-2 outline-dashed' : '',
              stamp.reports >= 10 ? 'bg-marigold/25' : '',
            ]"
            :style="{ transform: `rotate(${(stamp.shopId % 7) - 3}deg)` }"
            aria-hidden="true"
          >
            <span class="text-[22px] leading-7">{{ [...stamp.name][0] }}</span>
            <span class="text-[10px] leading-3 tabular-nums">×{{ stamp.reports }}</span>
          </span>
          <span class="mt-1.5 block truncate text-center text-[10px] leading-4 text-ink/45">
            {{ stamp.name }}
          </span>
          <span class="block text-center text-[9px] leading-3 tabular-nums text-mist">
            {{ stampDate(stamp.firstAt) }}
          </span>
          <!-- Nobody has reported here more than they have. -->
          <span
            v-if="stamp.regular"
            class="mx-auto mt-1 block w-fit rounded-full bg-marigold/40 px-1.5 text-[9px] leading-[14px] text-ink/70"
          >
            {{ t('me.regular') }}
          </span>
        </li>
      </ul>

      <!-- The book leaves as an image — feeds and chats don't pass around links to /me. -->
      <button
        type="button"
        :disabled="sharingStamps"
        class="mt-5 text-[12px] leading-4 text-ink/35 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-accent"
        @click="shareStamps()"
      >
        {{ sharingStamps ? t('me.sharingStamps') : t('me.shareStamps') }}
      </button>
    </section>

    <p
      class="mt-8 text-[11px] leading-4 transition-colors duration-200"
      :class="notice ? 'text-accent/90' : (supported === false ? 'text-ink/55' : 'text-ink/25')"
      role="status"
    >
      {{ statusLine }}
    </p>

    <NuxtLink
      to="/"
      class="mt-10 inline-block text-[13px] leading-5 text-ink/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-ink/60"
    >
      {{ t('common.backToBoard') }}
    </NuxtLink>

    <!-- A second passkey is a few people's problem, so it sits at logout's weight. -->
    <footer class="mt-16 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[11px] leading-4">
      <span class="text-ink/25">{{ t('me.currentUser', { label: user?.label ?? '' }) }}</span>
      <button
        type="button"
        :disabled="working !== null"
        class="text-ink/35 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-ink/70"
        @click="signOut()"
      >
        {{ working === 'signout' ? t('me.signingOut') : t('me.signOut') }}
      </button>
      <button
        type="button"
        :disabled="supported === false || working !== null"
        class="text-ink/35 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-ink/70"
        @click="addPasskey()"
      >
        {{ working === 'passkey' ? t('me.addingPasskey') : t('me.addPasskey') }}
      </button>
    </footer>
  </main>
</template>
