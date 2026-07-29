<script setup lang="ts">
const props = defineProps<{
  /** Counter seats, or null when nobody has counted them. */
  counter: number | null
  /** Table seats, or null when nobody has counted them. */
  table: number | null
}>()

const { t } = useLocale()

/** Nothing counted, nothing to draw — the row shouldn't carry an empty slot. */
const known = computed(() => props.counter !== null || props.table !== null)
</script>

<template>
  <span v-if="known" class="flex items-center gap-2 w-full mt-1">
    <span class="opacity-60">{{ t('seatCounts.totalLabel') }}</span>

    <span v-if="counter !== null" class="flex items-center gap-1">
      <span class="opacity-80">{{ t('seatCounts.counterLabel') }}</span>
      <span class="tabular-nums">{{ counter }}</span>
      <span class="sr-only">{{ counter === 1 ? t('seatCounts.counterOne') : t('seatCounts.counterMany') }}</span>
    </span>

    <span v-if="table !== null" class="flex items-center gap-1">
      <span class="opacity-80">{{ t('seatCounts.tableLabel') }}</span>
      <span class="tabular-nums">{{ table }}</span>
      <span class="sr-only">{{ table === 1 ? t('seatCounts.tableOne') : t('seatCounts.tableMany') }}</span>
    </span>
  </span>
</template>
