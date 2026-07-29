<script setup lang="ts">
import type { ShopSummary } from '~~/shared/types'
import { distanceKm } from '~~/shared/geo'

useSeoMeta({
  title: '拉麵Now · 拉麵排隊回報',
  description: '大家一起回報拉麵店現在的排隊狀況，出門前先看一眼。',
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

/** The bottom line does triple duty: hint, action feedback, location trouble. */
const statusLine = computed(() => {
  if (notice.value)
    return notice.value
  if (locationNudging.value)
    return '還在等你允許使用位置…'
  if (locationMessage.value)
    return locationMessage.value

  return '超過 90 分鐘的回報會變淡，代表不能當「現在」看。'
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
  }
  catch {
    Object.assign(shop, previous)
    flash('回報失敗，請再試一次')
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
    flash('已標記這家需要回報')
  }
  catch {
    shop.requestedAt = previous
    flash('要求失敗，請再試一次')
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
      flash('這家已經在清單上了')
  }
  catch {
    flash('新增失敗，請再試一次')
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
      <h1 class="text-[22px] leading-7 tracking-tight text-black/90">
        現在排幾人
      </h1>
      <p class="mt-1.5 text-[13px] leading-5 text-black/35">
        路過的人回報，出門前先看一眼。
      </p>
    </header>

    <div class="mt-8 flex items-center gap-3 border-b border-black/[0.07] pb-1.5">
      <input
        v-model="query"
        type="search"
        enterkeyhint="search"
        placeholder="搜尋店名"
        aria-label="搜尋店名"
        class="min-w-0 flex-1 bg-transparent text-[15px] leading-6 text-black/90 outline-none placeholder:text-black/25 [&::-webkit-search-cancel-button]:hidden"
      >
      <button
        v-if="searching"
        type="button"
        class="shrink-0 text-[12px] leading-5 text-black/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/60"
        @click="query = ''"
      >
        清除
      </button>
    </div>

    <!-- Location is asked for here, on a tap — never on load. -->
    <div v-if="locationSupported" class="mt-5 text-[13px] leading-5">
      <button
        v-if="!sortedByDistance"
        type="button"
        :disabled="locationStatus === 'locating' || locationDenied"
        class="text-black/40 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-black/80"
        @click="locate()"
      >
        {{ locationStatus === 'locating' ? '定位中…' : '⌖ 找我附近的' }}
      </button>

      <span v-else class="text-black/40">由近到遠排序</span>
    </div>

    <ul v-if="rows.length" class="mt-8 border-t border-black/[0.07]">
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

    <p v-if="!rows.length" class="mt-12 text-[13px] leading-5 text-black/35">
      {{ searching ? `找不到「${query.trim()}」，換個關鍵字或新增這家。` : '還沒有店家，先加第一家。' }}
    </p>

    <div class="mt-8">
      <button
        v-if="!adding"
        type="button"
        class="text-[13px] leading-5 text-black/40 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/80"
        @click="startAdd()"
      >
        ＋ 新增店家
      </button>

      <form v-else class="flex items-center gap-3" @submit.prevent="addShop">
        <input
          ref="nameInput"
          v-model="draftName"
          type="text"
          maxlength="40"
          placeholder="店名"
          class="min-w-0 flex-1 border-b border-black/15 pb-1.5 text-[15px] leading-6 text-black/90 outline-none transition-colors duration-200 placeholder:text-black/25 focus:border-black/60"
          @keydown.esc="cancelAdd"
        >
        <button
          type="submit"
          :disabled="!draftName.trim() || submitting"
          class="shrink-0 text-[13px] leading-5 text-black/80 transition-[opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-25"
        >
          加入
        </button>
        <button
          type="button"
          class="shrink-0 text-[13px] leading-5 text-black/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/60"
          @click="cancelAdd"
        >
          取消
        </button>
      </form>
    </div>

    <p
      class="mt-6 text-[11px] leading-4 transition-colors duration-200"
      :class="notice || locationMessage || locationNudging ? 'text-black/55' : 'text-black/25'"
      role="status"
    >
      {{ statusLine }}
    </p>
  </main>
</template>
