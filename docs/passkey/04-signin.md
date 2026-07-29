# 階段 4：零輸入登入與登出

> 先讀 [`00-context.md`](00-context.md)。

## 目標

登出之後，只按一顆「用 Passkey 登入」就能回到登入狀態，**不輸入任何東西**。

這一階段是整個設計的試金石：如果登入需要先給識別碼，就代表階段 3 的 `residentKey: 'required'` 沒生效，discoverable credential 沒建立成功。

## 前置

階段 3 完成。

## 改動

### 1. `server/api/webauthn/authenticate.post.ts`（新）

`defineWebAuthnAuthenticateEventHandler({ ... })`。

- **不要寫 `allowCredentials`，也不要寫 `getOptions`。** 這是零輸入登入的關鍵：模組內部是 `if (allowCredentials && body.userName)`，兩者都不給就不設限制條件，瀏覽器會列出本站所有 passkey 讓人選。值得一句註解，否則下一個人看到這裡少了一個 callback 會以為是漏寫。

- **`getCredential(event, credentialId)`** — 查 `credentials` 單筆，join `users` 取 `label`。查不到就 `createError({ statusCode: 400, statusMessage: '找不到這把 Passkey' })`。

  回傳的物件**必須**有 `id`、`publicKey`（base64URL 字串，原樣給，模組自己解碼）、`counter`、`transports`（**`JSON.parse` 回陣列**——存的是 JSON 字串，原樣傳進 `verifyAuthenticationResponse` 會壞）。額外掛 `userId` 與 `label` 上去沒問題，模組會把整個物件原樣傳給 `onSuccess`。

- **`storeChallenge` / `getChallenge`** — 掛上階段 3 建的 `server/utils/webauthn.ts` 那兩個函式，不要重寫一份。

- **`onSuccess(event, { credential, authenticationInfo })`** —
  1. `update credentials set counter = authenticationInfo.newCounter where id = credential.id`。**這行別漏**，counter 是防重放的機制。
  2. `setUserSession(event, { user: { id: credential.userId, label: credential.label } })`。

### 2. `server/api/logout.post.ts`（新）

`clearUserSession(event)`，回一個空物件或 `{ ok: true }`。

### 3. `app/pages/login.vue`

加第二顆按鈕「用 Passkey 登入」，**零參數**呼叫：

```ts
const { register, authenticate } = useWebAuthn({
  registerEndpoint: '/api/webauthn/register',
  authenticateEndpoint: '/api/webauthn/authenticate',
})

await authenticate()   // 不帶參數，瀏覽器列出本站所有 passkey
await fetchSession()
```

版面上「用 Passkey 登入」是主要動作、「建立新的 Passkey」是次要動作（多數人是回訪），視覺權重照這個順序安排。取消、不支援、loading 三種狀態的處理跟階段 3 一樣，兩顆按鈕共用同一套。

已登入的人開 `/login` 沒意義——加一個 `if (loggedIn.value) return navigateTo('/')`（階段 5 之後改導向 `/me`）。

登出的入口這一階段先放在 `/login` 頁上就好（已登入時顯示），`/me` 是階段 5 才有。`$fetch('/api/logout', { method: 'POST' })` → `clear()`。

## 驗證

1. **零輸入登入**（這是重點）：登出 → `/login` 按「用 Passkey 登入」→ **不輸入任何東西**就該成功。這條通了才代表 `residentKey: 'required'` 有生效。
2. counter 有更新：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select id, counter from credentials"
   ```
   跟階段 3 記下的值比對。**部分驗證器固定回 0，counter 不變不算失敗**——重點是登入本身通過、而且這個欄位確實被寫入路徑碰到了（可以先手動把 counter 改成 5，登入後看它是否被改回驗證器給的值）。
3. 登出真的清乾淨：按登出 → `document.cookie` 的 `nuxt-session` 消失或失效 → `await $fetch('/api/_auth/session')` 不再含 `user`。
4. 取消登入對話框 → 安靜提示、按鈕恢復、沒有未捕捉錯誤。
5. **找不到憑證的路徑**：手動刪掉 `credentials` 那一列（`delete from credentials`）後再按登入 → 應回 400「找不到這把 Passkey」，不是 500。刪完記得重新註冊一把再繼續。
6. 反覆登入登出三次都穩定（會抓到 challenge 沒清乾淨、或 session merge 造成的殘留狀態）。
7. 已登入時開 `/login` → 被導走。
8. 首頁照舊，匿名回報仍然可用。
9. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: sign in with a passkey and nothing else
```
