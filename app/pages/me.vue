<script setup lang="ts">
import type { StampSummary } from '~~/shared/types'
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
const { data: stamps } = await useFetch('/api/me/stamps', {
  default: (): StampSummary[] => [],
})

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

/**
 * Stamp inks. Which shop gets which ink is arbitrary but stable — keyed on the
 * id, so a stamp never changes color between visits. Gold overrides at ×10.
 */
const STAMP_TONES = [
  'border-accent/70 text-accent',
  'border-mist text-mist',
  'border-matcha text-matcha',
  'border-ink/40 text-ink/55',
]

const STAMP_FILENAME = 'ramen-now-stamps.png'

const stampAction = ref<'share' | 'copy' | null>(null)

/** The card itself. Both endings want the same PNG, so only the ending differs. */
function drawStampBook() {
  return renderStampBook(stamps.value, {
    title: t('me.stamps'),
    subtitle: `${user.value?.label ?? ''} · ${t('me.shareCardShops', { count: stamps.value.length })}`,
    more: stamps.value.length > 12
      ? t('me.shareCardMore', { count: stamps.value.length - 12 })
      : '',
    tagline: t('board.tagline'),
    origin: location.host,
    regularLabel: t('me.regular'),
  })
}

/**
 * The stamp book as a PNG — native share sheet where files can be shared,
 * a plain download everywhere else. Either way it leaves as an image, which
 * is the format feeds and chats actually pass around.
 *
 * Drawing the card costs enough time that the tap's activation may be spent by
 * the time the sheet is asked for, and Safari refuses it on those grounds. So a
 * refused sheet is not the end: it falls through to the download, which needs
 * no gesture. Only a backed-out sheet ends quietly, because that was a choice.
 */
async function shareStamps() {
  if (stampAction.value || !stamps.value.length)
    return

  stampAction.value = 'share'
  noticeKey.value = null

  try {
    const blob = await drawStampBook()
    const file = new File([blob], STAMP_FILENAME, { type: 'image/png' })

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })

        return
      }
      catch (error) {
        // Backing out of the sheet isn't a failure, so it doesn't read as one.
        if ((error as Error)?.name === 'AbortError')
          return
      }
    }

    downloadBlob(blob, file.name)
    noticeKey.value = 'me.stampsDownloaded'
  }
  catch {
    noticeKey.value = 'me.shareStampsFailed'
  }
  finally {
    stampAction.value = null
  }
}

/**
 * Straight onto the clipboard, for the chats and posts that take a paste but
 * won't take a file. Where there's no image clipboard the file is the closest
 * thing to a paste, so it downloads rather than dead-ending.
 */
async function copyStamps() {
  if (stampAction.value || !stamps.value.length)
    return

  stampAction.value = 'copy'
  noticeKey.value = null

  try {
    const blob = await drawStampBook()

    if (await copyImage(blob)) {
      noticeKey.value = 'me.stampsCopied'
    }
    else {
      downloadBlob(blob, STAMP_FILENAME)
      noticeKey.value = 'me.stampsDownloaded'
    }
  }
  catch {
    noticeKey.value = 'me.copyStampsFailed'
  }
  finally {
    stampAction.value = null
  }
}

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
  <main class="mx-auto min-h-[100dvh] w-full max-w-[30rem] bg-paper/55 pb-24 pl-6 pr-8 pt-20 backdrop-blur-2xl backdrop-saturate-150 sm:pr-6">
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
      {{ count === 1 ? t('me.countSuffixOne') : t('me.countSuffixMany') }}
    </p>

    <!-- The stamp book: one page-worth of inked bowls, oldest first. -->
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
            The same bowl art the board wears, rotated by the id so it reads
            hand-stamped but never re-inks. The chop earns its look: a dashed
            second ring at ×3 (outline inherits the tone via currentColor),
            marigold gold at ×10.
          -->
          <span
            class="relative mx-auto block size-[4.5rem] rounded-full border-2"
            :class="[
              stamp.reports >= 10 ? 'border-marigold text-marigold border-[3px]' : STAMP_TONES[stamp.shopId % STAMP_TONES.length],
              stamp.reports >= 3 ? 'outline outline-1 outline-offset-2 outline-dashed' : '',
            ]"
            :style="{ transform: `rotate(${(stamp.shopId % 7) - 3}deg)` }"
            aria-hidden="true"
          >
            <img :src="shopStampSrc(stamp.shopId)" class="size-full rounded-full object-cover" alt="">
            <span class="absolute -bottom-1 -right-1 rounded-full bg-paper px-1.5 text-[10px] leading-4 tabular-nums text-ink/70 ring-1 ring-ink/10">×{{ stamp.reports }}</span>
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

      <!--
        The book leaves as an image — feeds and chats don't pass around links to
        /me. Two ways out, at the same weight: the share sheet for phones, the
        clipboard for everywhere a paste is quicker than a file.
      -->
      <div class="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-[12px] leading-4">
        <button
          type="button"
          :disabled="stampAction !== null"
          class="text-ink/35 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-accent"
          @click="shareStamps()"
        >
          {{ stampAction === 'share' ? t('me.sharingStamps') : t('me.shareStamps') }}
        </button>
        <button
          type="button"
          :disabled="stampAction !== null"
          class="text-ink/35 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-accent"
          @click="copyStamps()"
        >
          {{ stampAction === 'copy' ? t('me.copyingStamps') : t('me.copyStamps') }}
        </button>
      </div>
    </section>

    <p
      class="mt-8 text-[11px] leading-4 transition-colors duration-200"
      :class="noticeKey ? 'text-accent/90' : (supported === false ? 'text-ink/55' : 'text-ink/25')"
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
