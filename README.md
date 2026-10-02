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
2. 車頭、左側、車尾、右側每段約 2 秒，指引隨進度切換；100% 選出關鍵影格，顯示「正在準備 AI 分析」／「正在上傳關鍵影格」；成功上傳與 complete 後才進入分析。
3. 上傳與分析合計約 4 秒，輪詢 Mock API 取得結果；無異常（`no_damage`）直接進入結果，預設為 `potential_damage`。
4. 預設發現左前車門疑似刮痕；按「前往補拍」開啟模擬拍攝對話框；0.6 秒後顯示「補拍完成」，再停留 1 秒後自動顯示結果。可取消補拍。
5. 比較租車前、還車時與 AI Mask 示意影像，點擊車損標記會選取對應卡片。「完成還車」顯示完成狀態；「查看完整檢測報告」前往 `/dashboard`。
6. 在掃描頁展開 Demo Controls，可模擬六種品質狀態、疑似異常、無異常、覆蓋不足與網路不佳提示。無異常直接進入結果；覆蓋不足以 Unknown 顯示，不阻擋完成。

輕量 inspection session 以 sessionStorage 保存 id、車輛、掃描時間、影格數、模式與狀態。成功上傳後的 /analyzing 可在重新整理後恢復；/result 或 /damage 可按「重新取得結果」。影格 Blob 僅在記憶體；未上傳前重新整理需重新掃描。沒有 localStorage 或 IndexedDB 照片保存。

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

所有 AI 回應、報告時間、車損、信心度、Demo 攝影機與績效數值均為 **MOCK / DEMO DATA**。SVG 圖片不是實際車損證據。掃描產生並上傳 16 張模擬影格，分析與報告顯示同一批影格數量；8 秒是展示掃描時間，27.4 秒為模擬報告數據。

網路不佳僅模擬 UI 提示，**尚未實作 IndexedDB 離線暫存與重傳**。完成還車只改變本機 Demo 狀態，不會操作真實租車帳號。此為可建置的前端 MVP，正式部署仍需端到端後端整合與真實資料驗證。

## Future Integration

- Camera：`components/camera/CameraPreview.tsx` 切換 Mock / RealCameraPreview。真實模式只在按下「開始真實掃描」後 mount 並請求 getUserMedia；行動裝置若支援可優先顯示真實模式，桌面預設 Demo。首次進入頁面不請求權限。
- Frames：`lib/camera-frame-capture.ts` 約每 500 ms（2 FPS）由 video → canvas → JPEG Blob（quality 0.8）擷取；最長邊 ≤ 1280 px，保持比例，不放大低解析度影像。原生 video 仍使用裝置預覽影格率。CapturedFrame 提供 Blob、previewUrl、timestamp（毫秒）、vehicleView 與 optional quality。
- Selection / storage：`lib/frame-selection.ts` 依 front/left/rear/right 分組，每組均勻抽樣，通常選 16 張；`MemoryFrameStore` 最多保留 80 張暫存，淘汰時保留各方向。未選用的 Blob URL 立即 revoke；選定影格在上傳前可開發預覽，上傳成功後立即釋放 Blob/URL；開始新檢查或 provider 卸載同樣清除。中途離開掃描或切換模式會清除未完成影格；canvas 非同步結果若晚到，直接 revoke。
- AI：UI 只透過 `services/inspection-service.ts` 操作。詳見 [API contract](docs/API_CONTRACT.md) 與 [AI team quick guide](docs/AI_INTEGRATION_GUIDE.md)。未新增 AI 模型、Python 套件或 3D 引擎。
- 車輛資料與車損資訊從共用型別、資料、service 與 context 取得。Unknown 漏掃區域獨立於 no_damage；車損類型、部位與影像 URL 皆由結果提供。車體示意圖目前只校準左前車門定位，其他部位仍需擴充。

## Mock / API mode

`.env.example`：

```dotenv
NEXT_PUBLIC_USE_MOCK_AI=true
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

預設或 true 使用 Mock；只有明確設定 false 才使用 HTTP adapter。複製到 `.env.local` 後重啟 dev server，production 需重新 build。NEXT_PUBLIC 變數會公開，不可保存 API 密鑰。Mock create 延遲 300 ms、upload 500 ms、processing 約 3 秒，無需後端。

HTTP adapter 提供 15 秒 request timeout、回應 schema 驗證與安全中文錯誤。掃描頁先上傳 → complete → /analyzing 輪詢（HTTP 每約 1 秒、最多 60 秒）→ 結果分流。失敗上傳保留記憶體影格供重試；成功上傳後釋放 Blob/URL。AbortController 在卸載、逾時或停止時取消讀取；service 共用成功的 mutations 避免重複提交。

## HTTP Development Integration

使用本機 HTTP stub：

```dotenv
NEXT_PUBLIC_USE_MOCK_AI=false
NEXT_PUBLIC_AI_API_URL=http://localhost:3000/api/dev
NEXT_PUBLIC_DEV_AI_RESULT=potential_damage
```

設定 `.env.local` 並重啟 `npm run dev`。原 Demo scan 在此開發 stub 模式會產生明確標記 DEMO 的實際 JPEG Blob，經真正 multipart HTTP 請求傳送；真實相機也可沿用。Stub 處理約 3 秒，沒有 AI。

開啟 `/dev/integration` 測試五端點、上傳數、最後狀態與 raw result。可測 no_damage、potential_damage、processing_failure、result_timeout、Unknown 漏掃、缺圖、500、503、upload_failure。API URL 支援 `?result=no_damage` 或 `?failure=upload_failure`，整個掃描流程也會套用。Stub 與除錯頁在 production 回 404；影像僅存 server 記憶體（10 筆、15 分鐘 TTL），重啟即清除。

跨來源 backend 的 CORS 與 exact AI team handoff 見 [AI_INTEGRATION_GUIDE](docs/AI_INTEGRATION_GUIDE.md)。

開發環境提供可摺疊 API Debug：session ID、MOCK/API、相機模式、已擷取／保留影格數、coverage、processing status、raw result JSON，以及 Key Frames 縮圖。AI Result scenario 選項也僅在 development 顯示，production 不顯示除錯面板。

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

## Mobile Camera Testing

相機需要安全來源：localhost 或 HTTPS（[MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)）。電腦的 localhost 並不是手機的 localhost；手機開啟 `http://192.168.x.x:3000` 一般不能使用相機，Demo 模式仍可使用。

建議測試流程：

1. 若使用 Vercel，將此分支部署成 Preview deployment，取得 HTTPS 網址（也可使用其他 HTTPS hosting）。本次未自動部署。
2. 在手機 Safari / Chrome 開啟 HTTPS 網址，經 `/return → /scan-guide → /scan`。
3. 選「真實相機」，確認隱私提示，按「開始真實掃描」，允許相機權限。後鏡頭為 ideal environment，裝置仍可能選擇其他可用鏡頭。
4. 手機直立，依車頭 → 左側 → 車尾 → 右側指引慢慢拍攝。預覽用 `<video playsInline muted autoPlay>`；橫向只顯示建議，不鎖定方向。
5. Prototype 時間引導約 24 秒，最多自動走到 95%。只有至少 12 張有效影格且有四個估計方向時才能按「完成掃描」；不會只因時間到了自動結束。方位與進度不是 AI 車身覆蓋判定。
6. 按完成後關閉相機，分組選出最多 16 張，繼續原本 `/analyzing → /damage 或 /result`。預設 Mock AI 不會傳送相機影像，也不分析照片內容。
7. 在 development 的 API Debug 可於上傳前展開 Key Frames；成功上傳後本機影格釋放，保留影格數與 inspectionId。production 沒有此面板。
8. 切到背景、離開掃描頁、切回 Demo、拒絕權限、關閉裝置鏡頭等情境都應停止 tracks。若權限被拒絕，可修改瀏覽器設定後重試，或選「改用 Demo 模式」。

亮度只使用 32×32 canvas 的平均 luminance（0–1），低於 0.15 提示較暗；blurScore、vehicleCoverage 尚未計算。沒有實作車損、車體部位、OCR 或其他 AI 判斷。

單元測試使用模擬 MediaStream / canvas，不會打開電腦鏡頭。尚需實際 iOS Safari / Android 裝置驗證相機選擇、permission／playback、背景切換與長時間拍攝；內建瀏覽器的 UI smoke test 不代表實機驗證。

## Routes

| Route              | Purpose                            |
| ------------------ | ---------------------------------- |
| `/`                | Hackathon Demo 首頁                |
| `/return`          | 還車入口與車輛資訊                 |
| `/scan-guide`      | 掃描前指引                         |
| `/scan`            | Demo／真實相機、擷取計數與拍攝指引 |
| `/analyzing`       | API 輪詢、分析進度、失敗重試       |
| `/damage`          | 中性疑似異常提示及模擬補拍         |
| `/result`          | 摘要、影像比較、報告、完成還車     |
| `/dev/integration` | development-only HTTP 測試頁       |
| `/dashboard`       | 模擬 KPI、圖表與可篩選實驗表格     |

## Project Structure

```text
app/                   # existing routes, layout, globals
components/camera/     # mode wrapper, live video preview, mock preview
components/dev/        # development-only ApiDebugPanel
components/inspection/ # shared context, analysis, result, comparison, recapture
components/scan/       # original scan UI and simulation hook
components/vehicle/    # shared vehicle data and illustration
services/              # service, mock/HTTP adapters, errors, response validation
lib/                   # camera lifecycle/capture, frame store/selection, shared data
types/                 # camera, inspection and CapturedFrame contracts
tests/                 # Node built-in camera/contract tests; no extra dependencies
docs/                  # API contract and practical AI integration guide
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

`npm test` 驗證相機請求共用、晚到 MediaStream 停止、權限失敗／重試、resize / JPEG 擷取、曝光 metadata、各方向抽樣、記憶體清理與三種 mock scenario、重試/重複提交、影格抽樣、五個 HTTP endpoints、multipart 對齊、null URL normalization、結果 schema、網路/HTTP/JSON/timeout 錯誤。使用 Node 內建 test runner，不需要 AI server；另含原生 HTTP multipart roundtrip、stub 分流／錯誤、輪詢取消及 session fallback 測試。

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
