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
3. 上傳與分析合計約 4 秒，輪詢 Mock API 取得結果；無異常（`no_damage`）直接進入結果，預設為 `potential_damage`。
4. 預設發現左前車門疑似刮痕；按「前往補拍」開啟模擬拍攝對話框；0.6 秒後顯示「補拍完成」，再停留 1 秒後自動顯示結果。可取消補拍。
5. 比較租車前、還車時與 AI Mask 示意影像，點擊車損標記會選取對應卡片。「完成還車」顯示完成狀態；「查看完整檢測報告」前往 `/dashboard`。
6. 在掃描頁展開 Demo Controls，可模擬六種品質狀態、疑似異常、無異常、覆蓋不足與網路不佳提示。無異常直接進入結果；覆蓋不足以 Unknown 顯示，不阻擋完成。

直接進入需要檢查資料的路由，或重新整理後，會提示重新掃描。Context 與 Mock session 只存在記憶體，不保存照片或個資。

## Architecture

```text
Frontend (App Router + InspectionContext)
    ↓ Inspection Service
Mock / HTTP InspectionApi Adapter
    ↓ /api/v1/inspections (API mode only)
AI Backend (future)
```

Next.js 16.3.8、React 19.3、TypeScript、Tailwind CSS 4、Lucide React、Framer Motion。共用 CSS token 統一白底、紅色主色、綠色完成狀態、琥珀警告與元件尺寸。支援鍵盤焦點與 reduced-motion。

## Current Status

Frontend MVP，AI backend currently mocked。沿用既有 `/return` 設計，沒有重建專案。

## Current MVP

所有 AI 回應、時間、車損、信心度、攝影機與績效數值均為 **MOCK / DEMO DATA**。SVG 圖片不是實際車損證據。掃描產生並上傳 16 張模擬影格，分析與報告顯示同一批影格數量；8 秒是展示掃描時間，27.4 秒為模擬報告數據。

網路不佳僅模擬 UI 提示，**尚未實作 IndexedDB 離線暫存與重傳**。完成還車只改變本機 Demo 狀態，不會操作真實租車帳號。此為可建置的前端 MVP，正式部署仍需端到端後端整合與真實資料驗證。

## Future Integration

- Camera：`components/camera/CameraPreview.tsx` 保留既有 MockCameraPreview 視覺，提供 scanActive / onFrameCapture。`RealCameraPreview.tsx` 目前停用，已註明 getUserMedia、後鏡頭、權限與 track cleanup TODO，沒有啟用攝影機。
- Frames：`types/frame.ts` 定義 CapturedFrame；mock 不含 Blob。`lib/frame-selection.ts` 依時間均勻選取最多 16 張，未來可擴充清晰度、覆蓋率、視角、差異與曝光排名。HTTP adapter 必須取得實際 JPEG/PNG 才能上傳。
- AI：UI 只透過 `services/inspection-service.ts` 操作。詳見 [API contract](docs/API_CONTRACT.md) 與 [AI team quick guide](docs/AI_INTEGRATION_GUIDE.md)。未新增 AI 模型、Python 套件或 3D 引擎。
- 車輛資料與車損資訊從共用型別、資料、service 與 context 取得。Unknown 漏掃區域獨立於 no_damage；車損類型、部位與影像 URL 皆由結果提供。車體示意圖目前只校準左前車門定位，其他部位仍需擴充。

## Mock / API mode

`.env.example`：

```dotenv
NEXT_PUBLIC_USE_MOCK_AI=true
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

預設或 true 使用 Mock；只有明確設定 false 才使用 HTTP adapter。複製到 `.env.local` 後重啟 dev server，production 需重新 build。NEXT_PUBLIC 變數會公開，不可保存 API 密鑰。Mock create 延遲 300 ms、upload 500 ms、processing 約 3 秒，無需後端。

HTTP adapter 提供 15 秒 request timeout、回應 JSON/schema 驗證與繁體中文安全錯誤。分析頁先上傳 → complete → 輪詢（API 每約 1 秒，最長等待 120 秒）→ 取得結果，再按 detectionStatus 導頁。失敗後本頁保留影格供重試，service 共用成功或進行中的上傳與 complete，避免 Strict Mode 或重試重複提交；重新整理會清除記憶體。

開發環境提供可摺疊 API Debug：session ID、MOCK/API、status、frame count、coverage、processing status、raw result JSON。AI Result scenario 選項也僅在 development 顯示，production 不顯示除錯面板。

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
npm test
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
app/                   # existing routes, layout, globals
components/camera/     # default mock wrapper, disabled real camera placeholder
components/dev/        # development-only ApiDebugPanel
components/inspection/ # shared context, analysis, result, comparison, recapture
components/scan/       # original scan UI and simulation hook
components/vehicle/    # shared vehicle data and illustration
services/              # service, mock/HTTP adapters, errors, response validation
lib/                   # shared demo data, labels, frame selection
types/                # inspection and CapturedFrame contracts
tests/                # Node built-in contract/adapter tests; no test dependencies
docs/                 # API contract and practical AI integration guide
public/mock/           # SVG placeholders, never real damage evidence
```

## API Contract

| Service function       | Endpoint                                 |
| ---------------------- | ---------------------------------------- |
| createInspection       | POST `/api/v1/inspections`               |
| uploadInspectionFrames | POST `/api/v1/inspections/{id}/frames`   |
| completeInspection     | POST `/api/v1/inspections/{id}/complete` |
| getInspectionStatus    | GET `/api/v1/inspections/{id}`           |
| getInspectionResult    | GET `/api/v1/inspections/{id}/result`    |

InspectionStatus：idle / scanning / uploading / processing / completed / failed。Result 提供 vehicle、detectionStatus、coverage、scanDurationSeconds、processingTimeSeconds、keyFrameCount、missingAreas、damages 與 createdAt。詳細 request/response JSON、multipart 欄位、enum 與 HTTP codes 見 [docs/API_CONTRACT.md](docs/API_CONTRACT.md)。

無車損直接前往 `/result`，顯示「未偵測到明顯新增車損」，不顯示 DamageCard。missingAreas 顯示「部分區域未完整掃描 · Unknown」與部位名稱；若同時 no_damage，會註明無車損結論只適用已充分掃描區域。

`npm test` 驗證三種 mock scenario、重試/重複提交、影格抽樣、五個 HTTP endpoints、multipart 對齊、null URL normalization、結果 schema、網路/HTTP/JSON/timeout 錯誤。使用 Node 內建 test runner，不需要 AI server。

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
