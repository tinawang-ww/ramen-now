# 階段 6：首頁登入狀態

> 先讀 [`00-context.md`](00-context.md)。

## 目標

首頁能看出自己有沒有登入、並且進得去 `/me`。在這之前 `/login` 與 `/me` 沒有任何入口，只能手打網址。

這是最小的一個階段，刻意獨立成一個 commit：它是唯一動到首頁的改動，而首頁是這個 app 的全部。單獨一個 commit 的話，萬一版面被弄糟了，revert 不會連帶拆掉計數功能。

## 前置

階段 4 完成（顯示登入狀態需要 session）。若階段 5 也做完了，已登入時就連到 `/me`；否則先連到 `/login`。

## 改動

只改 [`app/pages/index.vue`](../../app/pages/index.vue)。

在 `<header>` 區塊加一行極小的登入狀態：

- **未登入**：`登入`，連到 `/login`
- **已登入**：`label`，連到 `/me`

用 `const { loggedIn, user } = useUserSession()`。

設計上的約束，別踩過去：

- **只有一個可點的東西。** 登出收在 `/me`，首頁不放——那一行變成兩個按鈕就開始像個工具列了，這個 app 的整個賣點是首頁上什麼都沒有。
- 字級與顏色用最輕的一階（`text-[11px]` 或 `text-[13px]`、`text-black/30` 上下），它不該跟 `現在排幾人` 這個標題搶。
- 沿用現有的 transition 語彙：`transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97] hover-fine:hover:text-black/60`。
- **首頁維持 SSR 不閃動。** `useUserSession()` 在 server 端就有值，所以不該出現「先顯示登入、再跳成名字」的閃爍。若真的看到閃動，是取值方式有問題，不要用 `v-if="mounted"` 之類的手段蓋掉它。

`index.vue` 的其他部分**一行都不要動**——回報、`report()`、樂觀更新、定位排序、新增店家、`statusLine` 全部照舊。

## 驗證

1. 未登入看首頁 → 右上（或 header 內選定的位置）顯示「登入」，點了到 `/login`。
2. 登入後回首頁 → 顯示 `label`，點了到 `/me`。
3. **重新整理不閃動**：連按幾次重新整理，不該看到「登入」一閃而過再變成名字。用 `view-source:` 或 DevTools 看初始 HTML，登入狀態應該已經在 server 回傳的 HTML 裡。
4. 版面沒被擠壞：手機寬度（375px）與桌機寬度都看一遍，標題與說明文字的位置跟改動前一致。長 `label` 不該把版面推寬——必要時 `truncate`。
5. 首頁功能全數照舊：回報、新增店家、搜尋、定位排序、90 分鐘淡出。
6. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: show who you are on the board
```
