<script setup lang="ts">
import { PEOPLE_ICON_CAP } from '~~/shared/queue'

const props = defineProps<{
  people: number | null
  fresh: boolean
}>()

const figures = computed(() => Math.min(props.people ?? 0, PEOPLE_ICON_CAP))

/** An empty queue still keeps one ghost figure, so the row keeps its shape. */
const drawn = computed(() => Math.max(figures.value, 1))

const tone = computed(() => {
  if (figures.value === 0)
    return props.people === null ? 'text-ink/[0.06]' : 'text-ink/[0.12]'

  return props.fresh ? 'text-ink/75' : 'text-ink/20'
})
</script>

<template>
  <span class="flex items-center gap-2">
    <!-- Figures grow from the ground up as the count climbs, like joining a line. -->
    <TransitionGroup
      tag="span"
      class="flex items-end gap-[4px]"
      aria-hidden="true"
      enter-active-class="transition-[opacity,transform] duration-150 ease-out-strong"
      leave-active-class="transition-[opacity,transform] duration-150 ease-out-strong"
      enter-from-class="scale-y-0 opacity-0"
      leave-to-class="scale-y-0 opacity-0"
    >
      <PersonFigure
        v-for="index in drawn"
        :key="index"
        class="h-[12px] origin-bottom transition-colors duration-200"
        :class="tone"
      />
    </TransitionGroup>

    <span
      class="min-w-[1.75ch] text-right text-[15px] leading-5 tabular-nums transition-colors duration-200"
      :class="people === null ? 'text-ink/25' : (fresh ? 'text-ink/90' : 'text-ink/30')"
    >
      {{ people === null ? '—' : people }}
    </span>
  </span>
</template>
