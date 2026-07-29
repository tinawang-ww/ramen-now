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
  <span v-if="known" class="flex items-center gap-2">
    <span v-if="counter !== null" class="flex items-center gap-1">
      <UIcon name="material-symbols:table-bar" class="size-[14px] shrink-0 opacity-60" />
      <span class="tabular-nums">{{ counter }}</span>
      <span class="sr-only">{{ counter === 1 ? t('seatCounts.counterOne') : t('seatCounts.counterMany') }}</span>
    </span>

    <span v-if="table !== null" class="flex items-center gap-1">
      <UIcon name="material-symbols:table-restaurant" class="size-[14px] shrink-0 opacity-60" />
      <span class="tabular-nums">{{ table }}</span>
      <span class="sr-only">{{ table === 1 ? t('seatCounts.tableOne') : t('seatCounts.tableMany') }}</span>
    </span>
  </span>
</template>
