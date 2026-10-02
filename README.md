# AI Vehicle Inspection

共享汽車智慧車況檢測系統 · 2026 AI Hackathon 前端 MVP

## Project Overview

嵌入共享汽車還車流程的 mobile-first 外觀檢查模組，主要尺寸為 390 × 844。以繁體中文提供掃描指引、疑似異常補拍與檢查摘要。此專案沒有實際 AI 模型，也不判定責任。

## Problem

逐張手動拍攝容易產生模糊、角度不正確、車身入鏡不完整與漏拍；營運團隊需要人工比對大量還車照片。

## Proposed Solution

使用者沿車輛走一圈，介面提示距離與影像品質，未來由模型自動擷取關鍵影格並比對租車前後影像。疑似異常以中性措辭提示，交由人工確認。

## Demo Flow

`/return → /scan-guide → /scan → /analyzing → /damage → /result`

1. 開始模擬掃描，進度在約 8 秒內完成。
2. 車頭、左側、車尾、右側每段約 2 秒，指引隨進度切換；100% 顯示「車輛掃描完成」，停留約 800 ms 後進入分析。
3. 分析約 4 秒，輪詢 Mock API 取得結果；無異常（`no_damage`）直接進入結果，預設為 `potential_damage`。
4. 預設發現左前車門疑似刮痕；按「前往補拍」開啟模擬拍攝對話框；0.6 秒後顯示「補拍完成」，再停留 1 秒後自動顯示結果。可取消補拍。
5. 比較租車前、還車時與 AI Mask 示意影像，點擊車損標記會選取對應卡片。「完成還車」顯示完成狀態；「查看完整檢測報告」前往 `/dashboard`。
6. 在掃描頁展開 Demo Controls，可模擬六種品質狀態、疑似異常、無異常、覆蓋不足與網路不佳提示。無異常直接進入結果；覆蓋不足以 Unknown 顯示，不阻擋完成。

直接進入需要檢查資料的路由，或重新整理後，會提示重新掃描。Context 與 Mock session 只存在記憶體，不保存照片或個資。

## Architecture

```text
Frontend (App Router + InspectionContext)
    ↓ InspectionApi interface
Mock API / REST adapter
    ↓ Future integration
AI Damage Detection Model
```

Next.js 16.3.8、React 19.3、TypeScript、Tailwind CSS 4、Lucide React、Framer Motion。共用 CSS token 統一白底、紅色主色、綠色完成狀態、琥珀警告與元件尺寸。支援鍵盤焦點與 reduced-motion。

## Current Status

Frontend MVP，AI backend currently mocked。沿用既有 `/return` 設計，沒有重建專案。

## Current MVP

所有 AI 回應、時間、車損、信心度、攝影機與績效數值均為 **MOCK / DEMO DATA**。SVG 圖片不是實際車損證據。分析顯示 18 張關鍵影格、報告記錄 16 張有效影格；8 秒是展示掃描時間，27.4 秒為模擬報告數據。

網路不佳僅模擬 UI 提示，**尚未實作 IndexedDB 離線暫存與重傳**。完成還車只改變本機 Demo 狀態，不會操作真實租車帳號。此為可建置的前端 MVP，正式部署仍需端到端後端整合與真實資料驗證。

## Future Integration

- Camera: 在 `components/scan/scan-components.tsx` 以 `RealCameraPreview` 取代 `MockCameraPreview`，遵守 `CameraPreviewProps`。使用 `navigator.mediaDevices.getUserMedia()`，需要 HTTPS 或 localhost；處理權限拒絕、切換後鏡頭及卸載時停止 tracks。掃描 hook 目前在離開頁面時清除 timer，避免完成後誤跳轉；真實影格擷取應放在這一層。
- AI backend: 實作 REST API 後，在 `.env.local` 設定 `NEXT_PUBLIC_INSPECTION_MODE=rest` 及 API base URL。UI 共用 `InspectionApi`，不需要改寫視覺元件。先確認回應 schema、認證、CORS、錯誤格式、影格 metadata 與上傳策略；目前 mock 影格為文字 Blob，正式串接須更換為真實 JPEG。
- 3D visualization: 替換 `VehicleDamageMap` 為 Three.js / React Three Fiber；保留部位、車損位置與選取車損 props。目前側視示意圖只校準了左前車門標記，其他部位需與模型位置一起擴充。
- Reliability: 加入 IndexedDB frame queue、重試、session 恢復及後端責任審查流程。

## Local Development

Node.js 20.9+（本次使用 Node.js 26）。

```bash
npm install
npm run dev
```

開啟 http://localhost:3000 。預設不需要 `.env`、攝影機權限或後端。

```bash
npm run lint
npm run typecheck
npm run build
npm start
npm run format
```

## Routes

| Route         | Purpose                                      |
| ------------- | -------------------------------------------- |
| `/`           | Hackathon Demo 首頁                          |
| `/return`     | 還車入口與車輛資訊                           |
| `/scan-guide` | 掃描前指引                                   |
| `/scan`       | 模擬攝影機、掃描驗證、覆蓋率與 Demo Controls |
| `/analyzing`  | API 輪詢、分析進度、失敗重試                 |
| `/damage`     | 中性疑似異常提示及模擬補拍                   |
| `/result`     | 摘要、影像比較、報告、完成還車               |
| `/dashboard`  | 模擬 KPI、圖表與可篩選實驗表格               |

## Project Structure

```text
app/                 # 8 routes, layout, globals, error, not-found
components/
  app-shell/         # MobileAppShell, AppHeader; immersive scan variant
  ui/                # Button, Action, Card, Disclaimer, DemoLabel
  vehicle/           # VehicleIllustration, VehicleCard, VehicleDamageMap
  scan/              # camera, bounding box, validation, progress, coverage, DemoControls, useDemoScan
  inspection/        # context, analysis, damage card, ImageComparison, RecaptureDialog, summary
  dashboard/         # MetricCard, PerformanceBar, ExperimentTable
lib/
  api.ts             # replaceable Promise-based mock / REST API
  mock-data.ts       # explicitly marked demo values
 types/inspection.ts # domain and API contracts
public/mock/         # before, after, mask SVG placeholders
```

## API Contract

`types/inspection.ts` 定義 DamageType、VehiclePart、DamageDetection、InspectionResult、InspectionStatus、KeyFrame、Scenario 與 InspectionApi。

| Method                        | REST endpoint                      | Response               |
| ----------------------------- | ---------------------------------- | ---------------------- |
| `startInspection(scenario)`   | POST `/api/inspection`             | `{ inspectionId }`     |
| `uploadKeyFrames(id, frames)` | POST `/api/inspection/{id}/frames` | `{ accepted }`         |
| `getInspectionStatus(id)`     | GET `/api/inspection/{id}`         | `{ status, progress }` |
| `getInspectionResult(id)`     | GET `/api/inspection/{id}/result`  | `InspectionResult`     |

coverage/confidence 使用 0–1，progress 使用 0–100；duration/processingTime 使用秒。上傳 adapter 以 FormData 傳送 `frames` 與對應 `metadata`。API methods 拋出 Error，由頁面顯示重試。Mock session 使用記憶體 Map。`lib/mock-data.ts` 的 `mockConfig` 集中設定 8 秒掃描、800 ms 完成提示、4 秒分析與補拍時序；`mockVehicle`、`mockResult`、metrics、accuracy 和 experiments 均為共用模擬資料。`ScanState` 為 `good / too_close / too_far / blurry / too_fast / too_dark`，`Scenario` 為 `potential_damage / no_damage / incomplete`。

```json
{
  "inspectionId": "demo_2026",
  "vehicleId": "RAC-2026",
  "coverage": 0.96,
  "scanDuration": 27.4,
  "processingTime": 2.84,
  "keyFrameCount": 16,
  "damages": [
    {
      "id": "damage_001",
      "part": "left_front_door",
      "type": "scratch",
      "confidence": 0.91,
      "isPotentialNewDamage": true,
      "beforeImage": "/mock/before.svg",
      "afterImage": "/mock/after.svg",
      "maskImage": "/mock/mask.svg"
    }
  ]
}
```

## Hackathon Notes

Dashboard 的 94.2% accuracy、2.8 秒 detection、28.6 秒完整檢查、96% coverage、各類別辨識率及 3D 列印實驗表格均為 **MOCK DATA，非實際測量**。63% time reduction 僅為示範數值的四捨五入結果。展示時請明確說明模型尚未整合，數字須待團隊提供實際實驗結果後替換。

AI 僅協助篩選疑似異常，不直接作為責任判定依據。

## GitHub

環境沒有 GitHub CLI，專案可由本機推送：

```bash
git remote add origin <repository-url>
git branch -M main
git push -u origin main
```
