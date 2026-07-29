<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  people: number | null
  fresh: boolean
}>()

const boxStyle = computed(() => {
  if (props.people === null) return 'bg-ink/5 text-ink/25'
  if (!props.fresh) return 'bg-ink/10 text-ink/40'
  
  if (props.people <= 5) return 'bg-mist text-ink/90'
  if (props.people <= 10) return 'bg-matcha text-ink/90'
  if (props.people <= 20) return 'bg-marigold text-ink/90'
  return 'bg-accent text-white'
})
</script>

<template>
  <div 
    class="flex items-center justify-center size-16 rounded-2xl transition-colors duration-200"
    :class="boxStyle"
  >
    <div class="flex items-baseline gap-0.5">
      <span class="text-3xl font-bold tabular-nums leading-none font-title">
        {{ people === null ? '?' : people }}
      </span>
      <span class="text-[14px] font-medium font-title">人</span>
    </div>
  </div>
</template>
