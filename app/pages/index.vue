<script setup lang="ts">
// The board: one row per ramen shop, newest queue report first, nearest first
// once the user hands over their location. Everything on this page is a tap
// away from writing — reporting a head count, asking for one, adding a shop.
import type { ShopSummary } from '~~/shared/types'
// Great-circle distance in km. Row rendering formats it; this page only sorts on it.
import { distanceKm } from '~~/shared/geo'
import { FRESH_WINDOW_MS, isRequestPending } from '~~/shared/queue'

// `t` looks a message key up in the active locale. The locale itself lives in a
// composable shared with SiteNav's language toggle, so it can change mid-session.
const { t } = useLocale()

// Page <title> and meta description.
// Getters, not strings, so the tab title follows the language toggle too:
// useSeoMeta re-evaluates a function on every reactive change, but would freeze
// a plain string at whatever the locale happened to be during setup.
useSeoMeta({
  title: () => t('board.seoTitle'),
  description: () => t('board.seoDescription'),
})

// Geolocation, all of it gated behind a user gesture — see useUserLocation.
const {
  coords: here, // the user's position, or null until they allow it
  status: locationStatus, // 'unsupported' | 'idle' | 'locating' | 'ready' | 'error'
  message: locationMessage, // already-translated failure text, '' when fine
  nudging: locationNudging, // true when the permission prompt has sat unanswered
  denied: locationDenied, // true once the user (or the browser) has said no
  supported: locationSupported, // false during SSR and where geolocation can't run
  locate, // asks the browser for a fix; call from a click only
} = useUserLocation()

// The shop list, fetched on the server for the first paint and re-fetched on
// the client by `refresh()` below.
// deep: true because reporting and requesting patch a row in place; Nuxt 4's
// shallow default would keep the list rendering the pre-tap values.
// default: [] so `shops.value` is an array even before the request resolves —
// every reader below can skip a null check.
const { data: shops } = await useFetch('/api/shops', {
  deep: true,
  default: (): ShopSummary[] => [],
  query: computed(() => (here.value ? { lat: here.value.lat, lng: here.value.lng } : {})),
})

// A clock that ticks every 30s. Rows render "5 min ago" and decide whether a
// report is still fresh, so they need the current time to be reactive — without
// this, a page left open would keep claiming a report is one minute old.
const now = useNow({ interval: 30_000 })
// Passed to rows as a plain number: cheaper to compare than a Date instance.
const nowMs = computed(() => now.value.getTime())

// Which row has its report panel expanded. Only one at a time, so this is the
// open row's shop id rather than a flag per row. null means all collapsed.
const openId = ref<number | null>(null)
// Transient message shown on the bottom status line, set by `flash()`.
const notice = ref('')

// Seeded from the URL like the feed, so a shared /?shop=麵屋 一心 link opens
// the board already filtered to that shop.
const route = useRoute()
const query = ref(typeof route.query.shop === 'string' ? route.query.shop : '')

/**
 * The rendered rows: the shop list filtered by the search box, each paired with
 * its distance from the user, sorted nearest first.
 *
 * Nearest first once we know where the user is. Shops nobody has pinned keep
 * their newest-report order at the bottom — an unknown distance isn't a far one.
 */
const rows = computed(() => {
  const from = here.value
  // Lower-cased once, outside the filter, so the comparison below is per-shop
  // work only. Trimmed because a trailing space while typing shouldn't blank
  // the list.
  const keyword = query.value.trim().toLowerCase()

  const list = shops.value
    .filter(shop => !keyword || shop.name.toLowerCase().includes(keyword))
    .map(shop => ({
      shop,
      // Needs both ends: the user's position and a shop that has been pinned.
      // Any missing piece means null, which rows render as "no distance" rather
      // than as zero.
      distance: from !== null && shop.lat !== null && shop.lng !== null
        ? distanceKm(from, { lat: shop.lat, lng: shop.lng })
        : null,
    }))

  let filteredList = list
  if (!keyword) {
    // 搜尋欄為空時：如果有位置，只顯示 500m 內的；如果沒有位置，就不顯示
    if (from === null) {
      filteredList = []
    }
    else {
      filteredList = list.filter(row => row.distance !== null && row.distance <= 0.5)
    }
  }

  // 排序：如果有提供位置，依照距離近到遠排序
  if (from === null) {
    return filteredList
  }

  return filteredList.sort((a, b) => {
    // Both known: plain ascending kilometres.
    if (a.distance === null || b.distance === null)
      return Number(a.distance === null) - Number(b.distance === null)
    return a.distance - b.distance
  })
})

// Having coordinates is the same thing as the list being distance-sorted, so
// the template reads this instead of re-checking `here`.
const sortedByDistance = computed(() => here.value !== null)
// Whether the search box has anything in it — drives the clear button and picks
// which empty-state sentence to show.
const searching = computed(() => query.value.trim().length > 0)

/** Shops someone flagged and nobody has answered yet — the board's open asks. */
const pendingCount = computed(() =>
  shops.value.filter(shop => isRequestPending(shop.requestedAt, shop.reportedAt, nowMs.value)).length)

/** The bottom line does quadruple duty: feedback, location trouble, open asks, hint. */
const statusLine = computed(() => {
  // Most specific first: a message about what the user just did outranks
  // everything, since they are looking at the line because they acted.
  if (notice.value)
    return notice.value
  // Then the "still waiting on the permission prompt" nudge, which is only true
  // while a decision is genuinely pending.
  if (locationNudging.value)
    return t('board.locationNudge')
  // Then any standing location failure — denied, timed out, insecure origin.
  if (locationMessage.value)
    return locationMessage.value
  // Surfacing the asks turns "someone requested somewhere" into a visible todo,
  // which is the nudge this board runs on.
  if (pendingCount.value > 0)
    return t('board.pendingRequests', { count: pendingCount.value })

  // Nothing to report: the resting hint explaining what the board is for.
  return t('board.hint')
})

// Module-scoped rather than inside flash(), so a second flash can cancel the
// first one's timer instead of the two racing to blank the line.
let noticeTimer: ReturnType<typeof setTimeout> | undefined
/** Show `message` on the status line and clear it again after four seconds. */
function flash(message: string) {
  notice.value = message
  // Restart the countdown, so a new message always gets its full four seconds.
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 4000)
}

// We now track which shops are visible on screen to poll only those.
const visibleShopIds = new Set<number>()

// Refresh quietly in the background — but never while a row is open, so the
// list can't reorder under someone's thumb mid-tap.
// Background tabs are skipped too: nobody is reading them, and the poll would
// keep the tab awake for nothing.
const visibility = useDocumentVisibility()
useIntervalFn(async () => {
  if (visibility.value === 'visible' && openId.value === null && visibleShopIds.size > 0) {
    try {
      const ids = Array.from(visibleShopIds).join(',')
      const reports = await $fetch<any[]>(`/api/shops/reports?ids=${ids}`)

      for (const report of reports) {
        const shop = shops.value.find(s => s.id === report.id)
        if (shop) {
          shop.people = report.people
          shop.reportedAt = report.reportedAt
          shop.requestedAt = report.requestedAt
        }
      }
    }
    catch {
      // Polling failure is silent. It'll try again in a minute.
    }
  }
}, 60_000)

/**
 * Post a head count for `shop`, optimistically.
 *
 * The row shows the new number immediately and the panel closes, so the tap
 * feels finished before the request is; a failure puts the old values back.
 */
// The row you just reported glows marigold for a beat — confirmation where
// your eyes already are, not only in the status line below the fold.
const glowId = ref<number | null>(null)
let glowTimer: ReturnType<typeof setTimeout> | undefined

async function report(shop: ShopSummary, people: number) {
  // A shallow copy is enough to undo with — every field we touch is a primitive.
  const previous = { ...shop }

  // Patch the object in the list, which is what makes deep: true necessary above.
  shop.people = people
  // A local guess at the timestamp, so the row reads "just now" without waiting.
  shop.reportedAt = Date.now()
  openId.value = null

  try {
    const result = await $fetch(`/api/shops/${shop.id}/reports`, {
      method: 'POST',
      body: { people },
    })
    // Adopt the server's timestamp, so "x minutes ago" is measured from when the
    // report actually landed rather than from this device's possibly-skewed clock.
    shop.reportedAt = result.reportedAt
    // Closing the loop out loud: a thank-you costs nothing and reporting again
    // tomorrow is the whole game.
    flash(t('board.reported'))
    glowId.value = shop.id
    clearTimeout(glowTimer)
    glowTimer = setTimeout(() => (glowId.value = null), 1000)
  }
  catch {
    // Assign back onto the same object rather than replacing it in the array —
    // the row is bound to this instance.
    Object.assign(shop, previous)
    flash(t('board.reportFailed'))
  }
}

/**
 * Native share sheet where there is one, clipboard everywhere else. The text
 * carries the live count, so the message is useful even before the tap.
 */
async function share(shop: ShopSummary) {
  const freshCount = shop.people !== null
    && shop.reportedAt !== null
    && nowMs.value - shop.reportedAt < FRESH_WINDOW_MS
    ? shop.people
    : null

  const text = freshCount !== null
    ? t('board.shareFresh', { name: shop.name, count: freshCount })
    : t('board.shareStale', { name: shop.name })
  const url = `${location.origin}/?shop=${encodeURIComponent(shop.name)}`

  try {
    if (navigator.share) {
      await navigator.share({ text, url })
    }
    else {
      await navigator.clipboard.writeText(`${text} ${url}`)
      flash(t('board.shareCopied'))
    }
  }
  catch (error) {
    // Closing the share sheet isn't a failure, so it doesn't read as one.
    if ((error as Error)?.name !== 'AbortError')
      flash(t('board.shareFailed'))
  }
}

/**
 * Ask whoever walks past next to fill this shop in.
 *
 * Same optimistic shape as report(): mark it requested now, keep the old value
 * around, restore it if the post fails.
 */
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

    <!-- Title and one-line description of what the board is. -->
    <header class="mt-6 flex flex-col items-center text-center">
      <img src="/stamps/default.png" alt="Queue icon" class="mb-3 size-12">
      <h1 class="text-[22px] leading-7 tracking-tight text-ink/90">
        {{ t('board.title') }}
      </h1>
      <p class="mt-1.5 text-[13px] leading-5 text-ink/35">
        {{ t('board.tagline') }}
      </p>
    </header>

    <!--
      Search box: filters the list by name as you type, no submit.

      One UInput carries the whole control — the hairline rule is its root and
      the clear button its trailing slot, so there is no wrapper div holding the
      two together any more.
    -->
    <UInput
      v-model="query"
      type="search"
      enterkeyhint="search"
      :placeholder="t('common.searchShops')"
      :aria-label="t('common.searchShops')"
      :ui="SEARCH_FIELD"
    >
      <!--
        Our own clear button, only once there is something to clear. WebKit's
        built-in one is hidden by SEARCH_FIELD — see app/utils/fields.ts.
      -->
      <template #trailing>
        <button
          v-if="searching"
          type="button"
          class="shrink-0 text-[12px] leading-5 text-ink/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-ink/60"
          @click="query = ''"
        >
          {{ t('common.clear') }}
        </button>
      </template>
    </UInput>

    <!--
      Location is asked for here, on a tap — never on load.

      The whole block is absent where geolocation can't run, including during
      SSR, so nothing offers a fix the browser would refuse.
    -->
    <!-- "How to help" / "Find nearby" -->
    <!-- This replaces the plus button. The primary call to action is now locating oneself. -->
    <div class="mt-5 flex items-baseline justify-between text-[13px] leading-5">
      <!-- Left side: Hint for reporting -->
      <span class="text-ink/40">{{ t('board.clickEmptyBowl') }}</span>

      <!-- Right side: Location sorting -->
      <div v-if="locationSupported" class="text-right">
        <!--
          Before we have a position: the button that triggers the prompt. Disabled
          while a fix is in flight, and permanently once the user has said no —
          a second tap wouldn't re-prompt, it would silently fail. The status line
          at the foot of the page is what explains the disabled state.
        -->
        <button
          v-if="!sortedByDistance"
          type="button"
          :disabled="locationStatus === 'locating' || locationDenied"
          class="text-ink/40 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-ink/80"
          @click="locate()"
        >
          {{ locationStatus === 'locating' ? t('board.locating') : t('board.findNearby') }}
        </button>

        <!-- Once located there is nothing left to ask for, so the button becomes a label. -->
        <span v-else class="text-ink/40">{{ t('board.sortedByDistance') }}</span>
      </div>
    </div>

    <!-- The board itself. -->
    <ul v-if="rows.length" class="mt-8 border-t border-ink/[0.07]">
      <ShopRow
        v-for="(row, index) in rows"
        :key="row.shop.id"
        class="stagger-in transition-colors duration-700"
        :class="glowId === row.shop.id ? 'bg-marigold/25' : ''"
        :style="{ animationDelay: `${Math.min(index, 8) * 40}ms` }"
        :shop="row.shop"
        :distance="row.distance"
        :now="nowMs"
        :open="openId === row.shop.id"
        @toggle="openId = openId === row.shop.id ? null : row.shop.id"
        @report="report(row.shop, $event)"
        @request="request(row.shop)"
        @share="share(row.shop)"
        @visible="(shopId, isVisible) => isVisible ? visibleShopIds.add(shopId) : visibleShopIds.delete(shopId)"
      />
      <!--
        Keyed by shop id, not by index, so a re-sort moves rows instead of
        rewriting their contents underneath an open panel.

        Rows fade in one after another, 40ms apart, capped at the eighth: past
        that the wait is longer than the effect is worth, and everything below
        the fold would arrive late for nobody's benefit.

        Only the open row's id is passed down, so opening one closes the rest for
        free. @toggle flips it, and tapping the open row clears it back to null.
      -->
    </ul>

    <!--
      Nothing to show. Two different situations, and the difference matters: an
      empty search names what was looked for and leads into the add form below,
      while an empty board is a first-run state.
    -->
    <p v-if="!rows.length" class="mt-12 text-[13px] leading-5 text-ink/35">
      {{ searching ? t('board.emptySearch', { query: query.trim() }) : t('board.empty') }}
    </p>

    <!--
      The status line. role="status" makes screen readers announce changes here
      without moving focus, which is how a failed report gets reported at all.
      It darkens when it has something to say and fades back for the resting hint.
    -->

    <p
      class="mt-6 text-[11px] leading-4 transition-colors duration-200"
      :class="notice ? 'text-accent/90' : (locationMessage || locationNudging ? 'text-ink/55' : 'text-ink/25')"
      role="status"
    >
      {{ statusLine }}
    </p>
  </main>
</template>
