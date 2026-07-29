# 階段 1：依賴與模組設定

> 先讀 [`00-context.md`](00-context.md)。

## 目標

把 `nuxt-auth-utils` 裝好、WebAuthn 開起來、session 密鑰就位。**這個階段不新增任何使用者可見的功能**——成功的定義是「app 跟原來一模一樣地跑，但 `useUserSession()` 已經可用」。

先獨立成一個階段，是因為它是唯一會動到依賴樹與 build 設定的一步。混在功能裡的話，一旦 build 壞掉就分不清是模組沒裝好還是程式碼寫錯。

## 前置

無。這是第一階段。

## 改動

### 1. 安裝依賴

```sh
pnpm add nuxt-auth-utils @simplewebauthn/server@11 @simplewebauthn/browser@11
```

**版本必須鎖 v11**，理由見 `00-context.md` 的模組事實表。裝完確認 `package.json` 的 `dependencies` 三個都在，且 `pnpm install` 不吐 peer warning。

### 2. `nuxt.config.ts`

- `modules` 陣列加入 `'nuxt-auth-utils'`
- 加一個 top-level 的 `auth: { webAuthn: true }`

`runtimeConfig.webauthn` 不要填（見 `00-context.md`）。

### 3. Session 密鑰

`NUXT_SESSION_PASSWORD`，至少 32 字元。三個地方要對上：

| 用途 | 位置 |
| --- | --- |
| `pnpm dev` | `.env` |
| `pnpm preview`（wrangler dev） | `.dev.vars` |
| 正式站 | `pnpm wrangler secret put NUXT_SESSION_PASSWORD` |

產生一把：`openssl rand -base64 32`

`.gitignore` 已經放行 `.env.example` 與 `.dev.vars.example`（但兩個檔案現在都不存在），兩個範例檔都補上，內容是佔位字串而不是真的密鑰：

```
NUXT_SESSION_PASSWORD=請換成 32 字元以上的隨機字串（openssl rand -base64 32）
```

### 4. 型別擴充

新增 `server/types/auth.d.ts`：

```ts
declare module '#auth-utils' {
  interface User {
    id: number
    label: string
  }
  interface SecureSessionData {
    webauthn?: { attemptId: string, challenge: string }
  }
}

export {}
```

`SecureSessionData` 是階段 3 存 challenge 用的，現在先把型別備好，免得階段 3 又回頭改這個檔案。

### 5. README

[`README.md`](../../README.md) 的 Development 段落現在少一步：沒有 `NUXT_SESSION_PASSWORD` 的話 `pnpm dev` 起來後一碰到 session 就會炸。在 `pnpm install` 與 `pnpm db:migrate` 之間補一行複製 `.env.example` 的指示。Deployment 段落補上 `wrangler secret put`。

維持 README 現有的簡潔語氣，不要寫成教學。

## 驗證

1. `pnpm dev` 起得來，首頁一切照舊：店家列表、回報、新增店家、定位排序全部正常。**這一階段最重要的驗證是「什麼都沒壞」。**
2. `pnpm typecheck` 與 `pnpm lint` 乾淨。
3. 確認模組真的載入了：暫時在 `app/pages/index.vue` 的 `<script setup>` 裡加一行 `console.log(useUserSession().loggedIn.value)`，瀏覽器 console 應印出 `false`（不是 `undefined`、不是 auto-import 失敗的紅字）。**驗證完把這行刪掉再 commit。**
4. `git status` 確認 `.env` 與 `.dev.vars` 沒有被追蹤（`.gitignore` 應該已經擋住），只有 `.env.example` 與 `.dev.vars.example` 進版控。

## Commit

```
build: add nuxt-auth-utils with webauthn enabled
```
