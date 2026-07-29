<script setup lang="ts">
import type { ShopSummary } from '~~/shared/types'
import { formatDistance } from '~~/shared/geo'
import { clampPeople, FRESH_WINDOW_MS, isRequestPending, MAX_PEOPLE } from '~~/shared/queue'

const props = defineProps<{
  shop: ShopSummary
  open: boolean
  now: number
  /** Km from the user, or null when we don't know where either end is. */
  distance?: number | null
}>()

const emit = defineEmits<{
  toggle: []
  report: [people: number]
  request: []
}>()

const { locale, t } = useLocale()

/** A report from three hours ago says nothing about the queue right now. */
const fresh = computed(() =>
  props.shop.reportedAt !== null && props.now - props.shop.reportedAt < FRESH_WINDOW_MS,
)

const meta = computed(() => {
  const parts = []

  if (props.distance !== null && props.distance !== undefined)
    parts.push(formatDistance(props.distance, locale.value))

  parts.push(props.shop.reportedAt === null
    ? t('shopRow.noReport')
    : formatAgo(props.shop.reportedAt, props.now, locale.value))

  return parts.join(' · ')
})

/** Somebody asked for a fresh report and nobody has answered yet. */
const requested = computed(() =>
  isRequestPending(props.shop.requestedAt, props.shop.reportedAt, props.now),
)

// The 0fr → 1fr grid trick collapses to 0px once the child clips its overflow,
// so the panel is measured on open instead.
const panel = useTemplateRef<HTMLElement>('panel')
const panelHeight = ref(0)

const draft = ref(0)

// Start from what's on the board when it's still current, otherwise from zero.
watch(() => props.open, (open) => {
  if (!open)
    return

  draft.value = fresh.value ? (props.shop.people ?? 0) : 0
  panelHeight.value = panel.value?.offsetHeight ?? 0
})

// While the panel is open the figures track the draft, so the row answers
// "how many is that?" as you tap — and reads as current, since it's about to be.
const shownPeople = computed(() => props.open ? draft.value : props.shop.people)
const shownFresh = computed(() => props.open || fresh.value)

function step(delta: number) {
  draft.value = clampPeople(draft.value + delta)
}

function onInput(event: Event) {
  const digits = (event.target as HTMLInputElement).value.replace(/\D/g, '')
  draft.value = clampPeople(Number(digits || 0))
}
</script>

<template>
  <li class="border-b border-ink/[0.07]">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-6 py-5 text-left transition-transform duration-150 ease-out-strong active:scale-[0.99]"
      :aria-expanded="open"
      @click="emit('toggle')"
    >
      <span class="min-w-0">
        <span class="flex min-w-0 items-center gap-2 text-[17px] leading-6 tracking-tight text-ink/90">
          <!-- The dot marks a shop someone is waiting on a report for. -->
          <Transition
            enter-active-class="transition-[opacity,transform] duration-200 ease-out-strong"
            leave-active-class="transition-[opacity,transform] duration-200 ease-out-strong"
            enter-from-class="scale-0 opacity-0"
            leave-to-class="scale-0 opacity-0"
          >
            <span v-if="requested" class="shrink-0">
              <span class="block size-[6px] animate-pulse-dot rounded-full bg-accent" />
              <span class="sr-only">{{ t('shopRow.requestedDot') }}</span>
            </span>
          </Transition>

          <span class="truncate">{{ shop.name }}</span>
        </span>
        <span class="mt-1 block text-[12px] leading-4 tabular-nums text-mist">
          {{ meta }}
        </span>
      </span>

      <QueueFigures class="shrink-0" :people="shownPeople" :fresh="shownFresh" />
    </button>

    <div
      class="overflow-hidden transition-[height] duration-200 ease-out-strong"
      :style="{ height: open ? `${panelHeight}px` : '0px' }"
    >
      <!-- inert keeps the collapsed controls out of the tab order. -->
      <div
        ref="panel"
        :inert="!open"
        class="pb-5 transition-opacity duration-200 ease-out-strong"
        :class="open ? 'opacity-100' : 'opacity-0'"
      >
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              :disabled="draft === 0"
              class="size-9 rounded-full border border-ink/[0.09] text-[15px] leading-none text-ink/70 transition-[transform,border-color,opacity] duration-150 ease-out-strong active:scale-[0.94] disabled:opacity-25 hover-fine:hover:border-ink/25"
              :aria-label="t('shopRow.minusAria')"
              @click="step(-1)"
            >
              −
            </button>

            <input
              :value="draft"
              type="text"
              inputmode="numeric"
              maxlength="2"
              :aria-label="t('shopRow.countAria')"
              class="w-11 rounded-lg border border-transparent py-1 text-center text-[17px] leading-6 tabular-nums text-ink/90 outline-none transition-colors duration-200 focus:border-ink/15"
              @input="onInput"
            >

            <button
              type="button"
              :disabled="draft >= MAX_PEOPLE"
              class="size-9 rounded-full border border-ink/[0.09] text-[15px] leading-none text-ink/70 transition-[transform,border-color,opacity] duration-150 ease-out-strong active:scale-[0.94] disabled:opacity-25 hover-fine:hover:border-ink/25"
              :aria-label="t('shopRow.plusAria')"
              @click="step(1)"
            >
              ＋
            </button>
          </div>

          <span class="text-[12px] leading-4 text-ink/30">{{ t('shopRow.inLine') }}</span>

          <button
            type="button"
            class="ml-auto rounded-full bg-accent px-5 py-2.5 text-[13px] leading-4 text-white transition-transform duration-150 ease-out-strong active:scale-[0.97]"
            @click="emit('report', draft)"
          >
            {{ t('shopRow.report') }}
          </button>
        </div>

        <div class="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <!-- For people who aren't there: ask someone who is. -->
          <button
            type="button"
            :disabled="requested"
            class="text-[12px] leading-4 text-ink/35 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:text-ink/25 hover-fine:hover:text-ink/70 hover-fine:disabled:hover:text-ink/25"
            @click="emit('request')"
          >
            {{ requested ? t('shopRow.alreadyRequested') : t('shopRow.requestReport') }}
          </button>

          <!-- The board answers "how long now"; the write-ups answer "is it worth it". -->
          <NuxtLink
            :to="{ path: '/feed', query: { shop: shop.name } }"
            class="text-[12px] leading-4 text-ink/35 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-accent"
          >
            {{ t('shopRow.readReviews') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </li>
</template>
