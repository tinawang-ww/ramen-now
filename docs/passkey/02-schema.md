# 階段 2：資料表

> 先讀 [`00-context.md`](00-context.md)。

## 目標

把 `users`、`credentials` 兩張表與 `reports.user_id` 一次加好，產生**單一** migration。這個階段也不動任何行為——app 跑起來要跟原來一模一樣。

三個 schema 改動綁在一起是刻意的：它們屬於同一次 migration，拆開會多出兩個沒有意義的 migration 檔，而且中間狀態（有 `users` 但 `reports` 還沒有 `user_id`）沒有任何價值。

## 前置

階段 1 完成。

## 改動

只改 [`server/database/schema.ts`](../../server/database/schema.ts)。沿用檔案現有寫法：`integer` timestamp mode、`sql\`(unixepoch())\`` 預設值、陣列形式的 index callback、`createdAt` 的欄位順序放最後。

### `users`

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | integer PK autoIncrement | |
| `label` | text notNull | 作業系統 passkey 選單上的標籤。**不是識別碼**：不唯一、不驗證、不能用來查人 |
| `createdAt` | integer timestamp | |

`label` 值得一句註解說明它不是識別碼，否則下一個人看到 `users` 只有一個 text 欄位，很自然會想在上面加 unique index。

### `credentials`

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | text **PK** | credential ID 本身，不是自增數字 |
| `userId` | integer FK → `users.id`，`onDelete: 'cascade'` | |
| `publicKey` | text notNull | base64URL 字串。模組自己解碼，不要存 blob |
| `counter` | integer notNull | 每次登入遞增，防重放用 |
| `backedUp` | integer `{ mode: 'boolean' }` notNull | |
| `transports` | text | JSON 字串。讀出來要 `JSON.parse` 成陣列 |
| `createdAt` | integer timestamp | |

加 index on `userId`。

### `reports.userId`

在現有的 `reports` 表加一個 **nullable** integer FK → `users.id`，`onDelete: 'set null'`。

- **nullable 是刻意的**：匿名回報就是 `NULL`。這是「匿名回報保留」在資料層的實作。
- **`set null` 而不是 `cascade`**：帳號刪掉不該連帶砍掉回報紀錄，那些回報對其他人仍然有用。

同時加 `index('reports_user_idx').on(table.userId)`。現有的 `reports_shop_created_idx` 是 `(shop_id, created_at)`，幫不到「我的回報次數」那個查詢，而階段 5 的頁面會一直打它。

### 型別匯出

比照檔尾現有的 `Shop` / `Report`，加上 `User` 與 `Credential`。

### 產生 migration

```sh
pnpm db:generate   # 應產出 server/database/migrations/0003_*.sql
pnpm db:migrate
```

**產生後打開 `0003_*.sql` 讀一遍。** SQLite 不能直接 `ALTER TABLE ADD COLUMN` 帶 FK 約束，drizzle-kit 可能改用「建新表 + 搬資料 + 換名」的手法。如果它真的這樣做，確認 `reports` 現有資料在 migration 後還在（驗證步驟 2 會抓到）。

## 驗證

1. 三張表的結構正確：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select name from sqlite_master where type='table' order by name"
   pnpm wrangler d1 execute ramen-now --local --command \
     "select sql from sqlite_master where name in ('users','credentials','reports')"
   ```
   `reports.user_id` 要是 nullable、沒有 `not null`。
2. **既有資料沒被 migration 弄掉**（對應上面 SQLite 的 `ALTER TABLE` 限制）：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select count(*) from shops; select count(*) from reports"
   ```
   數字應該跟 migrate 前一樣。跑之前先記下來。
3. `pnpm dev` → 首頁照舊，**回報一次應該成功**（此時 `user_id` 會是 `NULL`，因為還沒有人寫入它）：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select id, people, user_id from reports order by id desc limit 1"
   ```
4. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: add tables for people and their passkeys
```
