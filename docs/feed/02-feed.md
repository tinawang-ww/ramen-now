# 階段 2：讀得到食記

> 先讀 [`00-context.md`](00-context.md)。

## 目標

`/feed` 由新到舊列出所有食記。**唯讀**——這個階段沒有表單、沒有搜尋、也還沒有任何連結到得了這一頁（用手打網址驗證）。

## 前置

階段 1 完成，而且 `pnpm db:seed` 跑過（沒有假資料的話只會看到空狀態）。

## 改動

### `shared/review.ts`

新增，比照 [`shared/queue.ts`](../../shared/queue.ts)：常數 + 純函式，兩端共用。

```ts
export const MAX_RAMEN = 40
export const MAX_QUEUE = 60
export const MAX_BODY = 500
export const MAX_PRICE = 9999
export const FEED_LIMIT = 50
```

- `tidyLine(value: unknown): string` — 非字串回空字串，否則 `trim()` + 把連續空白收合成一個。跟 [`shops.post.ts`](../../server/api/shops.post.ts) 對店名做的正規化一致。給店名、拉麵名、排隊情形用。
- `isValidPrice(value: unknown): value is number` — 比照 `isValidPeople`：整數、`> 0`、`<= MAX_PRICE`。**`0` 不合法**：免費的拉麵不存在，`0` 幾乎一定是沒填。
- 心得**不要**用 `tidyLine`，只 `trim()`。換行是內容。

這一階段只有 `FEED_LIMIT` 會被用到，其餘是給階段 5 的——一起放進來，避免那個階段還要回頭改這個檔案。

### `shared/types.ts`

加 `ReviewSummary`（命名跟現有的 `ShopSummary` 一致，這是 API 與 client 之間的契約）：`id`、`shopId`、`shopName`、`ramen`、`price`、`queue`、`body`、`photoUrl: string | null`、`author: string`、`createdAt: number`。

`createdAt` 是 **ms**，照專案「D1 存秒、API 回 ms」的慣例，註解寫一句。

### `server/api/reviews.get.ts`

新增。用 drizzle query builder 就好——不需要 [`shops.get.ts`](../../server/api/shops.get.ts) 那種 raw SQL，那裡是因為要 window function 取「每家最新一筆」，這裡只是兩個 join。

- `innerJoin` `shops` 取店名、`innerJoin` `users` 取作者 label。**inner 而不是 left**：兩個 FK 都是 `notNull`，孤兒列不存在。
- `orderBy(desc(reviews.createdAt), desc(reviews.id))`。**`id` 這個 tie-break 不能省**：假資料有同一秒的列，只用 `createdAt` 排序時順序不穩定。跟 `shops.get.ts` 的 `created_at desc, id desc` 一致。
- `limit(FEED_LIMIT)`。
- timestamp mode 查出來是 `Date`，用 `.getTime()` 轉 ms。

回傳型別標 `Promise<ReviewSummary[]>`，比照 `shops.get.ts`。

### `app/components/ReviewCard.vue`

新增。`defineProps<{ review: ReviewSummary, now: number }>()`，根元素是 `<li>` + `border-b border-black/[0.07]`。

資訊層次（跟 [`ShopRow.vue`](../../app/components/ShopRow.vue) 同一套字級與濃淡）：

- 店名 `text-[17px] leading-6 tracking-tight text-black/90`
- `拉麵名 · $價格` — `text-[13px]`，價格 `tabular-nums`
- 心得 `text-[14px] leading-6 text-black/70` + **`whitespace-pre-line`**（假資料裡有含換行的那筆就是在驗這個）
- 排隊情形與 `作者 · 幾小時前` — `text-[12px] leading-4 text-black/35`

相對時間用已存在的 `formatAgo`（[`app/utils/time.ts`](../../app/utils/time.ts)，auto-import），不要自己再寫一個。

`photoUrl` **不要**在這個階段渲染。

### `app/pages/feed.vue`

新增。頁面外殼與現有三頁**逐字相同**：

```vue
<main class="mx-auto min-h-[100dvh] w-full max-w-[30rem] px-6 pb-24 pt-20">
```

- `useSeoMeta({ title: '食記 · 拉麵Now', description: ... })`
- `h1` 用 `text-[22px] leading-7 tracking-tight text-black/90`，副標 `text-[13px] leading-5 text-black/35`
- `useFetch('/api/reviews', { default: (): ReviewSummary[] => [] })`。**不需要 `deep: true`**——這一頁沒有就地改某一列的操作（那是 index.vue 為了樂觀更新才要的）。
- `useNow({ interval: 30_000 })` + `nowMs` computed，同 index.vue
- 清單套 `.stagger-in` 與 `:style="{ animationDelay: ... }"`，同 index.vue 的作法
- 底部一行 `role="status"` 的小字，沿用 `notice` + `statusLine` computed 的模式（`flash()` 到階段 5 有東西可回饋時再加）
- 空狀態：`還沒有人寫食記，吃完的時候寫一下。`

## 驗證

1. `pnpm dev` → 手打 `/feed`，假食記由新到舊列出來。
2. **含換行的那筆心得真的斷行**（不是被壓成一行）。
3. 時間戳是 ms 不是秒：
   ```sh
   curl -s localhost:3000/api/reviews | head -c 400
   ```
   `createdAt` 應該是 13 位數。若是 10 位，前端的相對時間會顯示成 1970 年附近。
4. 相對時間文字正確（`剛剛` / `N 小時前` / `N 天前`），跟資料庫裡的時間差對得上。
5. 手機寬度（375px）不橫向溢出，長店名與長心得都不撐破版面。
6. `/`、`/login`、`/me` 完全沒變。
7. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: show what people ate, newest first
```
