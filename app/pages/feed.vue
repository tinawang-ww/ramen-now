<script setup lang="ts">
import type { ReviewSummary } from '~~/shared/types'

const { t } = useLocale()

// Getters, not strings, so the tab title follows the language toggle too.
useSeoMeta({
  title: () => t('feed.seoTitle'),
  description: () => t('feed.seoDescription'),
})

const route = useRoute()
const router = useRouter()

// Seeded from the URL, so /feed?shop=麵屋 一心 is a shareable "this shop's
// write-ups" page.
const query = ref(typeof route.query.shop === 'string' ? route.query.shop : '')
const debounced = refDebounced(query, 300)

/**
 * Searching on the server, unlike index.vue's client-side filter: write-ups
 * accumulate past FEED_LIMIT, so filtering what we already hold would quietly
 * report "no write-ups" for shops that have them.
 *
 * No `deep: true` — nothing on this page mutates a row in place.
 */
const { data: reviews } = await useFetch('/api/reviews', {
  query: { shop: debounced },
  default: (): ReviewSummary[] => [],
})

// replace, not push: pushing would stack one history entry per keystroke.
watch(debounced, (value) => {
  router.replace({ query: value.trim() ? { shop: value.trim() } : {} })
})

const searching = computed(() => query.value.trim().length > 0)

const now = useNow({ interval: 30_000 })
const nowMs = computed(() => now.value.getTime())

const { loggedIn } = useUserSession()

const notice = ref('')

/** Same bottom line as the other pages: hint by default, feedback when there is any. */
const statusLine = computed(() => notice.value || t('feed.hint'))

let noticeTimer: ReturnType<typeof setTimeout> | undefined
function flash(message: string) {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 4000)
}

const writing = ref(false)
const submitting = ref(false)

async function submit(payload: {
  shopId: number
  ramen: string
  price: number
  queue: string
  body: string
}) {
  if (submitting.value)
    return

  submitting.value = true
  try {
    const review = await $fetch('/api/reviews', { method: 'POST', body: payload })
    reviews.value = [review, ...reviews.value]
    writing.value = false
    flash(t('feed.saved'))
  }
  catch (error) {
    // Read the body, not error.statusMessage: h3 strips non-ASCII from the HTTP
    // status line, so the Chinese only survives in the JSON payload. Worth
    // surfacing here — "價格請填 1–9999 元" beats a generic failure on a
    // five-field form. The form stays open with everything still in it.
    const data = (error as { data?: { statusMessage?: string, message?: string } })?.data
    flash(data?.statusMessage || data?.message || t('feed.submitFailed'))
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="mx-auto min-h-[100dvh] w-full max-w-[30rem] pb-24 pl-6 pr-8 pt-20 sm:pr-6">
    <!--
      The right edge is wider on phones, where the scroll indicator rides over it.

      This tag must stay the template's only root node — even a comment beside it
      counts as a second one, and the page transition would then have nothing to
      wrap, so the route renders empty until a reload.
    -->
    <SiteNav />

    <header class="mt-6">
      <h1 class="text-[22px] leading-7 tracking-tight text-black/90">
        {{ t('feed.title') }}
      </h1>
      <p class="mt-1.5 text-[13px] leading-5 text-black/35">
        {{ t('feed.tagline') }}
      </p>
    </header>

    <div class="mt-8 flex items-center gap-3 border-b border-black/[0.07] pb-1.5">
      <input
        v-model="query"
        type="search"
        enterkeyhint="search"
        :placeholder="t('common.searchShops')"
        :aria-label="t('common.searchShops')"
        class="min-w-0 flex-1 bg-transparent text-[15px] leading-6 text-black/90 outline-none placeholder:text-black/25 [&::-webkit-search-cancel-button]:hidden"
      >
      <button
        v-if="searching"
        type="button"
        class="shrink-0 text-[12px] leading-5 text-black/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/60"
        @click="query = ''"
      >
        {{ t('common.clear') }}
      </button>
    </div>

    <!-- Signed out you can still read everything; only writing needs an account. -->
    <div class="mt-8">
      <NuxtLink
        v-if="!loggedIn"
        to="/login"
        class="text-[13px] leading-5 text-black/40 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/80"
      >
        {{ t('feed.signInToWrite') }}
      </NuxtLink>

      <button
        v-else-if="!writing"
        type="button"
        class="text-[13px] leading-5 text-black/40 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/80"
        @click="writing = true"
      >
        {{ t('feed.write') }}
      </button>

      <ReviewForm
        v-else
        :submitting="submitting"
        @submit="submit"
        @cancel="writing = false"
      />
    </div>

    <ul v-if="reviews.length" class="mt-8 border-t border-black/[0.07]">
      <ReviewCard
        v-for="(review, index) in reviews"
        :key="review.id"
        class="stagger-in"
        :style="{ animationDelay: `${Math.min(index, 8) * 40}ms` }"
        :review="review"
        :now="nowMs"
      />
    </ul>

    <p v-else class="mt-12 text-[13px] leading-5 text-black/35">
      {{ searching ? t('feed.emptySearch', { query: query.trim() }) : t('feed.empty') }}
    </p>

    <p
      class="mt-6 text-[11px] leading-4 transition-colors duration-200"
      :class="notice ? 'text-black/55' : 'text-black/25'"
      role="status"
    >
      {{ statusLine }}
    </p>
  </main>
</template>
