# 階段 3：用 LINE 登入

> 先讀 [`00-context.md`](00-context.md)。

## 目標

`/login` 上多一個「用 LINE 登入」，按下去走完一圈回來就是登入狀態，回報開始記在名下。第二次用同一個 LINE 帳號登入要回到**同一個人**，不是又開一個新帳號。

## 前置

階段 1 與 2 完成。

## 改動

### 1. `server/utils/label.ts`（新，一小段搬移）

[`register.post.ts`](../../server/api/webauthn/register.post.ts) 裡把 `userName` 整理成 label 的那幾行（trim、收合空白、切 40 字、空的話給 `'拉麵Now 使用者'`），LINE 的 `displayName` 需要一模一樣的處理。搬成一個 `tidyLabel(raw)`，兩邊都用它，`validateUser` 就縮成一行。

**不要複製一份。** 兩個入口各切一次長度、哪天只改了其中一個，就會出現長度不一致的 label。

### 2. [`server/routes/auth/line.get.ts`](../../server/routes/auth/line.get.ts)

只有 `onSuccess` 換掉，階段 1 那層 state 的包裝原樣留著。

```ts
async onSuccess(event, { user: profile }) {
  const db = useDb(event)

  // 主鍵查詢，join 回 users 拿 label。
  const linked = await db
    .select({ id: schema.users.id, label: schema.users.label })
    .from(schema.lineAccounts)
    .innerJoin(schema.users, eq(schema.users.id, schema.lineAccounts.userId))
    .where(eq(schema.lineAccounts.id, profile.userId))
    .get()

  const person = linked ?? await createPersonFromLine(db, profile)

  await setUserSession(event, { user: { id: person.id, label: person.label } })

  return sendRedirect(event, '/me')
}
```

新建的那條路（寫成同檔案裡的一個小函式即可）：`insert users { label: tidyLabel(profile.displayName) }` 拿 `id` 與 `label`，再 `insert lineAccounts { id: profile.userId, userId: person.id }`。

三件事不要做錯：

- **已存在時不更新 `label`。** `displayName` 在 LINE 上可以隨時改，但這個 label 同時是 passkey 在作業系統選單裡的名字（階段 4 之後同一個人可能兩者都有），每次登入就跟著跳一次會對不上記憶。**只在建立時寫入。**
- **不看 session。** 這一階段一律「查得到就用、查不到就建」，跟已登入狀態無關。已登入時把 LINE 綁到現有帳號是階段 4 的事，現在混進來會讓兩種行為在同一個階段裡難以分辨。
- **`sendRedirect` 不能省。** OAuth 是整頁跳轉，回 JSON 的話使用者會停在一頁 `{...}` 上。導去 `/me` 而不是 `/`，跟 passkey 登入後的落點一致。

D1 沒有交易可用，所以「建了 user 卻沒建 line_accounts」理論上留得下一個孤兒 user：沒有任何登入方式指向它，也沒有回報掛在它身上，下次登入會再建一個新的。**不值得為它加補償邏輯**，但值得在程式碼裡一句註解說明這是知情的取捨。

### 3. [`app/pages/login.vue`](../../app/pages/login.vue)

- 加一個 LINE 入口。**必須是 `<a href="/auth/line">`**，不是 `NuxtLink`、更不是 `$fetch`——OAuth 要的是整頁離站，vue-router 攔下來就什麼都不會發生。因為它不是按鈕，`working` 那組 loading 狀態管不到它，也不需要管。

- 視覺權重：passkey 登入仍然是主要動作，LINE 排在「建立新的 Passkey」同一層。**但 `supported === false` 時 LINE 是唯一走得通的路**，那時 `statusLine` 要改口——現在寫的是「換一個瀏覽器再試試」，改成指向 LINE：

  ```
  這個瀏覽器不支援 Passkey，用 LINE 登入就好。
  ```

  這正是做這個功能的第一個理由（LINE 的 in-app browser 沒有 WebAuthn），文案要真的把人接到那條路上。

- 接住階段 1 埋的 `?error=line`：`useRoute().query.error === 'line'` 時 `notice` 給「LINE 登入沒有完成，再試一次就好。」語氣照 `CANCELLED` 那兩句——取消不是失敗。

- **`fetchSession()` 不用叫。** 整頁跳轉回來時 `/me` 是全新載入，模組的 plugin 會自己帶好 session。

### 4. 登出

**不用改。** [`/api/logout`](../../server/api/logout.post.ts) 清的是 session，跟人當初怎麼登入沒有關係。LINE 那端的登入狀態不該被這個 app 清掉——那是使用者在 LINE 的事。

## 驗證

1. **第一次登入**：登出 → `/login` 按「用 LINE 登入」→ 同意 → 回到 `/me`，`footer` 顯示「現在是『你的 LINE 名字』」。
2. **第二次是同一個人，不是新的一個**：登出再登入一次，然後
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select id, user_id from line_accounts"
   ```
   只有一列，`users` 也沒有多長出一個。這條是這一階段的重點。
3. **回報記得住**：登入後回報一次 → `/me` 的次數 +1 → 登出再登入 → 次數還在。
4. **改名不會亂**：在 LINE 上改暱稱，再登入一次 → `users.label` **不變**（照設計）。
5. **LINE in-app browser**（這是做這個功能的理由，一定要在手機上試）：把站台網址用 LINE 傳給自己，從 LINE 裡點開 → passkey 兩顆按鈕是 disabled、小字叫你用 LINE 登入 → 按下去應該不必輸入任何東西就完成（LINE 內已經是登入狀態）。
6. **取消**：同意畫面按拒絕 → 回 `/login`，看到中文的那句提示，沒有英文錯誤。
7. **匿名回報照舊**，首頁沒變。
8. 反覆登入登出三次穩定（會抓到 state 沒清乾淨、或 session merge 的殘留）。
9. `pnpm typecheck` 與 `pnpm lint` 乾淨。

要上線的話，這一階段之前先做完兩件事：`pnpm db:migrate:remote`，以及 `pnpm wrangler secret put NUXT_OAUTH_LINE_CLIENT_ID` / `..._SECRET`。正式網域的 callback URL 也要確認已經登記在 channel 裡。

## Commit

```
feat: sign in with a line account
```
