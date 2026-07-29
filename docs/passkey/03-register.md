# 階段 3：零輸入建立 Passkey

> 先讀 [`00-context.md`](00-context.md)。

## 目標

按一顆按鈕就能建立 passkey，**全程沒有任何輸入框**。做完之後 `users` 與 `credentials` 各多一列，而且人已經處於登入狀態。

登入還不能用（那是階段 4）。這一階段驗證的是「註冊這條路走得通、而且產出的是 discoverable credential」。

## 前置

階段 2 完成。

## 改動

### 1. `server/utils/webauthn.ts`（新）

challenge 的存取，兩個 handler 共用。放在 `server/utils/` 才會被 Nitro auto-import，跟 [`db.ts`](../../server/utils/db.ts) 同一層。

```ts
export async function storeChallenge(event: H3Event, challenge: string, attemptId: string) {
  await setUserSession(event, { secure: { webauthn: { attemptId, challenge } } })
}

export async function getChallenge(event: H3Event, attemptId: string) {
  const { secure, ...rest } = await getUserSession(event)

  if (secure?.webauthn?.attemptId !== attemptId)
    throw createError({ statusCode: 400, statusMessage: '驗證已逾時，請再試一次' })

  const { challenge } = secure.webauthn

  // 單次使用。setUserSession 是 defu merge，把值設成 undefined 清不掉，
  // 舊 challenge 會靜默留著讓重放成立 —— 一定要走 replaceUserSession。
  await replaceUserSession(event, { ...rest, secure: { ...secure, webauthn: undefined } })

  return challenge
}
```

`getUserSession` 回傳的物件含一個 `id`，而 `replaceUserSession` 的參數型別是 `OmitWithIndexSignature<UserSession, 'id'>`。展開時記得把 `id` 排掉，否則 typecheck 會抱怨。

那段註解要留著，它解釋的是一個會靜默失效的陷阱（驗證步驟 5 專門打它）。

### 2. `server/api/webauthn/register.post.ts`（新）

`defineWebAuthnRegisterEventHandler({ ... })`，`auth.webAuthn: true` 之後它是 auto-import 的。

- **`getOptions()`** — 回
  ```ts
  { authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' } }
  ```
  `residentKey: 'required'` 是整個零輸入設計的前提，值得一句註解說明少了它階段 4 就得回頭要識別碼。`userVerification: 'preferred'` 而不是 `'required'`：這是一個回報拉麵排隊的看板，不值得為了它強制每次都刷臉。

- **`validateUser(userBody)`** — `userName` 只當標籤看：trim、壓掉連續空白、限長 40 字（比照 [`shops.post.ts`](../../server/api/shops.post.ts) 的上限），空的就給一個預設值。**不做 email 驗證、不查重、不當識別碼用。**

- **`storeChallenge` / `getChallenge`** — 直接掛上步驟 1 的兩個函式。

- **`onSuccess(event, { credential, user })`** —
  1. insert 一筆 `users`（`label` 取 `user.userName`），用 `.returning({ id, label }).get()` 拿回 id。
  2. insert `credentials`：`id`、`userId`、`publicKey`（**原樣存 base64URL 字串，不要自己轉 Uint8Array**）、`counter`、`backedUp`、`transports` 用 `JSON.stringify`。
  3. `setUserSession(event, { user: { id, label } })`。

  這一階段一律建立新使用者。已登入時掛到現有帳號是階段 7 的事，現在還沒有任何入口能在已登入狀態下註冊，所以不會有問題。

  **不要寫 `excludeCredentials`**，那也是階段 7 的事。

### 3. `app/pages/login.vue`（新）

沒有輸入框，一顆按鈕。樣式照 [`index.vue`](../../app/pages/index.vue) 的語彙（見 `00-context.md`）。

```ts
const { register } = useWebAuthn({ registerEndpoint: '/api/webauthn/register' })
const { fetch: fetchSession } = useUserSession()

// 標籤只是 passkey 選單上的顯示文字，重複也不影響正確性
function randomTag() {
  const bytes = crypto.getRandomValues(new Uint8Array(2))
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

await register({ userName: `拉麵Now #${randomTag()}` })
await fetchSession()
```

註冊成功後暫時導回 `/`（`/me` 是階段 5 才有）。

三件事要處理好，否則體驗會很糙：

- **不支援的瀏覽器**：用 `browserSupportsWebAuthn()`（`@simplewebauthn/browser`）判斷，顯示「這個瀏覽器不支援 Passkey」並停用按鈕。比照 index.vue 處理 `locationSupported` 的方式——不是讓按鈕丟一個生 error。
- **使用者取消系統對話框**：會 reject。catch 成一行安靜的提示（`role="status"` 那條小字，比照 index.vue 的 `flash()`），不是紅色錯誤——取消不是失敗。
- **loading 狀態**：系統對話框開著時按鈕要停用，關掉後（不論成功或取消）一定要解除。

版面沿用 index.vue 的外框：`<main class="mx-auto min-h-[100dvh] w-full max-w-[30rem] px-6 pb-24 pt-20">`，標題 `text-[22px] leading-7 tracking-tight text-black/90`，說明 `text-[13px] leading-5 text-black/35`。一句話說明這是做什麼的（回報次數要記在誰身上），不要寫成隱私政策。

## 驗證

1. `pnpm dev` → `http://localhost:3000/login`（localhost 算 secure context，passkey 可用）。按按鈕，**整個過程不該出現任何輸入框**，作業系統直接跳 passkey 對話框。
2. 兩張表各多一列，`public_key` 看起來是 base64URL（不是 `[object Object]`、不是逗號分隔的數字），`transports` 是像 `["internal","hybrid"]` 的 JSON：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select u.id, u.label, c.id, c.counter, c.backed_up, c.transports, length(c.public_key) from users u join credentials c on c.user_id = u.id"
   ```
3. 人已登入：`document.cookie` 有 `nuxt-session`；在任一頁 console 打 `await $fetch('/api/_auth/session')` 應回含 `user.id` 與 `user.label` 的物件，**且不含 `secure`**（`secure` 不該外流到 client）。
4. **取消路徑**：再按一次按鈕、在系統對話框按取消 → 頁面顯示安靜提示、按鈕恢復可按、console 沒有未捕捉的錯誤，而且資料庫**沒有**多出半筆資料。
5. **challenge 單次使用**（對應 `00-context.md` 的 `defu` 陷阱）：開 DevTools Network，攔下 `verify: true` 那個 register 請求，把完全相同的 body 重送第二次 → 第二次應回 **400 驗證已逾時**。若第二次也成功，就是 `getChallenge` 沒清乾淨，回去看是不是誤用了 `setUserSession`。
6. 首頁完全沒受影響：回報、新增店家、定位排序照舊。
7. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: create a passkey with no fields to fill in
```
