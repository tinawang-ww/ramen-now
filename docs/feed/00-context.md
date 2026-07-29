# 食記：共用背景

每個階段檔案（`01`–`06`）都可以在**獨立的 session** 裡執行。開工前先讀這一份，再讀那一階段自己的檔案。

## 這個功能要做什麼

現在的拉麵Now 只回答一個問題：**這家現在排幾人**。回報是一次性的、只有一個數字，超過 90 分鐘就變淡——刻意不留下任何東西。

要加的是相反的一半：**留得下來的食記**。使用者寫下在某家店吃了什麼拉麵、多少錢、當時排隊情形、以及心得，之後任何人都能搜店名把那家的食記由新到舊翻出來。

> 看板回答「現在」，食記回答「值不值得去」。

不做（明確排除）：照片上傳（見決定 1）、`/me` 列出自己的食記、按讚與回覆、編輯與刪除、分頁（先用 `limit`）。

## 五個關鍵設計決策

這五點是整個實作的骨幹，不要在個別階段裡把它們改掉。

### 1. 這版不做照片上傳

專案完全沒有檔案儲存——`wrangler.jsonc` 只有一個 D1 binding，沒有 R2、沒有 KV。要做真的上傳就得新增 bucket binding、重跑 `cf-typegen`、寫上傳路由與大小／型別驗證，而且 `pnpm dev` 碰不到 R2，得改用 `pnpm preview` 驗證——那是比整個食記功能還大的一塊。

所以：schema **留一個 nullable 的 `photo_url`**，但 API 與 UI 都不寫它、不讀它。食記的資料形狀本來就含照片，欄位先留著，之後那個階段只要做上傳與顯示，不用再動 schema 與 migration。

### 2.「排隊情形」是自由文字，不是數字

食記是**回顧**。「排了快半小時」、「假日中午別去」、「沒排隊，直接坐」都是這一欄的正確答案，把它壓成一個整數會把最有用的部分丟掉。

這一欄跟看板的 `reports.people`（**現在**幾人）是不同的東西：不共用欄位、不互相寫入、不進 `shops` 的任何統計。寫食記不會影響看板上那個數字，反過來也不會。

### 3. 要登入才能發食記

這是專案裡**第一個需要登入的寫入動作**，跟 `docs/passkey/00-context.md` 說的「匿名回報保留」不衝突，因為兩件事的性質不同：

- **回報**是「路過按一下」——一個數字、90 分鐘後就過期，要求登入只會讓人不回報。
- **食記**有作者、有心得、會一直留著。掛名才對。

因此 `reviews.user_id` 是 **`not null`**（`reports.user_id` 是 nullable，那是刻意的差異）。**未登入的人看得到全部食記**，只是寫不了——不擋看、不擋搜尋。

### 4. `/feed` 是第二個平級的主畫面，不是看板的子頁

現在的四頁分成兩種：`/` 是主畫面，`/login` 與 `/me` 是從主畫面進去、用 `← 回看板` 出來的支線。加了 `/feed` 之後**主畫面變成兩個**，而它們是平級的——沒有哪個是另一個的子頁。導覽必須反映這件事，所以進入點不能是塞在角落的一行連結。完整設計見下面「導覽設計」。

### 5. 搜尋在伺服器端做，不在前端過濾

[`index.vue`](../../app/pages/index.vue) 的搜尋是前端過濾，因為它手上本來就有全部店家。食記不一樣：**它會一直累積**，而 `GET /api/reviews` 有 `FEED_LIMIT`。前端過濾只能搜到 limit 以內的那些，搜不到的會看起來像「沒有這家的食記」——那是個會說謊的洞。

所以關鍵字進 query string，`where` 在 SQL 裡。

## 已驗證的事實

寫的時候不要憑印象，這些是查過原始碼確認的：

| 事實 | 內容 |
| --- | --- |
| `useSwipe` 簽名 | `useSwipe(target: MaybeRefOrGetter<EventTarget \| null \| undefined>, options?)`，出自 `@vueuse/core@14.3.0`，`@vueuse/nuxt` 自動 import |
| `useSwipe` options | `passive`（**預設 true**）、`threshold`（預設 50）、`onSwipeStart(e: TouchEvent)`、`onSwipe`、`onSwipeEnd(e, direction)` |
| `useSwipe` direction | `'up' \| 'down' \| 'left' \| 'right' \| 'none'`，內部已挑主要軸向 |
| `useSwipe` 回傳 | `{ isSwiping, direction, coordsStart, coordsEnd, lengthX, lengthY, stop }` |
| `useSwipe` 事件型別 | `TouchEvent`——**只有觸控**。桌機滑鼠／觸控板不會觸發（`usePointerSwipe` 會搶滑鼠拖曳與選字，不用） |
| 時間戳慣例 | D1 存 **unix 秒**，API 一律回 **ms**。drizzle `{ mode: 'timestamp' }` 查出來是 `Date`，用 `.getTime()`；raw SQL 查出來是數字，要 `* 1000`（見 [`shops.get.ts`](../../server/api/shops.get.ts)） |
| `requireUserSession` | 第二個參數 `{ statusCode?, message? }`，預設訊息是英文，要中文就自己給 |

對 `useSwipe` 的欄位形狀有疑慮時直接讀 `node_modules/@vueuse/core/dist/index.d.ts` 的 `useSwipe` 區塊，那是唯一權威。

## 導覽設計

**做法：一個 `app/components/SiteNav.vue`，只放在 `/` 與 `/feed` 兩頁的最上面。**

```
看板　食記                                   登入 ／ 拉麵Now #a3f1
─────────────────────────────────────────────────────────
現在排幾人
路過的人回報，出門前先看一眼。
```

- 左邊兩個 `NuxtLink`：目前頁 `text-black/90`、另一頁 `text-black/30`，都是 `text-[13px] leading-5` 加專案標準的 `transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97]`。active 判斷用 `useRoute().path`。**不用底線或方框**——這個 app 沒有任何框線 UI，濃淡就夠了。
- 右邊是身分連結（`user?.label` 或 `登入`），從 [`index.vue`](../../app/pages/index.vue) 的 header **原樣搬過來**：同樣的 class、同樣 `loggedIn ? '/me' : '/login'`、連那句 `One tappable thing only` 的註解一起搬。搬家不是改設計：它本來就是「這一頁最上面唯一的另一個去處」，只是那個位置現在改由導覽列擁有。
- 主畫面的順序由 `app/utils/nav.ts` 的 `SURFACES` 決定，**那是唯一來源**：導覽列、轉場方向、手勢三個地方都讀它。否則「食記在看板右邊」這件事會散在三份程式碼裡各說一次，改一個忘一個。

**刻意不做的三件事：**

- **不用 `app/layouts/default.vue`。** 加了 default layout 就會套到 `/login` 與 `/me`：`/login` 是刻意乾淨的（登入前不該有分頁可逛），`/me` 已經有 `← 回看板` 的返回語彙。兩頁各放一行 `<SiteNav />` 比一個要開例外的 layout 誠實。
- **不做底部 tab bar。** 整個 app 沒有任何固定 chrome，而每頁底部都有一行 `role="status"` 的訊息——固定列會壓在它上面。
- **不在 [`ShopRow.vue`](../../app/components/ShopRow.vue) 加「看這家的食記」。** 那個展開面板的每個控制項都調過，多一顆會稀釋「回報」。改用更便宜的做法：`/feed?shop=名字` 支援深連結（階段 6），之後真的需要時再從 row 接上去，屆時不必改 API。

### 手勢：左右滑動換頁

兩個平級主畫面左右並排，所以**在 `/` 與 `/feed` 上可以左右滑動換頁**：往左滑去食記，往右滑回看板。導覽列的濃淡是「我在哪、還能去哪」的說明，手勢是實際的移動方式。

**`passive` 保持 true**：不阻擋原生捲動比手勢跟手重要。代價是內容**不會 1:1 跟著手指**，是放開手指才切換。要做到真正跟手就得把兩個畫面放進同一個 route 的 scroll-snap 容器裡，那會賠掉 `/feed` 這個網址與 `?shop=` 深連結——不值得。

**四個必要的閘門**，少一個都會變成惱人的誤觸：

1. **只在主畫面上生效**：`surfaceIndex(route.path) < 0` 就什麼都不做，所以 `/login`、`/me` 不受影響。
2. **不從「橫向拖曳另有意義」的元件上起手**：`onSwipeStart` 時若 `(e.target as HTMLElement).closest('input, textarea, select, [contenteditable], [role="slider"]')` 有東西就放棄——移動游標與選字要能正常用。

   **`button` 與 `a` 刻意不在這個清單裡。** 看板的每一列都是整行寬的 `<button>`，把 button 排除等於在整個看板上都滑不動，手勢就廢了。而觸控只要走得夠遠、到得了 swipe 的門檻，就早已超過瀏覽器的 slop threshold，不會再變成 click——滑過某一列不會順手把它展開，輕點它照樣會展開。（這一條是實測改出來的：原本把 button 一起排除，結果 `/` 上幾乎滑不動。）
3. **不搶 iOS Safari 的邊緣返回**：起點在畫面左緣 32px 內就放棄。
4. **要求水平為主**：`Math.abs(lengthX) > Math.abs(lengthY) * 1.5` 才算。`direction` 本身已挑主軸，這個倍率是讓斜著滑的拇指捲動不會誤切頁。

**到端點不繞回**：看板往右滑、食記往左滑都不動。只有兩頁，繞回會讓人以為後面還有第三頁。

**手勢是附加的，永遠不是唯一路徑**：導覽列的連結仍是主要入口，也是唯一的鍵盤路徑。

## 專案慣例（照著寫，不要另創風格）

- **資料庫**：Drizzle + D1。schema 在 [`server/database/schema.ts`](../../server/database/schema.ts)，用 `integer` timestamp mode、`sql\`(unixepoch())\`` 當預設值、陣列形式的 index callback。取 db instance 一律經由 [`useDb(event)`](../../server/utils/db.ts)，不要自己碰 binding。
- **API 錯誤**：`createError({ statusCode, statusMessage: '中文訊息' })`，比照 [`shops.post.ts`](../../server/api/shops.post.ts)。
- **樣式**：整個專案除了 `UApp` 之外**沒有用任何 `@nuxt/ui` 元件**，全是手寫 Tailwind。照 [`app/pages/index.vue`](../../app/pages/index.vue) 的語彙：`text-[13px] text-black/40`、`transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97]`、`hover-fine:hover:` 前綴、`role="status"` 的一行小字當訊息區。文案中文、句子式、不用驚嘆號。
- **註解**：只寫「為什麼」，不寫「做什麼」。看現有檔案的密度——很少，但每一條都在解釋一個非顯而易見的決定。
- **commit**：小寫 conventional commits、**不加 scope 括號**、訊息描述成果而不是實作。

## 階段總覽

每個階段結束都是**一個 commit**，而且都停下來讓人驗證。

| # | 檔案 | 成果 | commit |
| --- | --- | --- | --- |
| 1 | [`01-schema.md`](01-schema.md) | `reviews` 表 + 一整批假食記 | `feat: add a table for ramen write-ups` |
| 2 | [`02-feed.md`](02-feed.md) | `/feed` 由新到舊列出所有食記 | `feat: show what people ate, newest first` |
| 3 | [`03-nav.md`](03-nav.md) | 看板與食記互相到得了 | `feat: put the board and the write-ups side by side` |
| 4 | [`04-swipe.md`](04-swipe.md) | 左右滑動換頁 + 方向性轉場 | `feat: swipe between the board and the write-ups` |
| 5 | [`05-write.md`](05-write.md) | 登入後能寫一篇食記 | `feat: let people write up a bowl they ate` |
| 6 | [`06-search.md`](06-search.md) | 搜店名找那家的食記 | `feat: find write-ups by shop name` |

階段 1 → 2 → 3 有嚴格順序（導覽不能連到還不存在的頁），4 依賴 3。5 與 6 都只依賴 2，彼此獨立，順序可換。
