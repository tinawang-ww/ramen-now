<script setup lang="ts">
import type { ReviewSummary } from '~~/shared/types'

const props = defineProps<{
  review: ReviewSummary
  now: number
}>()

const { locale, t } = useLocale()

const meta = computed(() => `${props.review.author} · ${formatAgo(props.review.createdAt, props.now, locale.value)}`)
</script>

<template>
  <li class="border-b border-black/[0.07] py-5">
    <p class="text-[17px] leading-6 tracking-tight text-black/90">
      {{ review.shopName }}
    </p>

    <p class="mt-1 text-[13px] leading-5 text-black/40">
      {{ review.ramen }}
      <span class="mx-1 text-black/20">·</span>
      <span class="tabular-nums">${{ review.price }}</span>
    </p>

    <!-- Newlines are content in a write-up, so they survive to the page. -->
    <p class="mt-3 whitespace-pre-line text-[14px] leading-6 text-black/70">
      {{ review.body }}
    </p>

    <p class="mt-3 text-[12px] leading-4 text-black/35">
      {{ t('reviewCard.queue', { queue: review.queue }) }}
    </p>

    <p class="mt-1 text-[12px] leading-4 tabular-nums text-black/35">
      {{ meta }}
    </p>
  </li>
</template>
