# 階段 1：資料表與假資料

> 先讀 [`00-context.md`](00-context.md)。

## 目標

`reviews` 一張表 + 一整批假食記。這個階段不動任何行為——app 跑起來要跟原來一模一樣，成果只在資料庫裡。

假資料跟 schema 綁在同一個 commit 是刻意的：沒有資料的話下一階段的 `/feed` 只能看到空狀態，等於整頁沒驗到。

## 前置

無。這是第一個階段。

## 改動

### `reviews`

只改 [`server/database/schema.ts`](../../server/database/schema.ts)，沿用檔案現有寫法（`integer` timestamp mode、`sql\`(unixepoch())\`` 預設值、陣列形式的 index callback、`createdAt` 放最後）。

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | integer PK autoIncrement | |
| `shopId` | integer FK → `shops.id`，`onDelete: 'cascade'` | |
| `userId` | integer **notNull** FK → `users.id`，`onDelete: 'cascade'` | 見下方 |
| `ramen` | text notNull | 拉麵名稱 |
| `price` | integer notNull | 新台幣整數 |
| `queue` | text notNull | 排隊情形，**自由文字** |
| `body` | text notNull | 心得 |
| `photoUrl` | text（nullable） | 保留給之後的上傳階段，現在沒有任何地方寫它 |
| `createdAt` | integer timestamp | |

`userId` 有兩點跟 `reports.userId` 不同，都要有註解，否則下一個人會以為是漏寫：

- **`notNull`**：寫食記必須登入（決定 3），所以一定有作者。
- **`cascade` 而不是 `set null`**：`notNull` 之下 `set null` 不合法，只有 cascade 這個選擇。這個 app 沒有刪帳號的路徑，所以實際上不會觸發。

index 兩個：

```ts
index('reviews_shop_created_idx').on(table.shopId, table.createdAt),
index('reviews_created_idx').on(table.createdAt),
```

`(shop_id, created_at)` 給階段 6 的「搜某家、由新到舊」；`created_at` 單獨一個給階段 2 的整頁 feed。**不要**加 `reviews_user_idx`——這個功能沒有「我的食記」頁面，加了是沒有查詢會用到的索引。

檔尾比照現有的 `Shop` / `Report`，加 `export type Review = typeof reviews.$inferSelect`。

### 產生 migration

```sh
pnpm db:generate   # 應產出 server/database/migrations/0004_*.sql
pnpm db:migrate
```

產生的 SQL **不要手改**。這次是純 `CREATE TABLE`，不像階段 2 的 passkey migration 會碰到 SQLite `ALTER TABLE` 的限制。

### 假資料

新增 `server/database/seeds/0002_fake_reviews.sql`，照 [`0001_fake_shops.sql`](../../server/database/seeds/0001_fake_shops.sql) 的慣例：檔頭註解說明 idempotency 並以指令結尾、明確 id + `insert or ignore`、時間戳相對於執行時間。

**先插假作者**：三到四個 `users`，label 用註冊時同樣的 `拉麵Now #xxxx` 形狀。這裡要一句註解說明——`docs/passkey` 刻意不 seed `users` 是因為**passkey 無法造假**，但作者名不受這個限制：這些 user 沒有任何 credential，所以誰也登入不進去，它們只是讓食記有作者。

**再插食記**：12–14 筆，掛在 `0001_fake_shops.sql` 已有的店家 id（1–10）上。要蓋到的狀態：

- **同一家有多筆**（例如 shop 1 三筆），階段 6 的「由新到舊」才驗得出來
- 價格散在 180–420
- 排隊情形長短不一：`沒排隊，直接坐` 到 `門口排了十幾個，等了 25 分鐘左右`
- **至少一筆心得含換行**，階段 2 的 `whitespace-pre-line` 才驗得出來
- **有幾家完全沒有食記**（例如 shop 8、10），空狀態與「搜到店但沒食記」才驗得出來
- 時間戳從 `unixepoch() - 60 * 20` 散到 `unixepoch() - 86400 * 40`
- `photo_url` 全部留空

### 讓 `pnpm db:seed` 跑兩個檔案

[`package.json`](../../package.json) 的 `db:seed` 與 `db:seed:remote` 各改成用 `&&` 串兩個 `wrangler d1 execute`。`pnpm-workspace.yaml` 開了 `shellEmulator: true`，`&&` 跨平台可用。

順序有意義：`0002` 的食記引用 `0001` 的店家 id，反過來跑會撞 FK。

## 驗證

1. 表結構正確，`user_id` 是 `not null`、`photo_url` 不是：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select sql from sqlite_master where name = 'reviews'"
   ```
2. `pnpm db:seed` **跑兩次**，數字不變（idempotent）：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select count(*) as reviews from reviews; select count(*) as users from users"
   ```
3. join 得起來、由新到舊：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select r.id, s.name, r.ramen, r.price, u.label from reviews r \
      join shops s on s.id = r.shop_id join users u on u.id = r.user_id \
      order by r.created_at desc limit 5"
   ```
4. 有一筆心得真的含換行：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select id from reviews where body like '%' || char(10) || '%'"
   ```
5. `pnpm dev` → 首頁與回報全部照舊（這個階段不該有任何可見變化）。
6. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: add a table for ramen write-ups
```
