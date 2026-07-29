# 階段 4：斷線也不出錯

> 先讀 [`00-context.md`](00-context.md)。

## 目標

把推送從「demo 會動」變成「真的能上線」。三件事：連線會自己回來、斷線期間的空洞會被補上、別人的回報不會在使用者手指底下把清單重排。

這是整個功能裡**最容易被跳過、也最容易讓人誤以為推送壞掉**的一段。前三階段在單一乾淨環境下都會通過；這一階段處理的全部是單一瀏覽器測不出來的狀況。

## 前置

階段 3 完成且驗證通過（兩個視窗互看得到）。

## 改動

全部集中在 `app/composables/useShopStream.ts` 與 [`app/pages/index.vue`](../../app/pages/index.vue)，伺服器端不動。

### 1. 自動重連與心跳

給 `useWebSocket` 加設定：

```ts
useWebSocket(url, {
  immediate: false,
  autoReconnect: { retries: -1, delay: 2000 },
  heartbeat: { interval: 30_000, pongTimeout: 5000 },
  // ...
})
```

- **`retries: -1`（無限）**是對的。這不是一次性請求，使用者可能把分頁開在背景一整天，放棄重連等於靜默退化成只有輪詢 —— 而且沒有任何跡象。
- **心跳是必要的，不是保險。** 中間的 proxy 和手機網路會在閒置一段時間後靜靜切掉連線，而 `close` 事件不一定送得到客戶端。沒有心跳的話，socket 會停在「看起來是開的」狀態上，直到使用者做了什麼才發現。
- `heartbeat` 送的 ping 會走到伺服器的 `message` handler。crossws 預設會處理，`_ws.ts` 不必為此加東西 —— 但驗證時要確認 `wrangler dev` 的 log 沒有被 ping 洗爆。

### 2. 重連後補洞

**這是本階段最重要的一改。** DO 沒有 replay buffer，斷線那幾秒的事件是永久遺失的：

```ts
const { status, open } = useWebSocket(/* ... */)

let connected = false
watch(status, (value) => {
  // Reconnecting means events were missed while we were away — and the durable
  // object has no replay buffer, so a full refresh is the only way to catch up.
  if (value === 'OPEN' && connected)
    refresh()

  connected = value === 'OPEN'
})
```

`connected` 這個旗標是為了**跳過第一次連上**。首頁是 SSR 的，資料在握手之前就已經到了（[`index.vue:12`](../../app/pages/index.vue#L12) 的 `await useFetch`），第一次連上就 `refresh()` 是白打一趟。

`useShopStream` 因此需要收 `refresh` —— 簽名變成 `useShopStream(shops, refresh)`。

### 3. 展開時不要重排

[`index.vue:88-91`](../../app/pages/index.vue#L88-L91) 的輪詢已經有這個守門條件（`openId.value === null`），註解也寫明了理由：「never while a row is open, so the list can't reorder under someone's thumb mid-tap」。**推送更需要它** —— 輪詢最多每 60 秒踩一次，推送是別人一按就踩。

但推送不能像輪詢那樣「跳過就算了」，事件不會再來一次。要 buffer：

```ts
const pending: ShopEvent[] = []

function apply(event: ShopEvent) {
  if (openId.value !== null) {
    pending.push(event)
    return
  }
  // ...實際套用
}

// 收合時一次補完
watch(openId, (value) => {
  if (value !== null)
    return
  while (pending.length) apply(pending.shift()!)
})
```

`openId` 屬於 [`index.vue`](../../app/pages/index.vue)，所以這段的歸屬要想一下：把 `openId` 傳進 composable，或者讓 composable 吐出 `apply` 讓頁面決定何時呼叫。**後者比較好** —— buffer 的理由是 UI 互動（手指在螢幕上），那是頁面的知識，不是資料流的知識。

同一家店在 buffer 裡出現兩次時，後到的會覆蓋前一筆，這是對的：中間那個人數已經沒有意義了。

### 4. 輪詢降為保底

把 [`index.vue:88-91`](../../app/pages/index.vue#L88-L91) 的 `60_000` 拉長到 `300_000`（5 分鐘）。

**不要拿掉。** 廣播是 `waitUntil` 送的，失敗沒有人會知道；`durableFetch` 也可能在 DO 重啟的瞬間打不到。五分鐘一次的保底幾乎沒有成本，卻能讓「推送靜默失效」從「畫面永遠不動」降級成「最多慢五分鐘」。

`visibility` 那個條件留著 —— 背景分頁不該打 API。

## 驗證

**必須用 `pnpm preview`，而且要兩個視窗。** 前三項是這個階段的全部重點，都得手動製造故障。

1. **重連**：A、B 都連上 → 在 `wrangler dev` 的終端按 `Ctrl+C` 再重開 → B 的 Network 面板應該看到 `_ws` 重新握手（約兩秒後）。
2. **補洞**（最關鍵的一項）：
   - B 開著，DevTools → Network → 把節流設成 **Offline**
   - 在 A 回報某家店一個明顯的數字（例如 17 人）
   - B 恢復連線
   - **B 那家店要變成 17** —— 這是 `refresh()` 補上的，不是推送。沒變就表示 `connected` 旗標寫錯了（最常見：漏了旗標，第一次連上就 refresh 掉，重連時反而沒跑）。
3. **手指下不重排**：
   - B 展開某一列（開著不要動）
   - A 回報**另一家**店，讓排序理應改變
   - **B 的清單在展開期間完全不動**
   - B 收合 → 這時才重排、數字才更新
4. **心跳沒有洗 log**：兩個視窗掛著兩分鐘，`wrangler dev` 的終端不該被 ping 訊息淹掉。有的話把 log 關掉，不要改掉心跳。
5. **背景分頁**：把 B 切到背景五分鐘，回來時資料是新的，而且背景期間沒有輪詢請求（Network 面板可以確認）。
6. `pnpm typecheck` 與 `pnpm lint` 乾淨。

第 2 和第 3 項如果沒過，這個功能就還沒完成 —— 那兩種情況在真實使用上都很常見（走進地下室、邊看邊點），而且症狀都是「推送好像壞了」這種很難回報、很難重現的樣子。

## Commit

```
feat: survive a dropped connection without going stale
```

## 之後可以再想的事

不屬於這個功能，但做到這裡自然會浮出來：

- **連線狀態要不要給使用者看。** [`index.vue:67-76`](../../app/pages/index.vue#L67-L76) 的 `statusLine` 已經三用了，塞第四種用途要先排優先順序。個人傾向**不顯示** —— 有保底輪詢在，斷線對使用者其實沒有後果，講出來只會製造焦慮。
- **有人回報時的視覺提示。** 這其實才是做推送真正的理由（見 [`00-context.md`](00-context.md) 的「為什麼不只是把輪詢調快」）。數字換掉時加一個很輕的高亮，`ease-out-strong` 那組 transition 語彙已經在專案裡了。
- **多 region。** `DURABLE_INSTANCE` 被 preset 寫死成單一實例，所有連線集中在一顆 DO。台灣使用者不痛，真要分區得自己接 crossws adapter、放棄 preset。那是另一份文件。
