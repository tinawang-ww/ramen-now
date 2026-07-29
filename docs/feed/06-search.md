# 階段 6：搜店名

> 先讀 [`00-context.md`](00-context.md)，特別是決定 5。

## 目標

在 `/feed` 搜店名，找出那家的食記（由新到舊）。搜尋在**伺服器端**做。

## 前置

階段 2 完成。階段 5 不是必要的。

## 改動

### `server/api/reviews.get.ts`

接 `getQuery(event)` 的 `shop` 參數。有值時加 `where`：

```ts
sql`lower(${schema.shops.name}) like lower(${pattern}) escape '\\'`
```

兩件事都不能省：

- **關鍵字裡的 `\`、`%`、`_` 必須先轉義**（`\` 要先轉，否則會把後面補上的反斜線再轉一次），然後前後包 `%`。不轉的話有人打一個 `%` 就會列出全部食記——那不是搜尋，是繞過。這一點要有註解，因為它看起來只是個 escape 而不像個安全考量。
- **`escape '\'`** 子句要跟著，否則 SQLite 不知道反斜線是轉義字元，轉義等於沒做。

`lower()` 是為了英文店名——中文沒有大小寫。跟 [`shops.post.ts`](../../server/api/shops.post.ts) 的去重同一個作法。

關鍵字先 `tidyLine`，空字串當成「沒有搜尋」（不要變成 `like '%%'` 再繞一圈）。`orderBy` 與 `limit` 都照舊，`(shop_id, created_at)` 那個 index 就是給這個查詢的。

### `app/pages/feed.vue`

搜尋框與 [`index.vue`](../../app/pages/index.vue) 那組**逐字相同**：`type="search"`、`enterkeyhint="search"`、`placeholder="搜尋店名"`、`aria-label`、`[&::-webkit-search-cancel-button]:hidden`，加上有字時出現的 `清除` 按鈕。兩頁的搜尋看起來應該是同一個東西。

不同的是**這裡是伺服器端搜尋**：

- `refDebounced`（`@vueuse/nuxt` auto-import）包關鍵字，再放進 `useFetch` 的 reactive `query`，Nuxt 自己重抓。debounce 大約 300ms。
- 空狀態分兩種：有搜尋時 `找不到「x」的食記。`，沒搜尋時維持階段 2 的 `還沒有人寫食記，吃完的時候寫一下。`
- 重抓期間**不要**把清單清空或換成 loading 骨架，留著舊結果比閃一下空白好。

**深連結**：關鍵字與網址雙向同步——初值讀 `route.query.shop`，改變時 `router.replace`（不是 `push`，否則每打一個字就多一筆歷史紀錄）。這樣 `/feed?shop=麵屋 一心` 直接就是「這家的食記」頁；之後想從看板某一列連過來，不用再改 API 或頁面。

## 驗證

1. 搜假資料裡有多筆食記的那家店（例如 `麵屋 一心`）：只剩那家的、且由新到舊。
2. 搜一家**存在但沒有食記**的店（假資料裡刻意留了幾家）：顯示「找不到…」，不是整頁空白或錯誤。
3. **輸入 `%` 不會列出全部**，`_` 也不會亂配。這是這個階段最重要的一項。
4. 輸入 `\` 不會讓 API 500。
5. 打字時不是每個字元都送一次請求（DevTools Network 看，應該被 debounce 收斂）。
6. 清空關鍵字回到完整清單。
7. 直接開 `/feed?shop=麵屋 一心`（含中文與空白）：搜尋框帶著關鍵字進來、結果已經篩好。
8. 搜完按上一頁鍵回得到未篩選狀態，而且不需要按很多下（`replace` 而非 `push`）。
9. 英文店名大小寫不敏感（若假資料裡沒有英文店名，臨時加一家測完再刪）。
10. 首頁 `/` 的搜尋完全沒被影響。
11. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: find write-ups by shop name
```
