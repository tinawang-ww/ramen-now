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

const notice = ref('')

/** Same bottom line as the other pages: hint by default, feedback when there is any. */
const statusLine = computed(() => notice.value || '看板說現在排幾人，食記說值不值得去排。')
</script>

<template>
  <main class="mx-auto min-h-[100dvh] w-full max-w-[30rem] px-6 pb-24 pt-20">
    <header>
      <h1 class="text-[22px] leading-7 tracking-tight text-black/90">
        食記
      </h1>
      <p class="mt-1.5 text-[13px] leading-5 text-black/35">
        吃過的人寫下來，下次挑店有東西可以看。
      </p>
    </header>

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
