<script setup lang="ts">
import type { ShopSummary } from '~~/shared/types'
import { distanceKm } from '~~/shared/geo'
import { isRequestPending } from '~~/shared/queue'

const { t } = useLocale()

// Getters, not strings, so the tab title follows the language toggle too.
useSeoMeta({
  title: () => t('board.seoTitle'),
  description: () => t('board.seoDescription'),
})

// deep: true because reporting and requesting patch a row in place; Nuxt 4's
// shallow default would keep the list rendering the pre-tap values.
const { data: shops, refresh } = await useFetch('/api/shops', {
  deep: true,
  default: (): ShopSummary[] => [],
})

const now = useNow({ interval: 30_000 })
const nowMs = computed(() => now.value.getTime())

const openId = ref<number | null>(null)
const notice = ref('')

const {
  coords: here,
  status: locationStatus,
  message: locationMessage,
  nudging: locationNudging,
  denied: locationDenied,
  supported: locationSupported,
  locate,
} = useUserLocation()

const query = ref('')

/**
 * Nearest first once we know where the user is. Shops nobody has pinned keep
 * their newest-report order at the bottom — an unknown distance isn't a far one.
 */
const rows = computed(() => {
  const from = here.value
  const keyword = query.value.trim().toLowerCase()

  const list = shops.value
    .filter(shop => !keyword || shop.name.toLowerCase().includes(keyword))
    .map(shop => ({
      shop,
      distance: from !== null && shop.lat !== null && shop.lng !== null
        ? distanceKm(from, { lat: shop.lat, lng: shop.lng })
        : null,
    }))

  if (from === null)
    return list

  return list.sort((a, b) => {
    if (a.distance === null || b.distance === null)
      return Number(a.distance === null) - Number(b.distance === null)

    return a.distance - b.distance
  })
})

const sortedByDistance = computed(() => here.value !== null)
const searching = computed(() => query.value.trim().length > 0)

/** Shops someone flagged and nobody has answered yet — the board's open asks. */
const pendingCount = computed(() =>
  shops.value.filter(shop => isRequestPending(shop.requestedAt, shop.reportedAt, nowMs.value)).length)

/** The bottom line does quadruple duty: feedback, location trouble, open asks, hint. */
const statusLine = computed(() => {
  if (notice.value)
    return notice.value
  if (locationNudging.value)
    return t('board.locationNudge')
  if (locationMessage.value)
    return locationMessage.value
  // Surfacing the asks turns "someone requested somewhere" into a visible todo,
  // which is the nudge this board runs on.
  if (pendingCount.value > 0)
    return t('board.pendingRequests', { count: pendingCount.value })

  return t('board.hint')
})

let noticeTimer: ReturnType<typeof setTimeout> | undefined
function flash(message: string) {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 4000)
}

// Refresh quietly in the background — but never while a row is open, so the
// list can't reorder under someone's thumb mid-tap.
const visibility = useDocumentVisibility()
useIntervalFn(() => {
  if (visibility.value === 'visible' && openId.value === null)
    refresh()
}, 60_000)

async function report(shop: ShopSummary, people: number) {
  const previous = { ...shop }

  shop.people = people
  shop.reportedAt = Date.now()
  openId.value = null

  try {
    const result = await $fetch(`/api/shops/${shop.id}/reports`, {
      method: 'POST',
      body: { people },
    })
    shop.reportedAt = result.reportedAt
    // Closing the loop out loud: a thank-you costs nothing and reporting again
    // tomorrow is the whole game.
    flash(t('board.reported'))
  }
  catch {
    Object.assign(shop, previous)
    flash(t('board.reportFailed'))
  }
}

/** Ask whoever walks past next to fill this shop in. */
async function request(shop: ShopSummary) {
  const previous = shop.requestedAt

  shop.requestedAt = Date.now()
  openId.value = null

  try {
    const result = await $fetch(`/api/shops/${shop.id}/request`, { method: 'POST' })
    shop.requestedAt = result.requestedAt
    flash(t('board.requestSent'))
  }
  catch {
    shop.requestedAt = previous
    flash(t('board.requestFailed'))
  }
}

const adding = ref(false)
const draftName = ref('')
const submitting = ref(false)
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')

watch(adding, async (value) => {
  if (!value)
    return
  await nextTick()
  nameInput.value?.focus()
})

/** Searching for a shop that isn't listed is the usual way people end up here. */
function startAdd() {
  if (!draftName.value)
    draftName.value = query.value.trim()
  adding.value = true
}

function cancelAdd() {
  adding.value = false
  draftName.value = ''
}

async function addShop() {
  const name = draftName.value.trim()
  if (!name || submitting.value)
    return

  submitting.value = true
  try {
    const shop = await $fetch('/api/shops', { method: 'POST', body: { name } })
    cancelAdd()
    // Clear the filter, or the shop they just added could be hidden by it.
    query.value = ''
    await refresh()
    // Drop them straight into reporting for the shop they just added.
    openId.value = shop.id
    if (!shop.created)
      flash(t('board.alreadyListed'))
  }
  catch {
    flash(t('board.addFailed'))
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="mx-auto min-h-[100dvh] w-full max-w-[30rem] pb-24 pl-6 pr-8 pt-20 sm:pr-6">
    <!--
      The right edge is wider on phones, where the scroll indicator rides over it.

      This tag must stay the template's only root node — even a comment beside it
      counts as a second one, and the page transition would then have nothing to
      wrap, so the route renders empty until a reload.
    -->
    <SiteNav />

    <header class="mt-6">
      <h1 class="text-[22px] leading-7 tracking-tight text-ink/90">
        {{ t('board.title') }}
      </h1>
      <p class="mt-1.5 text-[13px] leading-5 text-ink/35">
        {{ t('board.tagline') }}
      </p>
    </header>

    <div class="mt-8 flex items-center gap-3 border-b border-ink/[0.07] pb-1.5">
      <input
        v-model="query"
        type="search"
        enterkeyhint="search"
        :placeholder="t('common.searchShops')"
        :aria-label="t('common.searchShops')"
        class="min-w-0 flex-1 bg-transparent text-[15px] leading-6 text-ink/90 outline-none placeholder:text-ink/25 [&::-webkit-search-cancel-button]:hidden"
      >
      <button
        v-if="searching"
        type="button"
        class="shrink-0 text-[12px] leading-5 text-ink/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-ink/60"
        @click="query = ''"
      >
        {{ t('common.clear') }}
      </button>
    </div>

    <!-- Location is asked for here, on a tap — never on load. -->
    <div v-if="locationSupported" class="mt-5 text-[13px] leading-5">
      <button
        v-if="!sortedByDistance"
        type="button"
        :disabled="locationStatus === 'locating' || locationDenied"
        class="text-ink/40 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-ink/80"
        @click="locate()"
      >
        {{ locationStatus === 'locating' ? t('board.locating') : t('board.findNearby') }}
      </button>

      <span v-else class="text-ink/40">{{ t('board.sortedByDistance') }}</span>
    </div>

    <ul v-if="rows.length" class="mt-8 border-t border-ink/[0.07]">
      <ShopRow
        v-for="(row, index) in rows"
        :key="row.shop.id"
        class="stagger-in"
        :style="{ animationDelay: `${Math.min(index, 8) * 40}ms` }"
        :shop="row.shop"
        :distance="row.distance"
        :now="nowMs"
        :open="openId === row.shop.id"
        @toggle="openId = openId === row.shop.id ? null : row.shop.id"
        @report="report(row.shop, $event)"
        @request="request(row.shop)"
      />
    </ul>

    <p v-if="!rows.length" class="mt-12 text-[13px] leading-5 text-ink/35">
      {{ searching ? t('board.emptySearch', { query: query.trim() }) : t('board.empty') }}
    </p>

    <div class="mt-8">
      <button
        v-if="!adding"
        type="button"
        class="text-[13px] leading-5 text-ink/40 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-ink/80"
        @click="startAdd()"
      >
        {{ t('board.addShop') }}
      </button>

      <form v-else class="flex items-center gap-3" @submit.prevent="addShop">
        <input
          ref="nameInput"
          v-model="draftName"
          type="text"
          maxlength="40"
          :placeholder="t('board.shopNamePlaceholder')"
          class="min-w-0 flex-1 border-b border-ink/15 pb-1.5 text-[15px] leading-6 text-ink/90 outline-none transition-colors duration-200 placeholder:text-ink/25 focus:border-ink/60"
          @keydown.esc="cancelAdd"
        >
        <button
          type="submit"
          :disabled="!draftName.trim() || submitting"
          class="shrink-0 text-[13px] leading-5 text-ink/80 transition-[opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-25"
        >
          {{ t('board.add') }}
        </button>
        <button
          type="button"
          class="shrink-0 text-[13px] leading-5 text-ink/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-ink/60"
          @click="cancelAdd"
        >
          {{ t('common.cancel') }}
        </button>
      </form>
    </div>

    <p
      class="mt-6 text-[11px] leading-4 transition-colors duration-200"
      :class="notice ? 'text-accent/90' : (locationMessage || locationNudging ? 'text-ink/55' : 'text-ink/25')"
      role="status"
    >
      {{ statusLine }}
    </p>
  </main>
</template>
