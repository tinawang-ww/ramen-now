# 階段 4：綁 LINE 而次數不裂開

> 先讀 [`00-context.md`](00-context.md)。

## 目標

已經用 passkey 登入的人，在 `/me` 按一下就能把 LINE 帳號綁到**現有帳號**上。之後用哪一邊登入都是同一個人、同一個回報次數。

這一階段是 LINE 登入的試金石，理由跟 [passkey 階段 7](../passkey/07-multi-passkey.md) 一樣：次數是登入的全部重點，裂成兩份就是錯的。

## 前置

階段 3 完成。

## 改動

### 1. [`server/routes/auth/line.get.ts`](../../server/routes/auth/line.get.ts)

`onSuccess` 開頭多讀一次 session，分成三條路。**已登入時不要建新的 `users`。**

```ts
const session = await getUserSession(event)
```

| 狀態 | 動作 |
| --- | --- |
| 未登入 | 階段 3 的行為，原樣不動：查得到就登入、查不到就建人 |
| 已登入，這個 LINE 帳號還沒被綁 | `insert lineAccounts { id: profile.userId, userId: session.user.id }` → 導回 `/me?line=linked` |
| 已登入，這個 LINE 帳號已經綁在**同一個** `users.id` | 什麼都不做 → 導回 `/me?line=linked`。重複按不該是錯誤 |
| 已登入，這個 LINE 帳號綁在**別人**身上 | **不搬移**，導回 `/me?error=line-taken` |

最後那條是唯一需要想一下的：把它默默改指到現在這個人身上，等於讓另一個帳號無聲失去唯一的登入方式（如果他沒有 passkey，就永遠進不來了）。所以拒絕、說清楚，讓人自己決定。

已登入時 `session.user.label` **不動**，理由跟階段 3 一樣：那是他 passkey 在系統選單裡的名字。

> ⚠️ 這一階段依賴 [`verifyState`](../../server/utils/line.ts) 清 state 時有寫 `{ ...rest, secure: ... }`。漏掉那個 spread 的話，`replaceUserSession` 會把 `user` 一起清掉——`onSuccess` 讀到的 session 就是空的，於是走進「未登入」那條路、建出第二個人，次數當場裂開。這就是階段 1 那句註解在防的事。

### 2. `server/api/me/line.get.ts`（新）

`requireUserSession` 之後回 `{ linked: boolean }`——`select 1 from line_accounts where user_id = ?`，比照 [`me/reports.get.ts`](../../server/api/me/reports.get.ts) 的寫法。這是階段 2 那個 `line_accounts_user_idx` 唯一的用途。

### 3. [`app/pages/me.vue`](../../app/pages/me.vue)

`footer` 那排（登出、加 passkey）**再加一個**，權重相同：

- 沒綁：`<a href="/auth/line">綁定 LINE 帳號</a>`。**必須是 `<a>`**，理由跟階段 3 一樣。
- 已綁：一段不能按的 `<span>「已綁定 LINE」`，跟「現在是『某某』」同樣的 `text-black/25`。這裡刻意沒有「解除綁定」，見下。

接兩個 query：`line=linked` → 「LINE 帳號已經綁好，下次可以從 LINE 登入。」；`error=line-taken` → 「這個 LINE 帳號已經綁在另一個帳號上。」都走現有那行 `role="status"` 的 `notice`，不要新開一個訊息區。

`useFetch('/api/me/line')` 拿 `linked`。導回來是整頁載入，所以不必手動 refresh。

### 4. 反方向不用做

LINE 登入的人想加 passkey，`/me` 上那顆「在這台裝置也加一把 Passkey」**現在就能用**——[`register.post.ts`](../../server/api/webauthn/register.post.ts) 的 `onSuccess` 是 `session.user ?? 建新的`，已登入就會掛到現有帳號上，`excludeCredentials` 查不到列也只是回空陣列。這一階段不要碰那支 handler。

### 為什麼不做「解除綁定」

如果 LINE 是他唯一的登入方式，解除就是把自己鎖在門外。要做對就得先問「你還有別的方式嗎」、再分支、再想清楚只剩一種方式時要不要擋——三段邏輯換一個沒有人提出過的需求。刪帳號本來就不在這個 app 的範圍內，解除綁定跟著一起不做。

## 驗證

1. **核心那條**：用 passkey 登入 → 回報 3 次（`/me` 顯示 3）→ 按「綁定 LINE 帳號」→ 回到 `/me` 看到提示、狀態變成「已綁定 LINE」→ **登出** → 從 `/login` 用 LINE 登入 → **次數還是 3、名字還是原來的 label**。任何一項不符就是裂開了。
2. 資料庫只長出一列，`users` 沒有變多：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select (select count(*) from users) as users, (select count(*) from line_accounts) as line"
   ```
3. **重複綁不算錯**：已綁的狀態下手動打 `/auth/line` → 回 `/me?line=linked`，不是錯誤，`line_accounts` 也沒有第二列。
4. **綁在別人身上的路徑**（手動造）：先用 passkey 註冊第二個帳號拿到它的 `users.id`，把自己那列改指過去——
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "update line_accounts set user_id = <另一個 id>"
   ```
   然後用第一個帳號登入並按綁定 → 應該看到「已經綁在另一個帳號上」，而且 `line_accounts` **沒有被改動**。測完把資料還原。
5. **反方向**：用 LINE 登入 → `/me` 按「在這台裝置也加一把 Passkey」→ 登出 → 用 passkey 零輸入登入 → 同一個人、同一個次數。
6. 未登入走 `/auth/line` 仍然是階段 3 的行為（查得到就登入、查不到就建人）。
7. `/me` 沒綁定時**不該**出現「已綁定 LINE」，反之亦然（`useFetch` 的 `data` 還沒回來時不要閃錯的那一個——初始值當成「未知」處理，比照 `supported` 用 `null` 的做法）。
8. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: link a line account without splitting your count
```
