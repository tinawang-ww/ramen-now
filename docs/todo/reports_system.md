# Reports & Notification TODOs

以下是針對排隊回報系統與通知機制的待辦事項與優化計畫：

## 📊 資料分析與計算 (Data Analysis & Processing)
- [ ] **歷史趨勢**：利用過去的 reports 資料，分析並顯示各店家的排隊趨勢（例如：繪製尖峰/離峰時間圖表）。
- [ ] **精準人數計算**：在計算並顯示「當前排隊人數」時，設計演算法過濾/排除 10 分鐘內出現的極端值（極大或極小），再進行平均計算，避免惡意或錯誤回報影響結果。
- [ ] **邊界值處理**：釐清並設計當排隊人數大於 99 人時的處理邏輯與 UI 顯示方式（例如顯示 `99+` 或做特殊標示）。

## 🗄️ 資料庫與效能 (Data Lifecycle & Optimization)
- [ ] **定期壓縮資料**：設計 reports 資料的 Life Cycle，實作定期排程（Cron Job），將過舊的歷史明細資料壓縮成統計數據或進行封存清理，避免資料庫無限制膨脹。

## 🔔 通知與整合 (Notifications & Integrations)
- [ ] **LINE 整合**：串接 LINE 相關服務（包含 LINE 登入、LINE Bot 或訊息通知等）。
- [ ] **Push 通知**：實作 Push Notifications 機制，讓使用者可以收到排隊狀態變更或其他重要推播。
