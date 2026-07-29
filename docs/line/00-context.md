# LINE 登入：共用背景

每個階段檔案（`01`–`04`）都可以在**獨立的 session** 裡執行。開工前先讀這一份，再讀那一階段自己的檔案。

這份文件是 [`docs/passkey/`](../passkey/00-context.md) 之後的追加，**不改動那七個階段的任何決定**：passkey 留著、匿名回報留著、`users` 那張薄表留著。

## 這個功能要做什麼

多一條登入的路：用 LINE 帳號。用途跟 passkey 完全一樣——讓「回報」能掛上作者、被計數。

做它的理由**不是**多一個選項好看，是兩件現在做不到的事：

1. **從 LINE 訊息點進來的人登入不了。** LINE 的 in-app browser 是 WKWebView / Android WebView，WebAuthn API 通常不存在，[`login.vue`](../../app/pages/login.vue) 的 `browserSupportsWebAuthn()` 會回 `false`，兩顆按鈕直接 disabled。這個 app 的分享情境大半發生在 LINE 群組裡，那正好是最需要能登入的地方。
2. **有人就是不想管 passkey。** 「這是什麼、會不會掉」的成本對某些人比登入本身還高。

所以 LINE 登入是**並存的第二條路，不是取代**。`/login` 上 passkey 仍然是主要動作。

## 四個關鍵設計決策

這四點是整個實作的骨幹，不要在個別階段裡把它們改掉。

### 1. 只拿 `userId` 與 `displayName`，其餘一律不要

預設 scope `['profile', 'openid']` 換到的 profile 有四個欄位，這個 app 只用兩個：

- `userId`（`U` 開頭的字串）——唯一的識別碼，存進 `line_accounts.id`。
- `displayName`——只當 `users.label`，也就是「現在是『某某』」那行字。**它會變，永遠不要當識別碼用。**
- `pictureUrl` / `statusMessage`——**不存**。整個 app 沒有任何地方顯示頭像，存了就只是一份會過期的快取。

**email 不要碰。** LINE 的 `email` scope 需要送審並提供隱私權政策，而這個 app 不寄信——理由跟 [passkey 為什麼沒有 email](../passkey/00-context.md#1-為什麼沒有-email) 一樣，只是這次連技術上的用途都沒有。

### 2. `line_accounts` 一張薄表，LINE 的 `userId` 直接當 primary key

形狀照 [`credentials`](../../server/database/schema.ts#L27-L48)：外部發的識別碼直接當 PK，另一欄指回 `users.id`。

```
line_accounts: id (LINE userId, PK) · user_id → users.id · created_at
```

**不開 `provider` 欄位、不叫它 `identities`。** 現在只有一個 provider，那一欄永遠是 `'line'`，是為了想像中的第二個 provider 付的稅。真的加第三條路時再改表，比現在猜對便宜。

這張表的存在理由跟「一人多把 passkey」完全相同：同一個人手機用 LINE、筆電用 passkey，兩列都掛到同一個 `users.id`，**回報次數才不會裂成兩份**。次數是登入的全部重點，裂開就是錯的（階段 4 才做綁定入口）。

### 3. `state` 要自己接，模組不管

這是最容易漏的一點。讀 `line.js` 就看得到：

```js
state: query.state || ""          // 送出時：有就轉、沒有就送空字串
```

回來時**完全沒有比對**。也就是說模組給的是一條沒有 CSRF 保護的路，而 LINE 文件把 `state` 列為必填參數（送空字串大概走不到授權畫面）。

所以 `/auth/line` 是**自己的 handler 包住模組的 handler**：第一段自己發 state、存進 session 的 `secure` 區塊、把瀏覽器導回同一條 route，第二段回來時先比對再交給模組。做法在 [`01-channel.md`](01-channel.md)，challenge 那套機制原樣搬過來用。

> ⚠️ 兩段共用同一條 route，所以**判斷要看 query 有沒有 `state`**（`!code && !state` 才發新的）。只看 `!code` 會無限重導。

被攻擊的後果其實很輕——別人的瀏覽器被推去登入攻擊者的 LINE 帳號，最壞是回報記到不是自己的帳號上。但這道防線只要八行，比解釋為什麼不做便宜。

### 4. 錯誤訊息要自己接，模組給的是英文

模組在 `query.error` 有值時丟的是 `Line login failed: access_denied`，而 OAuth 是**整頁跳轉**——這串英文會直接出現在使用者眼前，破掉整個 app 的中文語感。

所以 `onError` 必寫，一律 `sendRedirect` 回 `/login`，訊息交給頁面上那行 `role="status"` 的小字說。同理 `onSuccess` 也必須 `sendRedirect`，不能回 JSON（階段 1 是唯一的例外，它刻意還不登入）。

## 為什麼不用 LINE 的官方 SDK 或 LIFF

LIFF 是「在 LINE 裡面開一個 mini app」的框架，帶來的是 LINE 內的原生外觀、分享 API、以及一組只在 LINE 裡跑得起來的頁面。這個 app 要的只是**一次 OAuth 交換**，而 `nuxt-auth-utils` 內建的 provider 已經把它做完了。多裝 SDK 換不到任何這裡用得上的東西。

## 已驗證的模組事實

寫的時候不要憑印象，這些是讀 `node_modules/nuxt-auth-utils/dist/` 原始碼確認過的：

| 事實 | 內容 |
| --- | --- |
| 版本 | `nuxt-auth-utils@0.5.29`，**不必裝任何新依賴** |
| helper | `defineOAuthLineEventHandler`，**auto-import**（模組 `addServerImportsDir` 掛了 `runtime/server/lib/oauth`），不要手動 import |
| 設定 | 模組已註冊 `runtimeConfig.oauth.line.{clientId, clientSecret, redirectURL}`，預設全是空字串 → **`nuxt.config.ts` 不用動**，給環境變數就好 |
| 環境變數 | `NUXT_OAUTH_LINE_CLIENT_ID`、`NUXT_OAUTH_LINE_CLIENT_SECRET` |
| 預設 scope | `['profile', 'openid']`，只在 `config.scope` 沒給時才套用 |
| profile 端點 | `https://api.line.me/v2/profile`，帶 `Authorization: Bearer` |
| `onSuccess` 參數 | `(event, { tokens, user })`。`user` 是**上面那支 REST 端點的原樣 JSON**，不是 `id_token` 解出來的——所以 `openid` scope 在這裡其實沒被用到 |
| `redirect_uri` | `getOAuthRedirectURL(event)` = `protocol//host + pathname`，**query 被丟掉** → route 的路徑就是 callback URL，不必寫死，localhost 與正式站自動各自對上（跟 `rpID` 那套一樣的道理） |
| `state` | 送出時原樣轉發 `query.state`、沒給就送 `""`；**回來時不驗證** |
| 失敗訊息 | `Line login failed: ${query.error}`，401，**英文** |

對欄位形狀有疑慮時直接讀 `node_modules/nuxt-auth-utils/dist/runtime/server/lib/oauth/line.js`——只有 80 行，那是唯一權威。

## 環境前提

- **LINE Developers 帳號**（用 LINE 帳號登入即可，免費）。需要建一個 Provider 與一個 **LINE Login** channel，型別選 Web app。
- Callback URL 要在 channel 設定裡逐一登記，**路徑完全相符**才算：
  - `http://localhost:3000/auth/line`（LINE 允許 localhost 走 http，其他網域一律要 https）
  - `https://<正式網域>/auth/line`
- **`pnpm dev` 就能跑完整個流程**，不像推送那樣非得 `pnpm preview`。但兩邊讀的環境變數檔不同：`pnpm dev` 讀 [`.env`](../../.env)，`pnpm preview` / 部署讀 [`.dev.vars`](../../.dev.vars) 與 Cloudflare 的 secret。**兩個檔案都要加**。
- 正式站的 secret 用 `pnpm wrangler secret put NUXT_OAUTH_LINE_CLIENT_ID`（與 `..._SECRET`）。**Channel secret 不要進 git。**

## 專案慣例（照著寫，不要另創風格）

- **資料庫**：Drizzle + D1。schema 在 [`server/database/schema.ts`](../../server/database/schema.ts)，用 `integer` timestamp mode、`sql\`(unixepoch())\`` 當預設值、陣列形式的 index callback。取 db instance 一律經由 [`useDb(event)`](../../server/utils/db.ts)。
- **API 錯誤**：`createError({ statusCode, statusMessage: '中文訊息' })`，比照 [`shops.post.ts`](../../server/api/shops.post.ts)。
- **樣式**：整個專案除了 `UApp` 之外沒有用任何 `@nuxt/ui` 元件，全是手寫 Tailwind。照 [`app/pages/login.vue`](../../app/pages/login.vue) 的語彙：`text-[13px] text-black/40`、`transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97]`、`hover-fine:hover:` 前綴、`role="status"` 的一行小字當訊息區。文案中文、句子式、不用驚嘆號。
- **註解**：只寫「為什麼」，不寫「做什麼」。看現有檔案的密度——很少，但每一條都在解釋一個非顯而易見的決定。
- **commit**：小寫 conventional commits、**不加 scope 括號**、訊息描述成果而不是實作。

## 階段總覽

每個階段結束都是**一個 commit**，而且都停下來讓人驗證。

| # | 檔案 | 成果 | commit |
| --- | --- | --- | --- |
| 1 | [`01-channel.md`](01-channel.md) | channel 與環境變數就位，`/auth/line` 走完 OAuth 一圈拿到 profile，但**還不會登入** | `build: add the line login channel and its callback route` |
| 2 | [`02-schema.md`](02-schema.md) | `line_accounts` 一張表 | `feat: add a table for linked line accounts` |
| 3 | [`03-signin.md`](03-signin.md) | 用 LINE 登入、登出，`/login` 多一個入口 | `feat: sign in with a line account` |
| 4 | [`04-link.md`](04-link.md) | 已登入的人綁 LINE，次數不裂開 | `feat: link a line account without splitting your count` |

順序是嚴格的。階段 1 刻意不讓任何人真的登入——那是為了把「channel 設定錯」跟「找人建人的邏輯錯」分在兩個階段被抓到，這兩類問題的症狀在同一個階段裡幾乎分不出來。
