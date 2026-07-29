# 階段 5：寫食記

> 先讀 [`00-context.md`](00-context.md)。

## 目標

登入後能寫一篇食記：店家、拉麵名稱、價格、排隊情形、心得。**這是整個功能的目的所在**——前面幾個階段都只是讓它有地方可以出現。

未登入的人**看得到全部食記**，只是寫不了（決定 3）。不擋看、不擋搜尋。

## 前置

階段 2 完成。階段 3、4 不是必要的（手打 `/feed` 也能驗），但做完了比較好驗。

## 改動

### `server/api/reviews.post.ts`

新增，照 [`reports.post.ts`](../../server/api/shops/[id]/reports.post.ts) 的寫入路由形狀。

```ts
const { user } = await requireUserSession(event, { message: '請先登入再寫食記' })
```

預設訊息是英文，這裡要中文。

`readBody<{ shopId?: unknown, ramen?: unknown, price?: unknown, queue?: unknown, body?: unknown }>`，然後：

| 欄位 | 驗證 | 錯誤訊息 |
| --- | --- | --- |
| `shopId` | `Number.isInteger` 且 `> 0`，再查資料庫存在 | `店家不存在`（404，同 reports.post.ts） |
| `ramen` | `tidyLine` 後非空、`<= MAX_RAMEN` | `拉麵名稱請填 1–40 個字` |
| `price` | `isValidPrice` | `價格請填 1–9999 元` |
| `queue` | `tidyLine` 後非空、`<= MAX_QUEUE` | `排隊情形請填 1–60 個字` |
| `body` | `trim()` 後非空、`<= MAX_BODY` | `心得請填 1–500 個字` |

全部 `createError({ statusCode: 400, statusMessage: '...' })`。心得只 `trim()`，**不要** `tidyLine`——換行是內容。

insert 後 `.returning(...).get()`，回傳一個完整的 `ReviewSummary`：`shopName` 用剛才查存在時拿到的店名、`author` 用 `user.label`、`createdAt` 用 `.getTime()`。回整包是為了讓前端能直接 `unshift` 進清單，不必為了一筆新資料重抓整頁。

### `app/components/ReviewForm.vue`

新增。`defineEmits<{ submit: [payload] }>()`，送出中的狀態由父層傳 prop 進來（同 index.vue 的 `submitting` 模式）。

**店家欄位**——不新開 API：

- 讀已存在的 `GET /api/shops`（它回全部店家，含店名）
- 輸入時前端過濾出**最多 6 個**建議，點一下選定 `shopId`
- 完全沒有相符時給一顆「新增「x」」，呼叫已存在的 `POST /api/shops`（它本身就做大小寫不敏感去重）並用回傳的 id
- 這樣 `reviews.shop_id` 永遠是真的 FK，不會有打錯字生出來的孤兒店名

其餘欄位：拉麵名稱（`maxlength="40"`）、價格（`inputmode="numeric"`，只留數字，同 `ShopRow.vue` 的 `onInput` 作法）、排隊情形（`maxlength="60"`，placeholder 舉個例子讓人知道要寫什麼，例如 `排了 20 分鐘`）、心得（`<textarea>`、`maxlength="500"`）。

樣式：輸入框沿用 index.vue 新增店家那組 `border-b border-black/15 ... focus:border-black/60`；送出鈕用專案唯一的實心樣式 `rounded-full bg-black px-5 py-2.5 text-[13px] leading-4 text-white`。

`maxlength` 是體貼，不是驗證——伺服器端該擋的照擋。

### `app/pages/feed.vue`

- `const { loggedIn } = useUserSession()`
- 登入時：一顆「＋ 寫食記」展開表單（同 index.vue `新增店家` 的展開模式與 `nextTick` focus）
- 未登入時：一行連到 `/login` 的 `登入後可以寫食記`。**不是**擋住清單的遮罩、也不要自動導轉
- 送出成功：把回傳那筆 `unshift` 進清單、收起表單、`flash('已記下這一碗')`
- 送出失敗：`flash('送出失敗，請再試一次')`，**表單內容不要清掉**（打了五個欄位因為一次網路錯誤全部消失是最糟的體驗）

## 驗證

1. 未登入看 `/feed`：清單照樣看得到，只有一行「登入後可以寫食記」，點了到 `/login`。
2. 未登入直接打 API 回 401 中文訊息：
   ```sh
   curl -s -X POST localhost:3000/api/reviews -H 'content-type: application/json' -d '{}'
   ```
3. 登入後寫一筆，**挑既有店家**：送出後立刻出現在清單最上面，重新整理還在。
4. 再寫一筆，店名**打一個不存在的**，走「新增」路徑：店家被建起來，看板 `/` 上也看得到那家新店（因為就是同一張表）。
5. 每個欄位的邊界都擋得住：價格填 `0`、`99999`、`abc`；拉麵名留空；心得留空。都該回中文錯誤訊息，而且**表單內容不消失**。
6. 心得打多行，存完之後顯示有斷行。
7. 送出成功後表單收起、再打開時是乾淨的。
8. 剛寫的那筆作者是自己的 label，不是別人的：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select r.id, u.label, r.ramen, r.price from reviews r \
      join users u on u.id = r.user_id order by r.id desc limit 3"
   ```
9. 補驗階段 4 的閘門 2：表單 `<textarea>` 裡橫向拖曳選字**不會換頁**。
10. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: let people write up a bowl they ate
```
