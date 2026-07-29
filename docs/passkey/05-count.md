# 階段 5：回報掛上作者與次數頁面

> 先讀 [`00-context.md`](00-context.md)。

## 目標

**這是整個功能的目的所在。** 登入狀態下回報會掛上作者，`/me` 顯示「你已經回報過 N 次」。

同時要證明匿名回報**沒有**被破壞——那是這個 app 的核心體驗，不能為了計數而犧牲。

## 前置

階段 4 完成。與階段 6、7 彼此獨立，順序可換。

## 改動

### 1. [`server/api/shops/[id]/reports.post.ts`](../../server/api/shops/[id]/reports.post.ts)

**只加兩行。** 取 session，insert 時帶上 `userId`：

```ts
const session = await getUserSession(event)
// ...
.values({ shopId, people, userId: session.user?.id ?? null })
```

`?? null` 就是「匿名回報保留」的實作：沒登入就是 `NULL`。

**驗證邏輯、錯誤訊息、回傳形狀全部不要動。** 這個端點現有的行為（400 人數範圍、404 店家不存在、回傳 `{ people, reportedAt }`）是首頁樂觀更新依賴的合約，改了會壞掉 [`index.vue`](../../app/pages/index.vue) 的 `report()`。

**不要在這裡加任何 401 分支。**

### 2. `server/api/me/reports.get.ts`（新）

```ts
const { user } = await requireUserSession(event)
```

`requireUserSession` 未登入會自己丟 401，不用手寫分支。

用 `count()`（從 `drizzle-orm` import）數 `reports` 裡 `userId` 等於這個人的列，回 `{ count: Number(row?.count ?? 0) }`。走的是階段 2 建的 `reports_user_idx`。

匿名回報的 `user_id` 是 `NULL`，`eq` 不會匹配到——所以它們自然不會被算進任何人的次數。這正是預期行為，值得一句註解，否則會被誤認為漏處理。

### 3. `app/middleware/auth.ts`（新）

```ts
export default defineNuxtRouteMiddleware(() => {
  if (!useUserSession().loggedIn.value)
    return navigateTo('/login')
})
```

### 4. `app/pages/me.vue`（新）

- `definePageMeta({ middleware: 'auth' })`
- `const { data } = await useFetch('/api/me/reports')`
- 主體是「你已經回報過 **N** 次」，數字放大成單一焦點（比首頁標題再大一些，這一頁只有這一件事）。
- **次數為 0 時換一句話**：「還沒有回報過，路過的時候按一下。」——不要給一個光禿禿的 `0`，那看起來像壞掉。
- 底部放 `label` 與「登出」（`$fetch('/api/logout', { method: 'POST' })` → `clear()` → `navigateTo('/')`），用最小的字級。階段 4 放在 `/login` 的登出入口這時可以移過來。
- 版面沿用 index.vue 的外框與字級層次：`<main class="mx-auto min-h-[100dvh] w-full max-w-[30rem] px-6 pb-24 pt-20">`、標題 `text-[22px] text-black/90`、次要說明 `text-[13px] text-black/35`。加一個回首頁的連結。

### 5. `app/pages/login.vue`

登入與註冊成功後的導向從 `/` 改成 `/me`，已登入時的重導也改成 `/me`。

## 驗證

1. **計數這條路徑**：登入狀態下回報三家店 → `/me` 顯示 3。交叉比對：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select user_id, count(*) from reports group by user_id"
   ```
2. **匿名回歸測試**（跟計數一樣重要）：登出 → 回報一家店 → **應該成功，不被擋、不被導去登入**。那一筆 `user_id` 要是 `NULL`：
   ```sh
   pnpm wrangler d1 execute ramen-now --local --command \
     "select id, people, user_id from reports order by id desc limit 1"
   ```
   然後重新登入 → `/me` 應該**還是 3**，沒把匿名那筆算進來。
3. 未登入直接開 `/me` → 導去 `/login`。
4. `curl -i http://localhost:3000/api/me/reports` → **401**，不是 500、不是 200 空資料。
5. 全新帳號（在 `/login` 建第二把 passkey 產生新使用者）看 `/me` → 顯示「還沒有回報過」那句，不是 `0`。
6. 回報後 `/me` 的數字會更新（重新進頁面即可，不需要即時同步）。
7. 首頁的回報流程完全沒變：樂觀更新、失敗回滾、`reportedAt` 淡出全部照舊。
8. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: count the reports you filed while signed in
```
