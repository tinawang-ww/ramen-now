# Passkey 登入：共用背景

每個階段檔案（`01`–`07`）都可以在**獨立的 session** 裡執行。開工前先讀這一份，再讀那一階段自己的檔案。

## 這個功能要做什麼

用 [Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API) 做登入。**唯一用途是讓「回報」能被統計次數，並用一個頁面顯示給本人看。**

不是為了保護資料，也不是為了擋人。所以：

- **匿名回報保留。** 未登入照樣一鍵回報，不擋、不引導。登入只是讓那筆回報掛上作者、因此能被計數。
- **要求回報（`request`）與新增店家維持原樣，不動。** `request` 只在 `shops.requested_at` 蓋時間戳、沒有逐筆資料表，加作者得多開一張表——以簡潔為優先，不做。
- **不做任何限流。**
- **沒有 email、沒有密碼、沒有帳號名稱。** 註冊與登入都是零輸入，各一個按鈕。
- 一人可有多把 passkey（手機 + 筆電），次數不因此裂成兩份。

## 三個關鍵設計決策

這三點是整個實作的骨幹，不要在個別階段裡把它們改掉。

### 1. 為什麼沒有 email

email 在 passkey 流程裡唯一的作用是「先告訴伺服器你是誰，好把 `allowCredentials` 縮小到你的憑證」。但 **discoverable credential（resident key）** 本來就把身分存在憑證裡，登入時瀏覽器直接回傳 credential ID，伺服器查那個 ID 就知道是誰。email 是多餘的一層，而這個 app 根本不寄信——留著只會換來唯一性索引、格式驗證，以及「我當初用哪個信箱」的回憶成本。

因此：
- 註冊時 `getOptions()` 必須回 `authenticatorSelection: { residentKey: 'required' }`。**這是零輸入登入的前提**，沒有它就沒有 discoverable credential，登入就得回頭要識別碼。
- 登入 handler **不要寫 `allowCredentials`**。模組內部是 `if (allowCredentials && body.userName)`，兩者都不給就不設限制條件，瀏覽器會列出本站所有 passkey 讓人選。
- WebAuthn 規格仍要求一個 `userName`（`WebAuthnUser.userName` 是 required），但它只是作業系統 passkey 選單上的**標籤**：不需唯一、不需驗證。前端自動產生，使用者不必輸入。

### 2. challenge 存在 session 的 `secure` 區塊，不開表

`setUserSession` 有一個 `secure` 區塊，存在密封 cookie 裡、不外流到 client。只給 `secure`、不給 `user` 時**不會**讓人變成已登入狀態（`requireUserSession` 判斷的是 `userSession.user` 是否存在），所以 challenge 天然只綁在發起請求的那個瀏覽器上——比放在全站共用的 D1 表更對，也不必為此多開一個 KV namespace。

不能用 Nitro 的 `useStorage()`：Workers 上預設是 per-isolate 記憶體，跨 isolate 讀不到，challenge 會隨機失效。

> ⚠️ **陷阱**：`setUserSession` 內部是 `session.update(defu(data, session.data))`——**merge，而且舊值在新值為 `undefined` 時會存活**。所以**無法**用 `setUserSession(..., { secure: { webauthn: undefined } })` 清除 challenge，那會靜默留著上一次的值、讓「單次使用」失效。清除必須走 `replaceUserSession`。

### 3. `users` 是一張很薄的表，但要留著

沒有 email 之後 `users` 只剩 `id` / `label` / `createdAt`。留著的理由是**一人可多把 passkey**：手機與筆電各註冊一把時，兩把 credential 掛到同一個 `users.id`，回報次數才不會裂成兩份。次數是這個功能的全部重點，裂開就是錯的。

（階段 7 才會把「加第二把」的入口做出來。階段 3 的註冊一律建立新使用者，因為那時還沒有任何入口能在已登入狀態下註冊。）

## 已驗證的模組事實

寫的時候不要憑印象，這些是查過原始碼確認的：

| 事實 | 內容 |
| --- | --- |
| 版本 | `nuxt-auth-utils@0.5.29`，peerDependencies 鎖 `@simplewebauthn/* ^11.0.0`（上游已到 v13，**不要**裝 v13，會 peer 衝突 + API 漂移） |
| 設定鍵 | `nuxt.config.ts` 的 `auth: { webAuthn: true }`（大寫 A） |
| `authenticate()` | `userName` 是 optional，可以完全零參數呼叫 |
| `credentials.publicKey` | 存 **base64URL 字串**。模組自己 `base64URLStringToBuffer()` 解碼，不要自己轉 Uint8Array |
| `credentials.transports` | 原樣傳入 `verifyAuthenticationResponse`，所以**必須是陣列**——存進 D1 時 `JSON.stringify`，讀出來時 `JSON.parse` |
| `onSuccess` 的 credential | `{ id, publicKey, counter, backedUp, transports, aaguid }` |
| `runtimeConfig.webauthn` | **不要填**。留空時模組從 request origin 推導 `rpID`/`origin`，localhost 與正式站都自動對上；寫死會在其中一邊壞掉 |

實作某個 handler 前，如果對欄位形狀有疑慮，直接讀 `node_modules/nuxt-auth-utils/dist/runtime/server/lib/webauthn/` 底下的檔案，那是唯一權威。

## 專案慣例（照著寫，不要另創風格）

- **資料庫**：Drizzle + D1。schema 在 [`server/database/schema.ts`](../../server/database/schema.ts)，用 `integer` timestamp mode、`sql\`(unixepoch())\`` 當預設值、陣列形式的 index callback。取 db instance 一律經由 [`useDb(event)`](../../server/utils/db.ts)，不要自己碰 binding。
- **API 錯誤**：`createError({ statusCode, statusMessage: '中文訊息' })`，比照 [`shops.post.ts`](../../server/api/shops.post.ts)。
- **樣式**：整個專案除了 `UApp` 之外**沒有用任何 `@nuxt/ui` 元件**，全是手寫 Tailwind。照 [`app/pages/index.vue`](../../app/pages/index.vue) 的語彙：`text-[13px] text-black/40`、`transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97]`、`hover-fine:hover:` 前綴、`role="status"` 的一行小字當訊息區。文案中文、句子式、不用驚嘆號。
- **註解**：只寫「為什麼」，不寫「做什麼」。看現有檔案的密度——很少，但每一條都在解釋一個非顯而易見的決定。
- **commit**：小寫 conventional commits、**不加 scope 括號**、訊息描述成果而不是實作。對照現有紀錄：`feat: let people ask for a report they can't file themselves`、`build: point the D1 binding at the real database`。

## 階段總覽

每個階段結束都是**一個 commit**，而且都停下來讓人驗證。

| # | 檔案 | 成果 | commit |
| --- | --- | --- | --- |
| 1 | [`01-setup.md`](01-setup.md) | 模組裝好、session 密鑰就位，app 照舊能跑 | `build: add nuxt-auth-utils with webauthn enabled` |
| 2 | [`02-schema.md`](02-schema.md) | `users` / `credentials` 兩張表 + `reports.user_id` | `feat: add tables for people and their passkeys` |
| 3 | [`03-register.md`](03-register.md) | 零輸入建立 passkey，`/login` 有一顆按鈕 | `feat: create a passkey with no fields to fill in` |
| 4 | [`04-signin.md`](04-signin.md) | 零輸入登入 + 登出 | `feat: sign in with a passkey and nothing else` |
| 5 | [`05-count.md`](05-count.md) | 回報掛上作者，`/me` 顯示次數 | `feat: count the reports you filed while signed in` |
| 6 | [`06-home-header.md`](06-home-header.md) | 首頁顯示登入狀態 | `feat: show who you are on the board` |
| 7 | [`07-multi-passkey.md`](07-multi-passkey.md) | 加第二把 passkey 而次數不裂開 | `feat: add another passkey without splitting your count` |

階段 1–4 有嚴格順序。5、6、7 都依賴 4，但彼此獨立，順序可換。
