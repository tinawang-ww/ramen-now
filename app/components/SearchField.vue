<script setup lang="ts">
defineProps<{
  placeholder: string
  clearLabel: string
}>()

const model = defineModel<string>({ required: true })

const cleared = computed(() => model.value.trim().length > 0)
</script>

<template>
  <div class="flex items-center gap-2.5 rounded-full bg-ink/[0.04] px-4 py-2 transition-shadow duration-200 focus-within:ring-1 focus-within:ring-accent/40">
    <svg viewBox="0 0 16 16" class="size-3.5 shrink-0 text-ink/30" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>

    <input
      v-model="model"
      type="search"
      enterkeyhint="search"
      :placeholder="placeholder"
      :aria-label="placeholder"
      class="min-w-0 flex-1 bg-transparent text-[15px] leading-6 text-ink/90 outline-none placeholder:text-ink/25 [&::-webkit-search-cancel-button]:hidden"
    >

    <button
      v-if="cleared"
      type="button"
      class="shrink-0 text-[12px] leading-5 text-ink/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-ink/60"
      @click="model = ''"
    >
      {{ clearLabel }}
    </button>
  </div>
</template>
