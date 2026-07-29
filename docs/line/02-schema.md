# 階段 2：`line_accounts` 一張表

> 先讀 [`00-context.md`](00-context.md)。

## 目標

多一張把 LINE 帳號對應到 `users` 的表。**沒有任何行為改變**，這一階段只有 schema 與 migration。

## 前置

階段 1 完成（其實不依賴它的程式碼，但順序照文件走比較好對照）。

## 改動

### 1. [`server/database/schema.ts`](../../server/database/schema.ts)

在 `credentials` 後面加一張表，形狀刻意跟它一樣：

```ts
export const lineAccounts = sqliteTable('line_accounts', {
  /** LINE 自己發的 userId（U 開頭），原樣當主鍵 —— 跟 credentials 一樣的做法。 */
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, table => [
  index('line_accounts_user_idx').on(table.userId),
])
```

檔案結尾補一行 `export type LineAccount = typeof lineAccounts.$inferSelect`，比照其他型別。

三個決定要照著，不要自己加東西：

- **`displayName` 不存。** 它進 `users.label`，那是唯一會被顯示的地方。在這裡再存一份就會有兩個都自稱權威、而且一定會不同步的名字。
- **`pictureUrl` 不存。** 沒有任何畫面用得到它。
- **不加 `provider` 欄位。** 理由在 [`00-context.md`](00-context.md#2-line_accounts-一張薄表line-的-userid-直接當-primary-key)：只有一個 provider 時那一欄是常數。

`user_id` 上的 index 是給階段 4 用的——`/me` 要問「這個人綁過 LINE 了嗎」，那是唯一一個不從主鍵進來的查詢。登入走的是 `where id = <LINE userId>`，本來就是主鍵。

**`users` 這張表不動。** 沒有 `line_id` 欄位，沒有「登入方式」欄位。誰用什麼方式登入，看的是 `credentials` 與 `line_accounts` 裡有沒有他的列。

### 2. Migration

```sh
pnpm db:generate
pnpm db:migrate
```

產出的 SQL 檔進 git（比照 `server/database/migrations/` 裡現有那五個）。**打開來讀一遍**再往下走，特別是 `on delete cascade` 有沒有真的生成出來。

seeds 不用動——假資料裡沒有人。

## 驗證

1. 表真的在：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select name from sqlite_master where type='table' and name='line_accounts'"
   ```
2. 欄位與外鍵對：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select sql from sqlite_master where name='line_accounts'"
   ```
   看到 `primary key`、`not null`、`on delete cascade`、以及那個 index。
3. **cascade 真的會動**（手動試一次，這是唯一會讓資料默默長殘的地方）：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "insert into line_accounts (id, user_id) select 'Utest', id from users limit 1"
   ```
   如果 `users` 是空的就先用 passkey 註冊一個人。然後刪掉那個 user，確認 `line_accounts` 那列跟著消失，最後把測試資料清乾淨。
4. 首頁、`/login`、`/me`、匿名回報**全部照舊**。
5. `pnpm typecheck` 與 `pnpm lint` 乾淨。

正式站的 migration 這一階段先不跑（`db:migrate:remote` 留到階段 3 要上線之前）。

## Commit

```
feat: add a table for linked line accounts
```
