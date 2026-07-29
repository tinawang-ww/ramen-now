# 階段 3：廣播

> 先讀 [`00-context.md`](00-context.md)。

## 目標

回報、要求回報、新增店家這三個寫入動作發生時，把 delta 推給所有連線中的人。這個階段結束後，**兩個瀏覽器並排就能互看到對方的操作**。

## 前置

階段 2 完成且驗證通過（`/_ws` 有 101，`open` 的 log 出現在 `wrangler dev` 裡）。

## 改動

### 事件型別：`shared/types.ts`

在 [`shared/types.ts`](../../shared/types.ts) 加一個 union，跟 `ShopSummary` 放一起。**放 `shared/` 是刻意的** —— 伺服器 publish 和客戶端 apply 必須是同一個型別，欄位名對不上時要在 `typecheck` 就爆掉，不是在瀏覽器裡。

```ts
export type ShopEvent =
  | { type: 'report', id: number, people: number, reportedAt: number }
  | { type: 'request', id: number, requestedAt: number }
  | { type: 'shop', shop: ShopSummary }
```

欄位名刻意跟 `ShopSummary` 對齊，客戶端才能直接 patch。`shop` 這一種帶整筆 —— 新增的店家在客戶端還不存在，沒有東西可以 patch。

### 廣播 helper：`server/utils/broadcast.ts`

新檔案。跑在主 Worker，只負責把事件丟進 DO：

```ts
import type { H3Event } from 'h3'
import type { ShopEvent } from '~~/shared/types'

/**
 * Sockets live in the durable object, API routes run in the main worker — the
 * two isolates share nothing, so the event has to travel by fetch.
 */
export function broadcast(event: H3Event, payload: ShopEvent) {
  const durableFetch = event.context.cloudflare?.durableFetch

  // No durable object under `nuxt dev`. Polling still covers those clients.
  if (!durableFetch)
    return

  event.waitUntil(durableFetch(new Request('http://do/_publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })))
}
```

三個決定值得記住：

- **`waitUntil` 而不是 `await`。** 回報者自己有樂觀更新（[`index.vue:93-111`](../../app/pages/index.vue#L93-L111)），廣播的往返不該加進他的 response 時間。
- **`durableFetch` 不存在就靜靜返回。** `pnpm dev` 下這個鉤子根本不會被掛上；丟錯會讓每次回報都 500。
- **`http://do/` 這個 host 是假的**，DO 的 `fetch` 只看 pathname。取一個明顯不是真網域的名字，讀的人才不會去找它。

`event.context.cloudflare` 的型別在 Nitro 裡是鬆的，比照 [`useDb`](../../server/utils/db.ts) 的做法自己標一下形狀。

### 內部 route：`server/routes/_publish.post.ts`

新檔案。**這支跑在 DO 裡面**，是唯一能碰到 `publish()` 的地方：

```ts
export default defineEventHandler(async (event) => {
  const durable = event.context.cloudflare?.durable

  // Only reachable through durableFetch — a request from outside has no stub.
  if (!durable)
    throw createError({ statusCode: 404, statusMessage: '找不到頁面' })

  durable.publish('shops', JSON.stringify(await readBody(event)))
  return null
})
```

`durable` 只在 DO 的 isolate 裡存在，所以那個 guard 同時是安全邊界：外面直接打 `/_publish` 拿不到 stub，必然是 404。**不要**額外加 secret header 或簽章 —— isolate 邊界本身就是驗證，多一層只是多一個會過期的東西。

回 404 而不是 403 也是刻意的：對外界來說這條路徑不存在，不該用狀態碼確認它存在。

### 三個寫入端點

在各自 `return` 之前加一行 `broadcast(...)`：

| 檔案 | 事件 |
| --- | --- |
| [`reports.post.ts`](../../server/api/shops/%5Bid%5D/reports.post.ts) | `{ type: 'report', id: shopId, people, reportedAt }` |
| [`request.post.ts`](../../server/api/shops/%5Bid%5D/request.post.ts) | `{ type: 'request', id: shopId, requestedAt }` |
| [`shops.post.ts`](../../server/api/shops.post.ts) | `{ type: 'shop', shop: {...} }` |

`reportedAt` / `requestedAt` 直接用各端點已經算好要回傳的那個毫秒值，**不要重算** —— 重算會讓廣播出去的時間戳跟 response 裡的差幾毫秒，客戶端就會看到自己的那筆抖一下。

[`shops.post.ts`](../../server/api/shops.post.ts) 有三條 return 路徑，**只有 `created: true` 那條要廣播**。另兩條是「這家已經在清單上了」，沒有新東西發生。

新增的店家還沒有任何回報，所以 `shop` 事件裡 `people` / `reportedAt` / `requestedAt` 都是 `null`，`lat` / `lng` 也是 —— 照 `ShopSummary` 的形狀填滿，不要省欄位。

### 客戶端套用

把階段 2 的 `console.log` 換成真的 patch。`useShopStream` 收 `shops` ref：

```ts
export function useShopStream(shops: Ref<ShopSummary[]>) {
  function apply(raw: string) {
    const event = JSON.parse(raw) as ShopEvent

    if (event.type === 'shop') {
      if (!shops.value.some(s => s.id === event.shop.id))
        shops.value.unshift(event.shop)
      return
    }

    const shop = shops.value.find(s => s.id === event.id)
    if (!shop)
      return

    Object.assign(shop, event)
  }
  // ...
}
```

三個細節：

- **`Object.assign(shop, event)` 就地改欄位**，靠 [`index.vue:12`](../../app/pages/index.vue#L12) 的 `deep: true` 重繪。`event` 裡多出來的 `type` 欄位會被一起塞進去，無害但難看 —— 解構掉它比較乾淨。
- **`shop` 事件要先查重。** 自己新增店家時，[`index.vue:155-178`](../../app/pages/index.vue#L155-L178) 的 `addShop` 已經 `await refresh()` 過了，廣播回來會撞上同一筆。
- **找不到 id 就無聲跳過。** 那表示這個客戶端的清單比事件舊（例如剛好在 `refresh()` 中間），下一次輪詢會補上。

排序留給 `rows` 那個 computed（[`index.vue:39-61`](../../app/pages/index.vue#L39-L61)）處理，不要在 `apply` 裡動 `shops.value` 的順序。

## 驗證

**必須用 `pnpm preview`**，而且**必須開兩個瀏覽器視窗**（同一個瀏覽器的兩個分頁也可以，但要都在前景）。

1. **推送真的到了**：A 視窗回報某家店 8 人 → **B 視窗那家店的數字要在一秒內變成 8**，且 B 沒有重新整理。
2. **時間戳一致**：B 那筆顯示「剛剛」。如果 B 顯示的時間跟 A 差很多，是 `reportedAt` 被重算了。
3. **要求回報**：A 點「要求回報」→ B 那家店出現待回報的樣式。
4. **新增店家**：A 新增一家 → B 的清單頂端出現那家店，而且 **A 自己沒有出現重複的兩筆**（查重生效）。
5. **自己的操作沒被廣播弄壞**：A 回報後，A 自己的那筆數字不閃、不跳、不重播 `stagger-in` 動畫。這一項在意的是「有沒有不小心改成整包替換」。
6. **`/_publish` 打不到**：
   ```sh
   curl -i -X POST http://localhost:8787/_publish -d '{}'
   ```
   要回 404。回 200 就表示 guard 沒生效，任何人都能對全站廣播假事件。
7. **`pnpm dev` 不會壞**：切回 `pnpm dev`，回報一次要成功（不推送，但**不能 500**）。這一項在驗 `broadcast()` 的 no-op 分支。
8. `pnpm typecheck` 與 `pnpm lint` 乾淨。

第 6 項是這個階段唯一的安全性驗證，不要跳過。

## Commit

```
feat: push new reports to everyone watching
```
