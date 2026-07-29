<script setup lang="ts">
import type { ShopSummary } from '~~/shared/types'
import { MAX_BODY, MAX_QUEUE, MAX_RAMEN } from '~~/shared/review'

defineProps<{ submitting: boolean }>()

const emit = defineEmits<{
  submit: [payload: { shopId: number, ramen: string, price: number, queue: string, body: string }]
  cancel: []
}>()

const { t } = useLocale()

/** Enough to recognise the one you mean without turning into a directory. */
const SUGGESTION_LIMIT = 6

// The board's own endpoint — no new API for picking a shop.
const { data: shops } = await useFetch('/api/shops', {
  default: (): ShopSummary[] => [],
})

const shopQuery = ref('')
const shopId = ref<number | null>(null)
const ramen = ref('')
const price = ref('')
const queue = ref('')
const body = ref('')

const addingShop = ref(false)
const shopInput = useTemplateRef<HTMLInputElement>('shopInput')

onMounted(() => shopInput.value?.focus())

const chosen = computed(() => shops.value.find(shop => shop.id === shopId.value) ?? null)

const suggestions = computed(() => {
  const keyword = shopQuery.value.trim().toLowerCase()

  if (!keyword || chosen.value)
    return []

  return shops.value
    .filter(shop => shop.name.toLowerCase().includes(keyword))
    .slice(0, SUGGESTION_LIMIT)
})

/** Nothing matched, so offer to put this shop on the board rather than dead-end. */
const missing = computed(() =>
  shopQuery.value.trim().length > 0 && !chosen.value && suggestions.value.length === 0,
)

function pick(shop: ShopSummary) {
  shopId.value = shop.id
  shopQuery.value = shop.name
}

/** Typing again after picking means they changed their mind. */
watch(shopQuery, (value) => {
  if (chosen.value && value !== chosen.value.name)
    shopId.value = null
})

async function addShop() {
  const name = shopQuery.value.trim()

  if (!name || addingShop.value)
    return

  addingShop.value = true
  try {
    // Reuses the board's dedupe, so a shop typed twice stays one shop.
    const shop = await $fetch('/api/shops', { method: 'POST', body: { name } })
    shops.value = [...shops.value, {
      id: shop.id,
      name: shop.name,
      lat: null,
      lng: null,
      people: null,
      reportedAt: null,
      requestedAt: null,
    }]
    shopId.value = shop.id
    shopQuery.value = shop.name
  }
  finally {
    addingShop.value = false
  }
}

function onPrice(event: Event) {
  price.value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4)
}

const ready = computed(() =>
  shopId.value !== null
  && ramen.value.trim().length > 0
  && Number(price.value) > 0
  && queue.value.trim().length > 0
  && body.value.trim().length > 0,
)

function submit() {
  if (!ready.value || shopId.value === null)
    return

  emit('submit', {
    shopId: shopId.value,
    ramen: ramen.value.trim(),
    price: Number(price.value),
    queue: queue.value.trim(),
    body: body.value.trim(),
  })
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <div>
      <label class="block text-[11px] leading-4 text-ink/30" for="review-shop">{{ t('reviewForm.shopLabel') }}</label>
      <input
        id="review-shop"
        ref="shopInput"
        v-model="shopQuery"
        type="text"
        maxlength="40"
        autocomplete="off"
        :placeholder="t('reviewForm.shopPlaceholder')"
        class="mt-1.5 w-full border-b border-ink/15 bg-transparent pb-1.5 text-[15px] leading-6 text-ink/90 outline-none transition-colors duration-200 placeholder:text-ink/25 focus:border-ink/60"
      >

      <ul v-if="suggestions.length" class="mt-2 space-y-1">
        <li v-for="shop in suggestions" :key="shop.id">
          <button
            type="button"
            class="text-[13px] leading-5 text-ink/50 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-ink/90"
            @click="pick(shop)"
          >
            {{ shop.name }}
          </button>
        </li>
      </ul>

      <button
        v-if="missing"
        type="button"
        :disabled="addingShop"
        class="mt-2 text-[13px] leading-5 text-ink/50 transition-[color,opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-40 hover-fine:hover:text-ink/90"
        @click="addShop()"
      >
        {{ addingShop ? t('reviewForm.addingShop') : t('reviewForm.addShopNamed', { name: shopQuery.trim() }) }}
      </button>
    </div>

    <div>
      <label class="block text-[11px] leading-4 text-ink/30" for="review-ramen">{{ t('reviewForm.ramenLabel') }}</label>
      <input
        id="review-ramen"
        v-model="ramen"
        type="text"
        :maxlength="MAX_RAMEN"
        :placeholder="t('reviewForm.ramenPlaceholder')"
        class="mt-1.5 w-full border-b border-ink/15 bg-transparent pb-1.5 text-[15px] leading-6 text-ink/90 outline-none transition-colors duration-200 placeholder:text-ink/25 focus:border-ink/60"
      >
    </div>

    <div>
      <label class="block text-[11px] leading-4 text-ink/30" for="review-price">{{ t('reviewForm.priceLabel') }}</label>
      <input
        id="review-price"
        :value="price"
        type="text"
        inputmode="numeric"
        maxlength="4"
        :placeholder="t('reviewForm.pricePlaceholder')"
        class="mt-1.5 w-full border-b border-ink/15 bg-transparent pb-1.5 text-[15px] leading-6 tabular-nums text-ink/90 outline-none transition-colors duration-200 placeholder:text-ink/25 focus:border-ink/60"
        @input="onPrice"
      >
    </div>

    <div>
      <label class="block text-[11px] leading-4 text-ink/30" for="review-queue">{{ t('reviewForm.queueLabel') }}</label>
      <input
        id="review-queue"
        v-model="queue"
        type="text"
        :maxlength="MAX_QUEUE"
        :placeholder="t('reviewForm.queuePlaceholder')"
        class="mt-1.5 w-full border-b border-ink/15 bg-transparent pb-1.5 text-[15px] leading-6 text-ink/90 outline-none transition-colors duration-200 placeholder:text-ink/25 focus:border-ink/60"
      >
    </div>

    <div>
      <label class="block text-[11px] leading-4 text-ink/30" for="review-body">{{ t('reviewForm.bodyLabel') }}</label>
      <textarea
        id="review-body"
        v-model="body"
        rows="4"
        :maxlength="MAX_BODY"
        :placeholder="t('reviewForm.bodyPlaceholder')"
        class="mt-1.5 w-full resize-none border-b border-ink/15 bg-transparent pb-1.5 text-[15px] leading-6 text-ink/90 outline-none transition-colors duration-200 placeholder:text-ink/25 focus:border-ink/60"
      />
    </div>

    <div class="flex items-center gap-4">
      <button
        type="submit"
        :disabled="!ready || submitting"
        class="rounded-full bg-accent px-5 py-2.5 text-[13px] leading-4 text-white transition-[opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-25"
      >
        {{ submitting ? t('reviewForm.submitting') : t('reviewForm.submit') }}
      </button>

      <button
        type="button"
        class="text-[13px] leading-5 text-ink/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-ink/60"
        @click="emit('cancel')"
      >
        {{ t('common.cancel') }}
      </button>
    </div>
  </form>
</template>
