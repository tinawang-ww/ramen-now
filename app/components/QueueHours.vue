<script setup lang="ts">
import type { QueueHour } from '~~/shared/types'

const props = defineProps<{
  hours: QueueHour[]
  /** ms — the bar for the hour it is right now gets the accent ink. */
  now: number
  /** Board rows are tight: clamp to ramen hours (11–20) instead of stretching. */
  compact?: boolean
}>()

const { t } = useLocale()

/**
 * Ramen hours by default, stretched when the data says otherwise — a shop
 * with 22:00 reports gets its 22:00 bar, but a lunch-only shop isn't padded
 * out to midnight. In compact mode the window stays fixed instead.
 */
const range = computed(() => {
  const reported = props.hours.map(bucket => bucket.hour)
  const start = props.compact ? 11 : Math.min(11, ...reported)
  const end = props.compact ? 20 : Math.max(20, ...reported)

  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

const byHour = computed(() => new Map(props.hours.map(bucket => [bucket.hour, bucket])))
const maxAvg = computed(() => Math.max(...props.hours.map(bucket => bucket.avg), 1))

// Taipei hour, not the visitor's: the buckets are in the shop's timezone, so
// the highlight has to be too — a traveler abroad still sees the right bar lit.
const currentHour = computed(() => (new Date(props.now).getUTCHours() + 8) % 24)

function barHeight(bucket: QueueHour | undefined) {
  if (!bucket)
    return 2

  return Math.max(4, Math.round(26 * bucket.avg / maxAvg.value))
}

function barTitle(hour: number) {
  const bucket = byHour.value.get(hour)

  return bucket ? t('shopRow.hourTip', { hour, avg: bucket.avg }) : undefined
}
</script>

<template>
  <div>
    <p class="text-[11px] leading-4 text-ink/30">
      {{ t('shopRow.hoursTitle') }}
    </p>

    <div class="mt-2 flex items-end gap-[3px]" aria-hidden="true">
      <div
        v-for="hour in range"
        :key="hour"
        class="w-[14px] rounded-t-[2px] transition-[height] duration-200 ease-out-strong"
        :class="byHour.get(hour)
          ? (hour === currentHour ? 'bg-accent/80' : 'bg-mist/60')
          : 'bg-ink/[0.08]'"
        :style="{ height: `${barHeight(byHour.get(hour))}px` }"
        :title="barTitle(hour)"
      />
    </div>

    <div class="mt-1 flex gap-[3px] text-[9px] leading-3 tabular-nums text-mist">
      <span
        v-for="hour in range"
        :key="hour"
        class="w-[14px] text-center"
      >{{ hour % 3 === 0 ? hour : '' }}</span>
    </div>
  </div>
</template>
