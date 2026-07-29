# 階段 1：換 preset

> 先讀 [`00-context.md`](00-context.md)。

## 目標

把 Nitro preset 從 `cloudflare_module` 換成 `cloudflare-durable`，並在 wrangler 設定裡宣告 DO binding 與 migration。**這個階段不動任何行為** —— app 跑起來要跟原來一模一樣，只是底下多了一顆還沒有人用的 Durable Object。

刻意把這件事單獨切成一個階段：DO 的 binding 名稱、migration tag、Workers Paid 方案這三件事任一個沒對上，症狀都是「整個 app 起不來」。跟推送邏輯混在一起除錯會很痛。

## 前置

無。這是第一個階段。

需要確認的環境條件（[`00-context.md`](00-context.md) 有列）：Cloudflare 帳號是 **Workers Paid**。免費方案沒有 Durable Objects，`wrangler dev` 本機可以跑，但 `pnpm deploy` 會被拒。

## 改動

### `nuxt.config.ts`

改 [`nuxt.config.ts`](../../nuxt.config.ts) 的 `nitro` 區塊：

```ts
nitro: {
  preset: 'cloudflare-durable',
  experimental: { websocket: true },
  cloudflare: { deployConfig: true, nodeCompat: true },
},
```

兩點都是必要的：

- `preset` 換掉才會用到 `$DurableObject` 那個 entry。`cloudflare-durable` `extends: "cloudflare-module"`，所以 `cloudflare` 那一組選項原樣留著就對。
- `experimental.websocket` 打開的是編譯期常數 `import.meta._websocket`。**沒有它，`$DurableObject` 裡所有 WebSocket 分支都會被 tree-shake 掉**，`publish()` 會丟 `WebSocket not available`。這個錯要到階段 3 才會浮出來，所以現在就設好。

### `wrangler.jsonc`

在 [`wrangler.jsonc`](../../wrangler.jsonc) 加兩個頂層鍵，跟現有的 `d1_databases` 並列：

```jsonc
"durable_objects": {
  "bindings": [{ "name": "$DurableObject", "class_name": "$DurableObject" }]
},
"migrations": [{ "tag": "v1", "new_sqlite_classes": ["$DurableObject"] }]
```

- **`name` 與 `class_name` 都必須**是 `$DurableObject`。preset 裡是寫死的常數，不是慣例。
- 用 `new_sqlite_classes`，不是 `new_classes`。SQLite 儲存後端是現在的預設，而且新專案沒有理由用舊的 KV 後端。（這個功能其實不會用到 DO 的儲存 —— 廣播是純記憶體的 —— 但 migration 還是得宣告 class。）
- `migrations` 這個鍵跟 `d1_databases[0].migrations_dir` 沒有關係，兩者名字像但完全無關：一個是 DO class 的版本宣告，一個是 D1 的 SQL 檔目錄。

### 型別

`pnpm cf-typegen` 會把新 binding 寫進 [`worker-configuration.d.ts`](../../worker-configuration.d.ts)。跑一次，別手改那個檔。

## 驗證

1. **建置過得去，而且 entry 換了**：
   ```sh
   pnpm build
   grep -c '\$DurableObject' .output/server/index.mjs
   ```
   應該 > 0。是 0 就表示 preset 沒真的生效（最常見原因：`preset` 拼錯後 Nitro 靜默沿用預設）。

2. **DO 真的起得來**：
   ```sh
   pnpm preview
   ```
   `wrangler dev` 的啟動輸出裡要列出 `$DurableObject` 這個 binding，跟 `DB` 並列。沒列出來就是 `wrangler.jsonc` 沒被讀到。

3. **行為完全沒變**（這是本階段的重點）。在 `pnpm preview` 開的網址上：
   - 首頁列出店家，排序跟改動前一樣
   - 回報一次會成功，數字留在畫面上
   - 重新整理後回報還在（確認 D1 沒被 preset 切換影響）
   - 靜態資產正常（CSS 有生效、不是裸 HTML）—— `cloudflare-durable` 的 entry 自己處理 `env.ASSETS`，但值得看一眼

4. `pnpm typecheck` 與 `pnpm lint` 乾淨。

如果第 3 點有任何一項壞掉，**不要往階段 2 走**。preset 切換影響的是整個請求入口，帶著壞掉的 baseline 除錯後面兩階段會分不清問題出在哪。

## Commit

```
build: switch to the durable object worker preset
```
