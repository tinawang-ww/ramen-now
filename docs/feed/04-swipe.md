# 階段 4：左右滑動換頁

> 先讀 [`00-context.md`](00-context.md)，特別是「手勢」那節與 `useSwipe` 的已驗證事實表。

## 目標

在 `/` 與 `/feed` 上左右滑動換頁，轉場方向跟著滑的方向。

這一階段的難處不是「偵測滑動」——那是 `useSwipe` 一行。難處是**四個閘門**：少任何一個，這個手勢就會從貼心變成惱人。所以驗證清單比改動清單長，那是刻意的。

## 前置

階段 3 完成（需要 `SURFACES` 與兩個真的存在的主畫面）。

## 改動

### `app/composables/usePageSwipe.ts`

新增，寫法照 [`useUserLocation.ts`](../../app/composables/useUserLocation.ts)：一般的 `export function`、SSR 安全（不在模組層碰 `window`）。

`useSwipe(target, { threshold: 60, onSwipeStart, onSwipeEnd })`：

- `threshold: 60`（預設 50 略嫌敏感，60 大約是拇指一個明確的橫掃）
- **`passive` 不要動**，保持預設的 `true`。不阻擋原生捲動比手勢跟手重要；代價是放開手指才切換，這是已知且接受的取捨（見 `00-context.md`）。

四個閘門，`onSwipeStart` 兩個、`onSwipeEnd` 兩個：

1. **只在主畫面上生效** — `surfaceIndex(route.path) < 0` 直接 return。`/login`、`/me` 因此完全不受影響。
2. **不從互動元件上起手** — `(e.target as HTMLElement).closest('input, textarea, button, a, [role="button"]')` 有東西就放棄這一次手勢。`ShopRow` 的 ＋／− 步進器、食記表單的 `<textarea>` 選字都必須照常能用。
3. **不搶 iOS Safari 的邊緣返回** — 起點 `coordsStart.x` 在 32px 內就放棄。跟系統手勢打架永遠是我們輸。
4. **要求水平為主** — `Math.abs(lengthX) > Math.abs(lengthY) * 1.5` 才算。`direction` 內部雖然已挑主軸，但斜著滑的拇指捲動會被判成 `left`／`right`，這個倍率就是在擋那個。

方向換算：`direction === 'left'` → index `+1`，`'right'` → `-1`，其餘忽略。算出來**超出 `SURFACES` 範圍就不動**（看板往右滑、食記往左滑都原地不動）。只有兩頁，繞回會讓人以為後面還有第三頁。

到得了就 `navigateTo(SURFACES[next].path)`。

### `app/app.vue`

在 `<NuxtPage>` 外包一層 element 當手勢 target，呼叫**一次** `usePageSwipe()`。

只寫一處，非主畫面靠閘門 1 自己失效——比在兩頁各接一次少一個會忘的地方（之後多一個主畫面時也只要改 `SURFACES`）。

### `app/middleware/transition.global.ts`

新增。from 與 to **都是**主畫面時：

```ts
to.meta.pageTransition = {
  name: surfaceIndex(to.path) > surfaceIndex(from.path) ? 'surface-forward' : 'surface-back',
  mode: 'out-in',
}
```

其餘情況（進出 `/login`、`/me`、首次載入）**不要碰** `to.meta`，維持原本行為。

### `nuxt.config.ts`

`app.pageTransition` 給一個基底值——Nuxt 預設是關的，完全不設時 middleware 塞的 meta 可能不生效。

> **實作時先確認 middleware 設的 meta 真的蓋掉基底**，不要假設。做法：兩個名字給不同的位移方向，來回滑各一次，看位移方向會不會跟著變。若基底贏了，兩個方向會長得一樣。

### `app/assets/css/main.css`

`.surface-forward-enter-from` / `-leave-to` 與 `.surface-back-enter-from` / `-leave-to` 四組，加對應的 `-enter-active` / `-leave-active`：

- `200ms var(--ease-out-strong)`
- opacity 0 ↔ 1 + **12px** `translateX`
- 前進：新頁從右邊（`+12px`）進來，舊頁往左邊（`-12px`）出去。回去反向。

為什麼是淡入淡出加小位移、而不是整頁滑移：`mode: 'out-in'` 兩頁不同時存在，所以不需要絕對定位與捲動位置的編排；而 12px + opacity 正是專案既有的 `.stagger-in` 語彙（6px + opacity），只是換到 X 軸。整頁滑移在這個排版上會需要一整套 layout 手術，換來的東西不成比例。

**兩個名字都要加進檔案裡既有的 `prefers-reduced-motion` 區塊**，照那裡的既定作法：留淡入淡出、拿掉位移。

## 驗證

手勢是 `TouchEvent`，**桌機滑鼠不會觸發**。用 DevTools 的手機模擬（device toolbar 開著才有 touch 事件）或實機。

1. `/` 往左滑 → `/feed`；`/feed` 往右滑 → `/`。轉場的位移方向跟滑的方向一致（不是兩邊都往同一邊）。
2. **端點不繞回**：看板往右滑、食記往左滑，**都原地不動**。
3. **閘門 2**：`ShopRow` 展開後，從 ＋／− 上起手橫滑**不換頁**，而且步進器照常能按、能打字。食記表單的 `<textarea>` 裡橫向拖曳選字**不換頁**（階段 5 做完後再回來補驗這一項）。
4. **閘門 3**：從畫面左緣起手往右滑，是 Safari 的返回而**不是**換頁（實機 iOS Safari 才驗得到）。
5. **閘門 4**：上下捲動全程**不換頁**，斜著滑（明顯偏垂直）也不換頁。這是最容易漏的一項，多滑幾次。
6. **閘門 1**：`/login`、`/me` 上左右滑動**沒有任何反應**。
7. 系統開「減少動態效果」後，換頁只剩淡入淡出、**沒有位移**。
8. 連續快速滑好幾次不會卡在中間狀態，也不會堆出一串歷史紀錄讓上一頁鍵要按很多下。
9. `/` 的所有既有功能照舊：回報、新增店家、搜尋、定位排序。
10. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: swipe between the board and the write-ups
```
