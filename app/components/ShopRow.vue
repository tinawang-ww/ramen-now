<script setup lang="ts">
// 引入共用的型別定義，這裡引入拉麵店的摘要資料型別
import type { ShopSummary } from '~~/shared/types'
// 引入計算距離格式化的共用函式
import { formatDistance } from '~~/shared/geo'
// 引入與排隊狀態相關的常數與判斷函式
// FRESH_WINDOW_MS: 判斷回報是否為「最新」的時間區間
// isRequestPending: 判斷是否有人發出請求且還沒有人回報
// MAX_PEOPLE: 排隊人數的最大值限制
import { FRESH_WINDOW_MS, isRequestPending, MAX_PEOPLE } from '~~/shared/queue'

// 定義元件接收的 props (外部傳入的屬性)
const props = defineProps<{
  // 店家摘要資訊
  shop: ShopSummary
  // 用來控制回報人數的 Modal (彈出視窗) 是否開啟
  open: boolean
  // 當前的時間戳記，用來計算時間差（例如多久前回報、回報是否新鮮）
  now: number
  /** 與使用者的距離 (公里)，如果無法取得雙方位置則為 null */
  distance?: number | null
}>()

// 定義元件可發出的事件 (emits)
const emit = defineEmits<{
  // 切換 Modal 開關的事件
  toggle: []
  // 送出排隊人數回報的事件，會傳遞當前設定的人數 (people)
  report: [people: number]
  // 發出請求更新排隊人數的事件
  request: []
}>()

// 取得多國語系 (i18n) 的設定與翻譯函式 `t`
const { locale, t } = useLocale()

/**
 * 判斷當前的排隊回報資料是否夠「新鮮」
 * 如果回報時間存在，且 (現在時間 - 回報時間) 小於定義的新鮮時間區間 (FRESH_WINDOW_MS)，就判定為新鮮
 * 三小時前的回報無法代表現在的排隊狀況
 */
const fresh = computed(() =>
  props.shop.reportedAt !== null && props.now - props.shop.reportedAt < FRESH_WINDOW_MS,
)

// 計算顯示在店家名稱下方的中介資訊字串 (如距離、多久前回報)
const meta = computed(() => {
  // 存放要顯示的各個資訊片段
  const parts = []

  // 如果有提供距離資料，就將其格式化後加入 parts 陣列中
  if (props.distance !== null && props.distance !== undefined)
    parts.push(formatDistance(props.distance, locale.value))

  // 判斷是否曾有回報紀錄
  // 如果 reportedAt 是 null，表示從未有回報，加入對應的提示文字
  // 如果有紀錄，則計算並格式化「多久前回報 (例如 5 分鐘前)」加入陣列中
  parts.push(props.shop.reportedAt === null
    ? t('shopRow.noReport')
    : formatAgo(props.shop.reportedAt, props.now, locale.value))

  // 將各個資訊片段用 ' · ' 串接起來並回傳 (例如: "1.2 km · 5 分鐘前")
  return parts.join(' · ')
})

// 判斷是否知道店內的座位數量 (有提供吧台或桌位的資料)
const seatsKnown = computed(() =>
  props.shop.counterSeats !== null || props.shop.tableSeats !== null,
)

/**
 * 判斷是否處於「已被請求回報，但尚未有人回報」的狀態
 * 這個狀態會用來決定是否要將發送請求的按鈕反白/禁用
 */
const requested = computed(() =>
  isRequestPending(props.shop.requestedAt, props.shop.reportedAt, props.now),
)

// 綁定在 Modal 中用來選擇排隊人數的變數 (預設為 0)
const draft = ref<number | undefined>(0)

/** The best news on the board — worth its own chip, not a number you must parse. */
const noLine = computed(() => fresh.value && props.shop.people === 0)

// 監聽 Modal 的開關狀態
// 當 Modal 被打開時，決定人數選擇器的初始值：
// 如果當前的回報資料還是「新鮮」的，就帶入資料庫目前的人數，否則歸零重新計算。
watch(() => props.open, (open) => {
  if (open)
    draft.value = fresh.value ? (props.shop.people ?? 0) : 0
})

/**
 * 安全地讀取使用者選擇的排隊人數
 * 因為 UInputNumber 若被清空，其 model 值會變成 undefined，而非 0
 * 若傳遞 undefined 給伺服器會被拒絕，因此在這裡統一將 undefined 視為 0 (代表沒人排隊)
 */
const count = computed(() => draft.value ?? 0)

// 決定在列表中要顯示的排隊人數：
// 如果 Modal 開著，為了讓使用者即時看到自己正在選擇的人數，就顯示 draft 變數的值
// 如果 Modal 關著，就顯示 props 傳進來的實際人數
const shownPeople = computed(() => props.open ? count.value : props.shop.people)

// 決定在列表中排隊人數的顯示外觀是否要套用「新鮮」狀態的樣式：
// 如果 Modal 開著 (使用者準備回報新資料)，或者資料本身是新鮮的，就顯示為新鮮狀態
const shownFresh = computed(() => props.open || fresh.value)

/** 定義 Modal 中增減排隊人數按鈕的共用 CSS 樣式字串 */
const STEP_BUTTON = 'size-9 rounded-full border border-ink/[0.09] text-[15px] leading-none text-ink/70 transition-[transform,border-color,opacity] duration-150 ease-out-strong active:scale-[0.94] disabled:opacity-25 hover-fine:hover:border-ink/25'
</script>

<template>
  <!-- 每間店的列容器，底部加上邊界分隔線 -->
  <li class="border-b border-ink/[0.07]">
    <!-- 一般檢視區塊 (這部分總是會顯示在畫面上) -->
    <div class="flex w-full items-center gap-4 py-5">
      <!-- 請求回報按鈕 -->
      <!-- 如果已經發出請求 (requested 為 true)，則停用此按鈕 (:disabled) 並套用不同樣式 -->
      <!-- 點擊時使用 .stop 修飾符阻止事件冒泡，並觸發 'request' 事件發送請求 -->
      <button
        type="button"
        :disabled="requested"
        class="shrink-0 flex size-10 items-center justify-center rounded-full transition-[color,transform,background-color] duration-150 ease-out-strong active:scale-[0.97] focus:outline-none"
        :class="requested ? 'bg-ink/10 text-ink/90' : 'bg-ink/5 text-ink/40 hover-fine:hover:bg-ink/10 hover-fine:hover:text-ink/70'"
        @click.stop="emit('request')"
        :aria-label="requested ? t('shopRow.alreadyRequested') : t('shopRow.requestReport')"
      >
        <!-- 依據是否已被請求來顯示不同的鈴鐺圖示 (實心或空心) -->
        <UIcon :name="requested ? 'material-symbols:notifications-active' : 'material-symbols:notifications-outline'" class="size-5" />
      </button>

      <!-- 店家資訊與排隊人數顯示區塊 (點擊此區塊會觸發 'toggle' 事件打開回報 Modal) -->
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center justify-between gap-4 text-left transition-transform duration-150 ease-out-strong active:scale-[0.99]"
        @click="emit('toggle')"
      >
        <!-- 左半邊：包含店名、距離與回報時間等資訊 -->
        <span class="min-w-0">
          <span class="flex min-w-0 items-start gap-2 text-[17px] leading-6 tracking-tight text-ink/90">
            <!-- 顯示店家名稱，長度過長時會自動換行 break-words -->
            <span class="break-words">{{ shop.name }}</span>
          </span>
          <span class="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 tabular-nums text-[12px] leading-4 text-ink/35">
            <span v-if="noLine" class="rounded-full bg-matcha/35 px-2 text-[10px] leading-4 text-ink/70">{{ t('shopRow.noLine') }}</span>
            <!-- 顯示 computed 計算出來的 meta 字串 -->
            <span>{{ meta }}</span>

            <!-- 如果知道座位數，就顯示 SeatCounts 元件 -->
            <SeatCounts
              v-if="seatsKnown"
              :counter="shop.counterSeats"
              :table="shop.tableSeats"
            />
          </span>
        </span>

        <!-- 右半邊：顯示排隊人數與狀態指示的元件 -->
        <!-- 動態傳入要顯示的人數 (shownPeople) 以及是否為新鮮狀態 (shownFresh) -->
        <QueueFigures class="shrink-0" :people="shownPeople" :fresh="shownFresh" />
      </button>
    </div>

    <!-- 排隊人數回報 Modal (彈出視窗) -->
    <!-- 綁定 open 屬性來控制開關，並監聽更新事件觸發 emit('toggle') 來關閉 Modal -->
    <UModal :open="open" @update:open="emit('toggle')">
      <template #content>
        <!-- Modal 的主要內容區塊設計，白色背景、圓角、陰影 -->
        <div class="bg-white p-6 rounded-[20px] shadow-sm">
          <!-- Modal 頂部：顯示店名與關閉按鈕 -->
          <div class="flex items-start justify-between mb-8 gap-4">
            <h3 class="text-[17px] leading-6 font-medium text-ink/90 break-words">{{ shop.name }}</h3>
            <!-- 點擊叉叉按鈕觸發 'toggle' 關閉 Modal -->
            <button type="button" class="mt-0.5 shrink-0 text-ink/40 transition-colors hover:text-ink/70" @click="emit('toggle')">
              <UIcon name="material-symbols:close" class="size-6" />
            </button>
          </div>

          <!-- 內容區塊：包含人數選擇器與送出按鈕 -->
          <div class="flex flex-col gap-8">
            <!-- 增減人數控制項區塊 -->
            <div class="flex items-center justify-center gap-4">
              <!-- UInputNumber: 提供數值增減功能的輸入元件 -->
              <!-- 雙向綁定 draft 變數，設定最小值 0，最大值 MAX_PEOPLE -->
              <UInputNumber
                v-model="draft"
                :min="0"
                :max="MAX_PEOPLE"
                :aria-label="t('shopRow.countAria')"
                :ui="{
                  root: () => 'flex items-center gap-1.5',
                  base: () => 'order-2 w-11 rounded-lg border border-transparent py-1 text-center text-[17px] leading-6 tabular-nums text-ink/90 outline-none transition-colors duration-200 focus:border-ink/15',
                  decrement: () => 'order-1 flex items-center',
                  increment: () => 'order-3 flex items-center',
                }"
              >
                <!-- 減少按鈕的客製化樣式 (-) -->
                <template #decrement>
                  <button type="button" :class="STEP_BUTTON" :aria-label="t('shopRow.minusAria')">
                    −
                  </button>
                </template>
                <!-- 增加按鈕的客製化樣式 (+) -->
                <template #increment>
                  <button type="button" :class="STEP_BUTTON" :aria-label="t('shopRow.plusAria')">
                    ＋
                  </button>
                </template>
              </UInputNumber>
              
              <!-- 顯示 "人排隊中" 之類的提示文字 -->
              <span class="text-[14px] text-ink/50">{{ t('shopRow.inLine') }}</span>
            </div>

            <!-- 送出回報按鈕 -->
            <!-- 點擊時觸發 'report' 事件，並帶上當前選定的人數 (count) -->
            <button
              type="button"
              class="w-full rounded-full bg-accent py-3.5 text-[15px] font-medium leading-5 text-white transition-transform duration-150 ease-out-strong active:scale-[0.98]"
              @click="emit('report', count)"
            >
              <!-- 顯示 "回報" 或類似的按鈕文字 -->
              {{ t('shopRow.report') }}
            </button>
          </div>

          <div class="flex flex-wrap items-baseline justify-center gap-x-4 mt-6">
            <!-- The board answers "how long now"; the write-ups answer "is it worth it". -->
            <NuxtLink
              :to="{ path: '/feed', query: { shop: shop.name } }"
              class="text-[12px] leading-4 text-ink/40 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-accent"
            >
              {{ t('shopRow.readReviews') }}
            </NuxtLink>

            <!-- Every share is a personal invite — this is how the board grows. -->
            <button
              type="button"
              class="text-[12px] leading-4 text-ink/40 transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-accent"
              @click="emit('share')"
            >
              {{ t('shopRow.share') }}
            </button>
          </div>
        </div>
      </template>
    </UModal>
  </li>
</template>
