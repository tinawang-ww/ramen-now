# 階段 1：channel 就位，OAuth 走得完一圈

> 先讀 [`00-context.md`](00-context.md)。

## 目標

`/auth/line` 能把人送去 LINE、拿到同意、換回 profile。**但還不會登入任何人**——這一階段結束時，`/login` 的畫面與行為完全沒變。

這樣切的理由是：channel 設定錯（callback URL 差一個字、secret 貼錯）與登入邏輯錯，症狀都是「按了沒反應」。分成兩階段，第一種在這裡就會被抓到。

## 前置

無（passkey 那七個階段已經完成）。

## 改動

### 1. LINE Developers 設定（不是程式碼，但先做完）

1. 在 [LINE Developers](https://developers.line.biz/console/) 建一個 Provider（名字隨意，例如 `拉麵Now`）。
2. 在它底下建 channel，型別選 **LINE Login**，App type 勾 **Web app**。
3. 到 **LINE Login** 分頁，Callback URL 填兩行（一行一個）：
   ```
   http://localhost:3000/auth/line
   https://<正式網域>/auth/line
   ```
   **路徑要跟 route 檔名完全對上**，`getOAuthRedirectURL` 是拿 request 的 `pathname` 當 `redirect_uri`，差一個字元 LINE 就回 `invalid_request`。
4. 到 **Basic settings** 抄 **Channel ID** 與 **Channel secret**。

### 2. 環境變數

[`.env`](../../.env) 與 [`.dev.vars`](../../.dev.vars) **兩個都加**（`pnpm dev` 讀前者，`wrangler dev` 與部署讀後者）：

```
NUXT_OAUTH_LINE_CLIENT_ID=<Channel ID>
NUXT_OAUTH_LINE_CLIENT_SECRET=<Channel secret>
```

`.env.example` 與 `.dev.vars.example` 各補兩行同名的、值寫說明文字，比照現有那行 `NUXT_SESSION_PASSWORD`。

`nuxt.config.ts` **不要動**——模組已經幫 `oauth.line` 註冊好 runtime config，寫進去只是重複一次同樣的東西，還多了一份會跟環境變數不一致的風險。

### 3. `shared/auth.d.ts`

`SecureSessionData` 加一個欄位，跟 `webauthn` 併排：

```ts
line?: { state: string }
```

### 4. `server/utils/line.ts`（新）

兩個函式，形狀照 [`server/utils/webauthn.ts`](../../server/utils/webauthn.ts) 那對 `storeChallenge` / `getChallenge`：

- **`mintState(event)`** — `crypto.getRandomValues` 產一個 hex 字串（16 bytes 夠），`setUserSession(event, { secure: { line: { state } } })`，回傳那個字串。

  只給 `secure`、不給 `user` **不會**讓人變成已登入狀態（`requireUserSession` 看的是 `userSession.user`），所以匿名訪客走這條路不會意外拿到身分。

- **`verifyState(event, state)`** — 比對 session 裡的值，不符或不存在就 `createError({ statusCode: 400, statusMessage: '登入逾時，請再試一次' })`；相符就清掉。

  > ⚠️ 清除**必須**走 `replaceUserSession`。`setUserSession` 是 defu merge，把值設成 `undefined` 會靜默留著舊值，state 就變成可以重複使用。這個坑 `getChallenge` 已經踩過一次，註解裡有寫。

  清的時候要 `replaceUserSession(event, { ...rest, secure: { ...secure, line: undefined } })`——**`...rest` 不能省**。階段 4 綁定時發起流程的人是已登入狀態，漏掉 spread 會把 `user` 一起清掉，人就在流程中途被登出了。

### 5. `server/routes/auth/line.get.ts`（新）

放在 `server/routes/` 而不是 `server/api/`：`/api/` 前綴對一條要讓瀏覽器整頁跳轉進去的網址沒有意義，而且 callback URL 短一點好登記。

檔案結構是**自己的 handler 包住模組的 handler**：

```ts
const oauth = defineOAuthLineEventHandler({
  async onSuccess(event, { user }) {
    // 階段 1 先不登入，只證明這一圈走得完。
    // 不要回 user.userId —— 那是識別碼，沒有理由印在畫面上。
    return { ok: true, name: user.displayName }
  },
  onError(event) {
    // 模組預設丟的是英文的 401，而 OAuth 是整頁跳轉，那串字會直接被看到。
    return sendRedirect(event, '/login?error=line')
  },
})

export default defineEventHandler(async (event) => {
  const { code, state } = getQuery(event)

  // 第一段：LINE 要求 state，而模組不會自己生一個。這裡發一個、存進密封
  // session，再把瀏覽器導回同一條 route —— 這次帶著 state，模組就會轉發它。
  // 判斷要看 state 在不在，只看 code 會無限重導。
  if (!code && !state)
    return sendRedirect(event, `/auth/line?state=${await mintState(event)}`)

  // 回程：模組收到 state 之後不會比對，所以比對在這裡做。
  if (code)
    await verifyState(event, String(state ?? ''))

  return oauth(event)
})
```

`mintState` / `verifyState` 是 `server/utils/` 底下的，Nitro 會 auto-import，不用寫 import。

這一階段**先不改 [`login.vue`](../../app/pages/login.vue)**。沒有入口是刻意的：測試靠手動打網址，`?error=line` 也還不會顯示任何訊息（階段 3 才接）。

## 驗證

1. `pnpm dev`，瀏覽器打 `http://localhost:3000/auth/line`：
   - 被導到 `access.line.me` 的同意畫面（第一次會問，之後可能直接跳過）。
   - 同意後回到站上，看到 `{"ok":true,"name":"你的 LINE 名字"}`。
2. **state 真的在動**：從 LINE 回來的網址上把 `state` 的值改掉一個字元再重新載入 → 應該是 400「登入逾時，請再試一次」，不是 500，也不是成功。
3. **state 是單次的**：完整走完一次之後，把剛才成功的那個 callback 網址（含 `code` 與 `state`）再貼一次 → 應該 400。
4. **沒有無限重導**：`/auth/line` 只會經過一次自家的 302（到 `/auth/line?state=...`）就跳去 LINE。DevTools 的 Network 面板確認一下，不是一長串同網址的 302。
5. **設定缺漏的路徑**：暫時把 `.env` 裡的 `NUXT_OAUTH_LINE_CLIENT_SECRET` 清空重啟 → 模組回 `handleMissingConfiguration` 的錯誤而不是白畫面。測完記得填回去。
6. **取消同意**：在 LINE 的同意畫面按拒絕 → 回到 `/login`（沒有訊息，這一階段正常），不是英文錯誤頁。
7. `/login` 與首頁的行為**完全沒變**：passkey 兩顆按鈕照舊，匿名回報照舊。
8. `git status` 確認 `.env` 與 `.dev.vars` **沒有**被追蹤。
9. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
build: add the line login channel and its callback route
```
