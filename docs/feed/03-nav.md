# 階段 3：導覽

> 先讀 [`00-context.md`](00-context.md)，特別是「導覽設計」那節。

## 目標

看板與食記互相到得了。這個階段只做**點擊**導覽，手勢在階段 4——先讓沒有手勢也完全可用，手勢才是附加的。

刻意獨立成一個 commit：這是唯一動到 [`index.vue`](../../app/pages/index.vue) 的改動，而首頁是這個 app 的全部。單獨一個 commit 的話，萬一版面被弄糟，revert 不會連帶拆掉食記功能（跟 [`docs/passkey/06-home-header.md`](../passkey/06-home-header.md) 同樣的理由）。

## 前置

階段 2 完成。`/feed` 必須真的存在，否則導覽會連到 404。

## 改動

### `app/utils/nav.ts`

新增（`app/utils/` 底下是 auto-import，同 [`time.ts`](../../app/utils/time.ts)）。

```ts
export const SURFACES = [
  { path: '/', label: '看板' },
  { path: '/feed', label: '食記' },
] as const

export function surfaceIndex(path: string) { /* 找不到回 -1 */ }
```

**這是「主畫面有哪些、誰在誰右邊」的唯一來源**：導覽列、轉場方向（階段 4）、手勢（階段 4）三個地方都讀它。這一句值得寫成註解——否則下一個人很自然會在 `SiteNav.vue` 裡直接寫死兩個連結，然後階段 4 再寫死一次順序，改一個忘一個。

`surfaceIndex` 回 `-1` 代表「不是主畫面」，`/login`、`/me` 都走這條。

### `app/components/SiteNav.vue`

新增。一列，左邊 `v-for` 跑 `SURFACES`，右邊是身分連結。

- active 判斷用 `useRoute().path`；目前頁 `text-black/90`，另一頁 `text-black/30`
- 兩個都是 `text-[13px] leading-5` + `transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97]`
- **不要底線、不要方框、不要背景色。** 這個 app 沒有任何框線 UI，濃淡就是狀態。
- active 的那個要有 `aria-current="page"`
- 身分連結從 `index.vue` 的 header **原樣搬過來**：`loggedIn ? '/me' : '/login'`、`loggedIn ? user?.label : '登入'`、`max-w-[7rem] shrink-0 truncate`、以及 `One tappable thing only — signing out lives on /me, not here.` 那句註解也一起搬。

### 兩頁接上

[`index.vue`](../../app/pages/index.vue) 與 `feed.vue` 的 `<main>` 內最上面各放一行 `<SiteNav />`。

`index.vue` 的 `<header>` 搬掉身分連結後只剩 h1 與副標，那層 `flex items-baseline justify-between gap-4` 與 `min-w-0` 包裝可以拿掉。**其他一行都不要動**——回報、`report()`、樂觀更新、定位排序、新增店家、`statusLine` 全部照舊。

`feed.vue` 的 header 做成同構。

## 驗證

1. `/` ↔ `/feed` 兩個方向都點得到，當前頁那個字明顯比較深。
2. 未登入時右邊是「登入」→ `/login`；登入後是 label → `/me`。**搬家不該弄丟這個行為。**
3. **`/login` 與 `/me` 不該出現導覽列。**
4. 鍵盤 Tab 順序是 看板 → 食記 → 身分，`aria-current="page"` 在對的那個上面。
5. **重新整理不閃動**：連按幾次重新整理，不該看到「登入」一閃再變成名字（`useUserSession()` 在 server 端就有值）。
6. 版面：375px 與桌機各看一遍，長 label 不該把導覽列推寬。h1 與副標的位置跟改動前一致。
7. 首頁功能全數照舊：回報、新增店家、搜尋、定位排序、90 分鐘淡出。
8. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: put the board and the write-ups side by side
```
