<script setup lang="ts">
import type { ReviewSummary } from '~~/shared/types'

useSeoMeta({
  title: '食記 · 拉麵Now',
  description: '大家吃過的拉麵：點了什麼、多少錢、當時排隊排多久。',
})

// No `deep: true` here, unlike index.vue: nothing on this page mutates a row
// in place, so the shallow default is enough.
const { data: reviews } = await useFetch('/api/reviews', {
  default: (): ReviewSummary[] => [],
})

const now = useNow({ interval: 30_000 })
const nowMs = computed(() => now.value.getTime())

const { loggedIn } = useUserSession()

const notice = ref('')

/** Same bottom line as the other pages: hint by default, feedback when there is any. */
const statusLine = computed(() => notice.value || '看板說現在排幾人，食記說值不值得去排。')

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
    flash('已記下這一碗')
  }
  catch (error) {
    // Read the body, not error.statusMessage: h3 strips non-ASCII from the HTTP
    // status line, so the Chinese only survives in the JSON payload. Worth
    // surfacing here — "價格請填 1–9999 元" beats a generic failure on a
    // five-field form. The form stays open with everything still in it.
    const data = (error as { data?: { statusMessage?: string, message?: string } })?.data
    flash(data?.statusMessage || data?.message || '送出失敗，請再試一次')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <!-- The right edge is wider on phones, where the scroll indicator rides over it. -->
  <main class="mx-auto min-h-[100dvh] w-full max-w-[30rem] pb-24 pl-6 pr-8 pt-20 sm:pr-6">
    <SiteNav />

    <header class="mt-6">
      <h1 class="text-[22px] leading-7 tracking-tight text-black/90">
        食記
      </h1>
      <p class="mt-1.5 text-[13px] leading-5 text-black/35">
        吃過的人寫下來，下次挑店有東西可以看。
      </p>
    </header>

    <!-- Signed out you can still read everything; only writing needs an account. -->
    <div class="mt-8">
      <NuxtLink
        v-if="!loggedIn"
        to="/login"
        class="text-[13px] leading-5 text-black/40 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/80"
      >
        登入後可以寫食記
      </NuxtLink>

      <button
        v-else-if="!writing"
        type="button"
        class="text-[13px] leading-5 text-black/40 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/80"
        @click="writing = true"
      >
        ＋ 寫食記
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
      還沒有人寫食記，吃完的時候寫一下。
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
