# 階段 7：一人多把 Passkey

> 先讀 [`00-context.md`](00-context.md)。

## 目標

在已登入狀態下再註冊一把 passkey（例如手機一把、筆電一把），兩把都掛到**同一個** `users.id`，回報次數不因此裂成兩份。

這一階段是 `users` 這張薄表存在的理由。沒有它，`users` 只是 `credentials` 的一個沒必要的間接層——做完這階段，那張表才真的有在做事。

多數人不會用到：passkey 通常會跟著 iCloud Keychain 或 Google Password Manager 同步，一把就夠。但一旦有人真的註冊了第二把，次數裂開是**錯的答案**，而次數是這個功能的全部重點。

## 前置

階段 5 完成（需要 `/me` 當入口，也需要次數可以驗證有沒有裂開）。

## 改動

### 1. `server/api/webauthn/register.post.ts`

`onSuccess` 目前一律 insert 一筆新 `users`。改成先看 session：

```ts
const session = await getUserSession(event)

// 已登入代表這是「同一個人在另一台裝置上再加一把」。掛到現有帳號，
// 否則兩把 passkey 會變成兩個人，回報次數跟著裂成兩份。
const userId = session.user?.id ?? (await db.insert(schema.users)...returning().get()).id
```

已登入時不要改寫 `users.label`——那是第一把 passkey 的標籤，換掉會讓選單上的名字對不上人的記憶。

### 2. `server/api/webauthn/register.post.ts` 的 `excludeCredentials`

新增這個 callback，避免**同一把 authenticator 對同一個人重複註冊**（否則同一台裝置按兩次會產生兩列 credential，指向同一把實體金鑰）。

```ts
async excludeCredentials(event) {
  // 傳進來的 userName 只是選單標籤、不是識別碼，不能用來查人 —— 改讀 session。
  const session = await getUserSession(event)
  if (!session.user)
    return []
  // 回該使用者現有的 credential id
}
```

未登入回 `[]` 是刻意的：沒有識別碼就無從得知這個人是誰，只能允許他建立一個新帳號。這也表示同一台裝置可以建立多個獨立帳號——在沒有識別碼的設計裡這是無法避免的，也不構成問題。

### 3. `app/pages/me.vue`

底部加一個小動作「在這台裝置也加一把 Passkey」，**重用同一個 `register()`**：

```ts
const { register } = useWebAuthn({ registerEndpoint: '/api/webauthn/register' })
await register({ userName: user.value.label })   // 沿用現有標籤
await fetchSession()
```

因為請求帶著 session，後端會走上面那條「掛到現有 `userId`」的分支。

- 成功後給一句安靜的確認（「已加入這台裝置」），**不要導頁**——人還在看自己的次數。
- 取消、不支援、loading 三種狀態的處理跟 `/login` 一樣。這裡的重複如果讓兩頁的程式碼開始長得一樣，就抽一個 `app/composables/usePasskey.ts` 出來；只有兩處、各三行的話不值得抽。
- 這個動作視覺權重要低（跟「登出」同一階），它是少數人才需要的東西。

## 驗證

1. **次數不裂開**（這是重點）：先記下 `/me` 的次數 N。按「在這台裝置也加一把 Passkey」→
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select count(*) from credentials; select count(*) from users"
   ```
   `credentials` **+1**，`users` **不變**。`/me` 的次數仍然是 N。
2. 兩把都掛在同一個人身上：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select user_id, count(*) from credentials group by user_id"
   ```
3. 新的那把能單獨登入：登出 → 按「用 Passkey 登入」→ 在系統選單挑**第二把** → 登入後 `/me` 的次數仍然是 N（不是 0）。這條才真正證明沒裂開。
4. 用第二把登入後回報一次 → `/me` 顯示 N+1。用第一把登入 → **也是 N+1**。
5. **`excludeCredentials` 生效**：已登入狀態下再按一次「在這台裝置也加一把」→ 作業系統應該提示這把裝置已經註冊過（各家瀏覽器措詞不同），而不是靜靜地又建立一列。若真的又多一列，是 `excludeCredentials` 沒回到正確的 id 清單。
6. **未登入註冊仍然建立新帳號**：登出 → `/login` 建一把新的 → `users` **+1**，新帳號的 `/me` 顯示「還沒有回報過」。
7. 已登入時的 `users.label` 沒被改寫。
8. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: add another passkey without splitting your count
```

## 全部做完之後

七個階段跑完，部署前還有一輪：

```sh
pnpm wrangler secret put NUXT_SESSION_PASSWORD
pnpm db:migrate:remote
pnpm deploy
```

正式網域下重跑階段 3 的驗證 1 與階段 4 的驗證 1，確認 `rpID` 自動推導在真實 domain 上正確。

**passkey 綁 domain**：localhost 註冊的那些在正式站不能用，要重新註冊一次。這是 WebAuthn 的設計，不是 bug。
