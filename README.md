# ramen now

拉麵店排隊人數的共同回報板。一頁、白底、沒有多的東西：看現在排幾個人，點一下回報。

- 每筆回報只記「目前排隊人數」，不估等待時間。
- 人數用小人 icon 呈現，旁邊是數字；超過 10 人只畫 10 個小人，數字才是準的。
- 超過 90 分鐘的回報會轉淡，代表不能再當「現在」看。
- 店家由使用者自己新增，同名（不分大小寫）會歸成同一家。

Nuxt 4 + Nuxt UI v4 + Cloudflare Workers + D1（Drizzle）。

## 開發

```sh
pnpm install
pnpm db:migrate   # 建立本機 D1（.wrangler/state）
pnpm dev
```

## 部署

`wrangler.jsonc` 裡的 `database_id` 是佔位值，第一次部署前要先建立真正的 D1：

```sh
pnpm wrangler d1 create ramen-now   # 把回傳的 database_id 填回 wrangler.jsonc
pnpm db:migrate:remote
pnpm deploy
```

## 其他指令

| 指令 | 用途 |
| --- | --- |
| `pnpm db:generate` | 改完 `server/database/schema.ts` 後產生 migration |
| `pnpm cf-typegen` | 重新產生 `worker-configuration.d.ts`（改過 wrangler 設定後） |
| `pnpm lint` / `pnpm typecheck` | 檢查 |
| `pnpm preview` | 用 wrangler 跑 build 後的結果 |
