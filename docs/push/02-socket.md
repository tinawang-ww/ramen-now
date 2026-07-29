# 階段 2：把連線握起來

> 先讀 [`00-context.md`](00-context.md)。

## 目標

開一個 `/_ws` 端點，讓首頁連上去並訂閱一個 topic。**這個階段還是不改畫面** —— 連線建立了、訂閱了，但沒有任何東西會被推送過來（廣播是階段 3）。

分成獨立階段的理由：WebSocket 升級失敗的原因（preset 沒生效、路由沒被認出、`experimental.websocket` 沒開）跟廣播邏輯錯的原因完全不同，而前者在瀏覽器 Network 面板上一眼就能看出來。先把握手確定下來。

## 前置

階段 1 完成且驗證通過。

## 改動

### 伺服器端：`server/routes/_ws.ts`

新檔案。注意是 `server/routes/`，**不是** `server/api/` —— WebSocket 端點不是 JSON API，放 `routes` 才會被掛在 `/_ws` 而不是 `/api/_ws`。

```ts
export default defineWebSocketHandler({
  open(peer) {
    peer.subscribe('shops')
  },
})
```

**單一 topic 就夠了。** 首頁本來就是「整份清單」，沒有 per-shop 訂閱的需求；每家店一個 topic 只會換來一堆訂閱管理程式碼，而廣播量並不會變少（每個人都訂閱全部）。

`defineWebSocketHandler` 是 Nitro 的 auto-import，不用自己 import。這個階段先只寫 `open`；`message` / `close` 都不需要 —— 客戶端不會往伺服器送東西（回報照舊走既有的 POST），而 crossws 會自己清掉斷線的 peer。

### 客戶端：`app/composables/useShopStream.ts`

新檔案。這個階段只負責連上，收到訊息先 `console.log`：

```ts
export function useShopStream() {
  const url = computed(() =>
    `${location.origin.replace(/^http/, 'ws')}/_ws`,
  )

  return useWebSocket(url, {
    immediate: false,
    onMessage(_ws, event) {
      console.log('[stream]', event.data)
    },
  })
}
```

`useWebSocket` 來自已裝好的 `@vueuse/nuxt`，是 auto-import。

> ⚠️ **陷阱**：`location` 在 SSR 期間不存在。首頁是 SSR 的（[`index.vue:12`](../../app/pages/index.vue#L12) 用 `await useFetch`），所以連線**必須**只在客戶端啟動 —— 這就是 `immediate: false` 的用途，配合 `onMounted` 裡呼叫 `open()`。

### 接上首頁

在 [`app/pages/index.vue`](../../app/pages/index.vue) 的 `<script setup>` 裡：

```ts
const { status, open } = useShopStream()
onMounted(open)
```

**先不要**把 `status` 顯示在畫面上。[`index.vue:67-76`](../../app/pages/index.vue#L67-L76) 的 `statusLine` 已經是三用（提示、操作回饋、定位問題），塞進第四種用途要先想清楚優先順序 —— 那是階段 4 的事，如果到時候還覺得需要的話。

## 驗證

**必須用 `pnpm preview`。** `pnpm dev` 下 Nitro 用的是另一套 ws adapter，握手可能會成功但走的不是 DO，驗不到真正要驗的東西。

1. **握手成功**：`pnpm preview`，開首頁，DevTools → Network → 篩 `WS`。
   - 要有一筆 `_ws`，狀態 **101 Switching Protocols**
   - 點進去 Messages 分頁：現在應該是空的（還沒有人廣播）

   常見失敗與對應原因：
   | 症狀 | 原因 |
   | --- | --- |
   | 404 | 檔案放到 `server/api/` 了，或檔名不是 `_ws.ts` |
   | 426 / 升級被拒 | `experimental.websocket` 沒開，ws 分支被 tree-shake 掉了 |
   | 500 | binding 名稱不是 `$DurableObject`（回去看階段 1） |
   | 連線立刻關閉 | `open()` 在 SSR 期間被呼叫，`location` 是 undefined |

2. **確認走的是 DO**：`wrangler dev` 的終端輸出裡應該看得到 DO 被實例化的痕跡。更直接的做法 —— 在 `open(peer)` 裡加一行 `console.log('open')`，那行**必須**出現在 `wrangler dev` 的 log 裡（驗完拿掉）。

3. **行為還是沒變**：首頁、回報、排序、重新整理都跟階段 1 一樣。

4. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: hold a websocket open for the board
```
