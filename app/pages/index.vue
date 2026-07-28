<script setup lang="ts">
import type { ShopSummary } from '~~/shared/types'

useSeoMeta({
  title: '拉麵Now · 拉麵排隊回報',
  description: '大家一起回報拉麵店現在的排隊狀況，出門前先看一眼。',
})

const { data: shops, refresh } = await useFetch('/api/shops', {
  default: (): ShopSummary[] => [],
})

const now = useNow({ interval: 30_000 })
const nowMs = computed(() => now.value.getTime())

const openId = ref<number | null>(null)
const notice = ref('')

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
  shop.reportCount += 1
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
  <main class="mx-auto min-h-[100dvh] w-full max-w-[30rem] px-6 pb-24 pt-20">
    <header>
      <h1 class="text-[22px] leading-7 tracking-tight text-black/90">
        現在排幾人
      </h1>
      <p class="mt-1.5 text-[13px] leading-5 text-black/35">
        路過的人回報，出門前先看一眼。
      </p>
    </header>

    <ul v-if="shops.length" class="mt-12 border-t border-black/[0.07]">
      <ShopRow
        v-for="(shop, index) in shops"
        :key="shop.id"
        class="stagger-in"
        :style="{ animationDelay: `${Math.min(index, 8) * 40}ms` }"
        :shop="shop"
        :now="nowMs"
        :open="openId === shop.id"
        @toggle="openId = openId === shop.id ? null : shop.id"
        @report="report(shop, $event)"
      />
    </ul>

    <p v-if="!shops.length" class="mt-12 text-[13px] leading-5 text-black/35">
      還沒有店家，先加第一家。
    </p>

    <div class="mt-8">
      <button
        v-if="!adding"
        type="button"
        class="text-[13px] leading-5 text-black/40 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/80"
        @click="adding = true"
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
      :class="notice ? 'text-black/55' : 'text-black/25'"
      role="status"
    >
      {{ notice || '超過 90 分鐘的回報會變淡，代表不能當「現在」看。' }}
    </p>
  </main>
</template>
