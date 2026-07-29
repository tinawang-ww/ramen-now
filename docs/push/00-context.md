# 即時推送：共用背景

每個階段檔案（`01`–`04`）都可以在**獨立的 session** 裡執行。開工前先讀這一份，再讀那一階段自己的檔案。

## 這個功能要做什麼

讓別人的回報**不必等下一輪輪詢**就出現在你的畫面上。走 WebSocket，靠 Cloudflare Durable Object 握住連線並廣播。

現在首頁的「即時感」是三層疊出來的，其中只有一層跟別人的回報有關：

| 層 | 位置 | 負責什麼 |
| --- | --- | --- |
| 樂觀更新 | [`index.vue:93-129`](../../app/pages/index.vue#L93-L129) | **自己**的操作，點下去就變 |
| 60 秒輪詢 | [`index.vue:87-91`](../../app/pages/index.vue#L87-L91) | **別人**的回報，最多慢 60 秒 |
| `useNow` tick | [`index.vue:17`](../../app/pages/index.vue#L17) | 「3 分鐘前 → 4 分鐘前」自己跳 |

這個功能只換掉中間那層。上下兩層原樣保留。

## 四個關鍵設計決策

這四點是整個實作的骨幹，不要在個別階段裡把它們改掉。

### 1. 不自己寫 Durable Object class

nitropack 2.13.4 內建 `cloudflare-durable` preset，`$DurableObject` 這個 class 連 hibernation、WebSocket 生命週期、pub/sub 都寫好了（`nitropack/dist/presets/cloudflare/runtime/cloudflare-durable.mjs`）。它 `extends: "cloudflare-module"`，也就是現在用的那個 preset —— 靜態資產、D1 binding、`nodeCompat` 全部照舊，只是換了 entry。

**要寫的只有訂閱邏輯與廣播呼叫。** 如果實作中出現 `class XxxDurableObject extends DurableObject`，那就是走錯路了。

### 2. 廣播必須繞一趟 `durableFetch`

這是最容易卡住的地方。API route 跑在**主 Worker** 的 isolate，socket 握在 **DO** 的 isolate，兩邊不共享記憶體，主 Worker 裡沒有任何東西可以直接 `.publish()`。

Nitro 在 `event.context.cloudflare` 上留了兩個不同的鉤子，各自只在一邊存在：

- 主 Worker：`durableFetch(request)` —— 把一個 Request 送進 DO
- DO 內部：`durable` —— `$DurableObject` 實例本身，有 `.publish(topic, data)`

所以廣播是「API route → `durableFetch` → 一支跑在 DO 裡的內部 route → `.publish()`」。階段 3 會把這條路做出來。

> ⚠️ **陷阱**：binding 名稱與 instance 名稱都是 preset **寫死**的 —— `DURABLE_BINDING = "$DurableObject"`、`DURABLE_INSTANCE = "server"`（走 `idFromName`）。wrangler.jsonc 裡的 binding 名字打錯一個字，`getDurableStub()` 就直接丟 `Durable Object binding "$DurableObject" not available.`。

`DURABLE_INSTANCE` 寫死成單一實例，代表**所有連線集中在同一顆 DO、同一個 region**。台灣使用者之間差異不大，但這就是天花板；要分區得自己接 crossws adapter，不能用 preset。

### 3. 送 delta，不送整包

廣播 payload 只帶變動的那筆，欄位名對齊 [`ShopSummary`](../../shared/types.ts)：

```ts
{ id: 12, people: 8, reportedAt: 1753000000000 }
```

客戶端直接 patch `shops.value` 裡對應那一筆。這件事之所以成立，是因為 [`index.vue:12`](../../app/pages/index.vue#L12) 的 `useFetch` 已經帶了 `deep: true` —— 就地改欄位本來就會重繪。**不要**因為推送而改成整包替換：那會讓每次別人回報都重建整個列表、`stagger-in` 動畫全部重播。

### 4. 輪詢是保底，不是被取代

WebSocket 會斷，`waitUntil` 送出的廣播也可能失敗，而 DO **沒有 replay buffer** —— 斷線那幾秒的事件是永久遺失的。所以：

- 60 秒輪詢**留著**，只是拉長成保底（階段 4）。
- 重新連上時要補一次 `refresh()`，否則斷線期間的空洞永遠補不回來。

「有時候就是不更新」這種 bug 幾乎都出在這裡，而且在單一瀏覽器上測不出來。

## 為什麼不只是把輪詢調快

先承認：把 [`index.vue:88-91`](../../app/pages/index.vue#L88-L91) 的 `60_000` 改成 `15_000`、再加一個回前景就 `refresh()`，大概能拿到八成的體感，成本三行程式，而且不必開 Workers Paid。

**做推送的理由不是資料新鮮度**，是「有人回報時全場同時亮一下」的臨場感 —— 拉麵店排隊這種資料本身幾分鐘才變一次，15 秒和即時對「出門前看一眼」沒有差別。如果實作到一半覺得複雜度不值得，退回輪詢調參是**完全合理**的收尾，不是失敗。

## 已驗證的事實

寫的時候不要憑印象，這些是讀 `node_modules` 原始碼確認過的：

| 事實 | 內容 |
| --- | --- |
| 版本 | `nitropack@2.13.4` |
| preset 名稱 | `cloudflare-durable`（別名 `cloudflareDurable` / `cloudflare_durable`），`extends: "cloudflare-module"` |
| 開關 | `nitro.experimental.websocket: true` → 編譯期的 `import.meta._websocket`（`dist/rollup/index.mjs:1883`） |
| binding 名稱 | `$DurableObject`，**寫死**，class name 同名 |
| instance 名稱 | `server`，**寫死**，`binding.idFromName("server")` |
| 廣播 API | `$DurableObject.publish(topic, data, opts)`，內部轉給 crossws 的 `ws.publish` |
| 主 Worker 鉤子 | `event.context.cloudflare.durableFetch` |
| DO 內部鉤子 | `event.context.cloudflare.durable` |
| `waitUntil` | Nitro 在 `fetchHandler` 裡設了 `context.waitUntil`，所以 `event.waitUntil()` 可用 |
| 生命週期 handler | preset 實作了 `webSocketMessage` / `webSocketClose`，**沒有** `webSocketError` |
| 額外 hooks | `cloudflare:durable:init`、`cloudflare:durable:alarm`（這個功能都不需要） |
| 客戶端 | `useWebSocket` 來自已安裝的 `@vueuse/nuxt`，**不必加新依賴** |

對行為有疑慮時，直接讀 `node_modules/.pnpm/nitropack@2.13.4_*/node_modules/nitropack/dist/presets/cloudflare/runtime/cloudflare-durable.mjs`，那是唯一權威。

## 環境前提

- **Durable Object 需要 Workers Paid**，不在免費方案內。
- **`pnpm dev` 走不到 DO。** `durableFetch` 只在 `cloudflare-durable` 這個 entry 裡才會被掛上，Nitro 開發伺服器用的是另一套 ws adapter。每個階段的驗證都必須跑 `pnpm preview`（`wrangler dev`）。
- 因此 `broadcast()` 在拿不到 `durableFetch` 時要**靜靜跳過**，不能丟錯 —— 否則 `pnpm dev` 下每次回報都會 500。

## 專案慣例（照著寫，不要另創風格）

- **API 錯誤**：`createError({ statusCode, statusMessage: '中文訊息' })`，比照 [`shops.post.ts`](../../server/api/shops.post.ts)。
- **樣式**：整個專案除了 `UApp` 之外沒有用任何 `@nuxt/ui` 元件，全是手寫 Tailwind。照 [`app/pages/index.vue`](../../app/pages/index.vue) 的語彙：`text-[13px] text-black/40`、`transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97]`、`hover-fine:hover:` 前綴、`role="status"` 的一行小字當訊息區。文案中文、句子式、不用驚嘆號。
- **註解**：只寫「為什麼」，不寫「做什麼」。看現有檔案的密度 —— 很少，但每一條都在解釋一個非顯而易見的決定。
- **commit**：小寫 conventional commits、**不加 scope 括號**、訊息描述成果而不是實作。對照現有紀錄：`feat: let people ask for a report they can't file themselves`、`build: point the D1 binding at the real database`。

## 階段總覽

每個階段結束都是**一個 commit**，而且都停下來讓人驗證。

| # | 檔案 | 成果 | commit |
| --- | --- | --- | --- |
| 1 | [`01-preset.md`](01-preset.md) | preset 換成 `cloudflare-durable`，DO 起得來，app 行為照舊 | `build: switch to the durable object worker preset` |
| 2 | [`02-socket.md`](02-socket.md) | `/_ws` 握手成功，客戶端連上但還不改畫面 | `feat: hold a websocket open for the board` |
| 3 | [`03-broadcast.md`](03-broadcast.md) | 兩個瀏覽器互看得到對方的回報 | `feat: push new reports to everyone watching` |
| 4 | [`04-resilience.md`](04-resilience.md) | 斷線、重連、手指下不重排都不出錯 | `feat: survive a dropped connection without going stale` |

順序是嚴格的：每一階段都依賴前一階段可驗證的成果。階段 1 和 2 都刻意不改任何使用者看得到的行為 —— 那是為了讓「DO 跑不起來」和「推送邏輯錯」這兩類問題在不同階段被抓到。
