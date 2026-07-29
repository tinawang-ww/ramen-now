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
  <li class="border-b border-ink/[0.07] py-5">
    <!-- The shop name filters the feed to this shop — one tap to compare bowls. -->
    <NuxtLink
      :to="{ path: '/feed', query: { shop: review.shopName } }"
      class="block text-[17px] leading-6 tracking-tight text-ink/90 transition-colors duration-150 hover-fine:hover:text-accent"
    >
      {{ review.shopName }}
    </NuxtLink>

    <p class="mt-1 text-[13px] leading-5 text-ink/40">
      {{ review.ramen }}
      <span class="mx-1 text-ink/20">·</span>
      <span class="tabular-nums">${{ review.price }}</span>
    </p>

    <!-- Newlines are content in a write-up, so they survive to the page. -->
    <p class="mt-3 whitespace-pre-line text-[14px] leading-6 text-ink/70">
      {{ review.body }}
    </p>

    <p class="mt-3 text-[12px] leading-4 text-ink/35">
      {{ t('reviewCard.queuePrefix') + review.queue }}
    </p>

    <p class="mt-1 text-[12px] leading-4 tabular-nums text-mist">
      {{ meta }}
    </p>
  </li>
</template>
