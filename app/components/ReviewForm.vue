<script setup lang="ts">
import type { ShopSummary } from '~~/shared/types'
import { MAX_BODY, MAX_PRICE, MAX_QUEUE, MAX_RAMEN } from '~~/shared/review'

defineProps<{ submitting: boolean }>()

const emit = defineEmits<{
  submit: [payload: { shopId: number, ramen: string, price: number, queue: string, body: string }]
  cancel: []
}>()

const { t } = useLocale()

// The board's own endpoint — no new API for picking a shop.
const { data: shops } = await useFetch('/api/shops', {
  default: (): ShopSummary[] => [],
})

const shop = ref<ShopSummary | undefined>()
const ramen = ref('')
const price = ref<number | undefined>()
const queue = ref('')
const body = ref('')

const addingShop = ref(false)

/**
 * Nothing matched what they typed, so put the shop on the board rather than
 * dead-end. Reuses the board's dedupe, so a shop typed twice stays one shop —
 * which is why the reply is looked up in the list before being appended.
 */
async function addShop(name: string) {
  const tidy = name.trim()

  if (!tidy || addingShop.value)
    return

  addingShop.value = true
  try {
    const created = await $fetch('/api/shops', { method: 'POST', body: { name: tidy } })
    const known = shops.value.find(candidate => candidate.id === created.id)

    if (known) {
      shop.value = known
      return
    }

    const added: ShopSummary = {
      id: created.id,
      name: created.name,
      lat: null,
      lng: null,
      counterSeats: null,
      tableSeats: null,
      people: null,
      reportedAt: null,
      requestedAt: null,
    }
    shops.value = [...shops.value, added]
    shop.value = added
  }
  finally {
    addingShop.value = false
  }
}

const ready = computed(() =>
  shop.value !== undefined
  && ramen.value.trim().length > 0
  && price.value !== undefined && price.value > 0
  && queue.value.trim().length > 0
  && body.value.trim().length > 0,
)

function submit() {
  if (!ready.value || shop.value === undefined || price.value === undefined)
    return

  emit('submit', {
    shopId: shop.value.id,
    ramen: ramen.value.trim(),
    price: price.value,
    queue: queue.value.trim(),
    body: body.value.trim(),
  })
}

/**
 * The suggestion popover, pared back to a hairline card on top of the same rule
 * as the other fields. The chevron and the selected-item check are hidden rather
 * than restyled: both default to `i-lucide-*`, and nuxt.config only bundles the
 * two seat icons, so drawing either would put an api.iconify.design round-trip
 * in front of this form.
 */
const MENU = {
  ...LINE_FIELD,
  trailing: () => 'hidden',
  content: () => 'max-h-[min(15rem,var(--reka-combobox-content-available-height,15rem))] w-(--reka-combobox-trigger-width) origin-(--reka-combobox-content-transform-origin) pointer-events-auto flex flex-col overflow-hidden rounded-lg bg-white ring-1 ring-black/[0.07] data-[state=open]:animate-[scale-in_100ms_var(--ease-out-strong)] data-[state=closed]:animate-[scale-out_100ms_var(--ease-out-strong)]',
  viewport: () => 'relative flex-1 scroll-py-1 overflow-y-auto',
  group: () => 'p-1',
  item: () => 'relative flex w-full cursor-default select-none items-center rounded-md px-2 py-1.5 text-[13px] leading-5 text-black/50 outline-none transition-colors data-highlighted:bg-black/[0.03] data-highlighted:text-black/90',
  itemTrailing: () => 'hidden',
  empty: () => 'px-3 py-2 text-[13px] leading-5 text-black/30',
}

/** The one field holding a number, so the one field with tabular figures. */
const PRICE_FIELD = {
  ...LINE_FIELD,
  base: () => `${LINE_FIELD.base()} tabular-nums`,
}

/** A textarea grows downwards, so its rule can't be centred on a line. */
const BODY_FIELD = {
  root: () => 'relative flex w-full',
  base: () => `${LINE_FIELD.base()} resize-none`,
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <UFormField :label="t('reviewForm.shopLabel')" :ui="FIELD_LABEL">
      <!--
        UInputMenu is the whole shop picker: filtering, keyboard navigation and
        the aria-activedescendant wiring the old inline list never had.
        `create-item` covers what used to need its own button — when nothing
        matches, the last row offers to add what they typed, and choosing it
        fires @create.
      -->
      <UInputMenu
        v-model="shop"
        autofocus
        create-item
        :items="shops"
        label-key="name"
        :filter-fields="['name']"
        maxlength="40"
        autocomplete="off"
        :placeholder="t('reviewForm.shopPlaceholder')"
        :ui="MENU"
        @create="addShop"
      >
        <template #create-item-label="{ item }">
          {{ addingShop ? t('reviewForm.addingShop') : t('reviewForm.addShopNamed', { name: item }) }}
        </template>
      </UInputMenu>
    </UFormField>

    <UFormField :label="t('reviewForm.ramenLabel')" :ui="FIELD_LABEL">
      <UInput
        v-model="ramen"
        :maxlength="MAX_RAMEN"
        :placeholder="t('reviewForm.ramenPlaceholder')"
        :ui="LINE_FIELD"
      />
    </UFormField>

    <UFormField :label="t('reviewForm.priceLabel')" :ui="FIELD_LABEL">
      <!--
        UInputNumber rather than a text field scrubbed of non-digits: it holds a
        number, so the payload needs no parsing, and it enforces the same 1–9999
        the server does. Steppers off — nobody nudges a price by one.
      -->
      <UInputNumber
        v-model="price"
        :min="1"
        :max="MAX_PRICE"
        :increment="false"
        :decrement="false"
        :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
        :placeholder="t('reviewForm.pricePlaceholder')"
        :ui="PRICE_FIELD"
      />
    </UFormField>

    <UFormField :label="t('reviewForm.queueLabel')" :ui="FIELD_LABEL">
      <UInput
        v-model="queue"
        :maxlength="MAX_QUEUE"
        :placeholder="t('reviewForm.queuePlaceholder')"
        :ui="LINE_FIELD"
      />
    </UFormField>

    <UFormField :label="t('reviewForm.bodyLabel')" :ui="FIELD_LABEL">
      <UTextarea
        v-model="body"
        :rows="4"
        :maxlength="MAX_BODY"
        :placeholder="t('reviewForm.bodyPlaceholder')"
        :ui="BODY_FIELD"
      />
    </UFormField>

    <div class="flex items-center gap-4">
      <button
        type="submit"
        :disabled="!ready || submitting"
        class="rounded-full bg-black px-5 py-2.5 text-[13px] leading-4 text-white transition-[opacity,transform] duration-150 ease-out-strong active:scale-[0.97] disabled:opacity-25"
      >
        {{ submitting ? t('reviewForm.submitting') : t('reviewForm.submit') }}
      </button>

      <button
        type="button"
        class="text-[13px] leading-5 text-black/30 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/60"
        @click="emit('cancel')"
      >
        {{ t('common.cancel') }}
      </button>
    </div>
  </form>
</template>
