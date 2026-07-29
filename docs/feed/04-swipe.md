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
2. **不從「橫向拖曳另有意義」的元件上起手** — `(e.target as HTMLElement).closest('input, textarea, select, [contenteditable], [role="slider"]')` 有東西就放棄這一次手勢。`ShopRow` 的人數輸入框、食記表單的 `<textarea>` 選字都必須照常能用。

   **`button` 與 `a` 不在清單裡**，理由見 `00-context.md`：看板每一列都是整行寬的 button，排除它們會讓手勢在整個看板上失效；而超過 swipe 門檻的觸控本來就不會變成 click。
3. **不搶 iOS Safari 的邊緣返回** — 起點 `coordsStart.x` 在 32px 內就放棄。跟系統手勢打架永遠是我們輸。
4. **要求水平為主** — `Math.abs(lengthX) > Math.abs(lengthY) * 1.5` 才算。`direction` 內部雖然已挑主軸，但斜著滑的拇指捲動會被判成 `left`／`right`，這個倍率就是在擋那個。

方向換算：`direction === 'left'` → index `+1`，`'right'` → `-1`，其餘忽略。算出來**超出 `SURFACES` 範圍就不動**（看板往右滑、食記往左滑都原地不動）。只有兩頁，繞回會讓人以為後面還有第三頁。

到得了就 `navigateTo(SURFACES[next].path)`。

### `app/app.vue`

在 `<NuxtPage>` 外包一層 element 當手勢 target，呼叫**一次** `usePageSwipe()`。

只寫一處，非主畫面靠閘門 1 自己失效——比在兩頁各接一次少一個會忘的地方（之後多一個主畫面時也只要改 `SURFACES`）。

### `app/middleware/transition.global.ts`

新增。from 與 to **都是**主畫面時給方向性的名字，否則給 `false`：

```ts
to.meta.pageTransition = between
  ? { name: toIndex > fromIndex ? 'surface-forward' : 'surface-back', mode: 'out-in' }
  : false
```

**每次導覽都要指派，不能只在「是主畫面之間」時才寫。** route meta 掛在 route record 上，只寫不清的話，之前某次留下的名字會在下次從別的地方進同一個 route 時還在，於是套上一個它沒要求的轉場。

### `nuxt.config.ts`

**不用改。** `app.pageTransition` 不必給基底值：Nuxt 的 `<NuxtPage>` 是用
`props.transition ?? route.meta.pageTransition ?? appPageTransition` 判斷有沒有轉場（見 `nuxt/dist/pages/runtime/page.js`），meta 自己就足以開啟它，而合併用的 `_mergeTransitionProps` 是 `defu`、meta 排在 app config 前面，所以 middleware 一定贏。

不給基底值還有一個更重要的好處：**轉場只會套在兩個主畫面之間**，`/login` 與 `/me` 永遠不會被包進 `<Transition>`。

> ⚠️ **被 `<Transition>` 包住的頁面，template 必須恰好只有一個根節點。**
> 連 `<main>` 旁邊的一個 HTML 註解都算第二個根節點——Vue 會編成 fragment，`<Transition>` 就沒有單一元素可以包，結果是**換頁後整頁空白、要重新整理才看得到**。dev console 會出現 `[NUXT_E4004] ... does not have a single root node`，但正式環境不會警告。註解要寫在 `<main>` 裡面。

### `app/assets/css/main.css`

`.surface-forward-enter-from` / `-leave-to` 與 `.surface-back-enter-from` / `-leave-to` 四組，加對應的 `-enter-active` / `-leave-active`：

- `200ms var(--ease-out-strong)`
- opacity 0 ↔ 1 + **12px** `translateX`
- 前進：新頁從右邊（`+12px`）進來，舊頁往左邊（`-12px`）出去。回去反向。

為什麼是淡入淡出加小位移、而不是整頁滑移：`mode: 'out-in'` 兩頁不同時存在，所以不需要絕對定位與捲動位置的編排；而 12px + opacity 正是專案既有的 `.stagger-in` 語彙（6px + opacity），只是換到 X 軸。整頁滑移在這個排版上會需要一整套 layout 手術，換來的東西不成比例。

**兩個名字都要加進檔案裡既有的 `prefers-reduced-motion` 區塊**，照那裡的既定作法：留淡入淡出、拿掉位移。

## 驗證

手勢是 `TouchEvent`，**桌機滑鼠不會觸發**。用 DevTools 的手機模擬（device toolbar 開著才有 touch 事件）或實機。

1. **先驗最基本的：用導覽列點著換頁，內容要立刻出現。** 換頁後空白、要重新整理才看得到，就是頁面 template 有第二個根節點（見上面 `nuxt.config.ts` 那段的警告）。`/` ↔ `/feed` 來回點兩輪，每次都要看到新頁的標題與清單。
2. `/` 往左滑 → `/feed`；`/feed` 往右滑 → `/`。轉場的位移方向跟滑的方向一致（不是兩邊都往同一邊）。
3. **滑過看板的某一列要能換頁**，而且那一列**不會**被順手展開；輕點同一列則照樣展開。這兩件事要一起成立，是閘門 2 選擇清單的重點。
4. **端點不繞回**：看板往右滑、食記往左滑，**都原地不動**。
5. **閘門 2**：`ShopRow` 展開後，從**人數輸入框**上起手橫滑**不換頁**（那裡要能選字）；從 ＋／− 按鈕上起手橫滑**會**換頁，而且按鈕本身照常能按。食記表單的 `<textarea>` 裡橫向拖曳選字**不換頁**（階段 5 做完後再回來補驗這一項）。
6. **閘門 3**：從畫面左緣起手往右滑，是 Safari 的返回而**不是**換頁（實機 iOS Safari 才驗得到）。
7. **閘門 4**：上下捲動全程**不換頁**，斜著滑（明顯偏垂直）也不換頁。這是最容易漏的一項，多滑幾次。
8. **閘門 1**：`/login`、`/me` 上左右滑動**沒有任何反應**。
9. 系統開「減少動態效果」後，換頁只剩淡入淡出、**沒有位移**。
10. 連續快速滑好幾次不會卡在中間狀態，也不會堆出一串歷史紀錄讓上一頁鍵要按很多下。
11. `/` 的所有既有功能照舊：回報、新增店家、搜尋、定位排序。
12. `pnpm typecheck` 與 `pnpm lint` 乾淨。

## Commit

```
feat: swipe between the board and the write-ups
```
