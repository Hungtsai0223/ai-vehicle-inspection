# AI Vehicle Inspection

共享汽車智慧車況檢測系統 · 2026 AI Hackathon 前端 MVP

公開展示：[https://ai-vehicle-inspection.vercel.app/demo](https://ai-vehicle-inspection.vercel.app/demo)。使用 Mock AI，任何人可開啟，不需啟動本機 server。

## Project Overview

嵌入共享汽車還車流程的 mobile-first 外觀檢查模組，主要尺寸為 390 × 844。以繁體中文提供掃描指引、疑似異常補拍與檢查摘要。此專案沒有實際 AI 模型，也不判定責任。

## Problem

現有共享汽車還車流程需要使用者逐張拍攝車輛照片，營運團隊再人工審閱大量影像。手動拍攝也容易產生模糊、角度不正確與漏拍。

## Proposed Solution

使用者沿車輛走一圈，系統引導拍攝、擷取影格並選出關鍵影格，再透過可替換的 API 傳至 AI 模型，回傳疑似車損與比對影像供人工確認。目前 AI adapter 使用 Mock 或 HTTP 契約，真實模型由隊友串接。

## Demo Flow

`/demo → /return → /scan-guide → /scan → /analyzing → /damage 或 /result → /dashboard`

1. 開始模擬掃描，依 12 個引導角度逐一收集影格，正常約 12 秒完成；品質無效時停留重試。
2. 每個角度取得 2 張有效影格後填滿對應環段；完成 12 區後從 24 張選出約 16 張關鍵影格。成功上傳與 complete 後才進入分析，時間本身不會填滿角度。
3. 上傳與分析合計約 4 秒，輪詢 Mock API 取得結果；無異常（`no_damage`）直接進入結果，預設為 `potential_damage`。
4. 預設發現左前車門疑似刮痕；按「前往補拍」開啟模擬拍攝對話框；0.6 秒後顯示「補拍完成」，再停留 1 秒後自動顯示結果。可取消補拍。
5. 比較租車前、還車時與 AI Mask 示意影像，點擊車損標記會選取對應卡片。「完成還車」顯示完成狀態；「查看完整檢測報告」前往 `/dashboard`。
6. 在掃描頁展開 Demo Controls，可模擬六種品質狀態、疑似異常、無異常、覆蓋不足與網路不佳提示。無異常直接進入結果；覆蓋不足以 Unknown 顯示，不阻擋完成。

輕量 inspection session 以 sessionStorage 保存 id、車輛、掃描時間、影格數、模式與狀態。成功上傳後的 /analyzing 可在重新整理後恢復；/result 與 /damage 會自動重新取得已完成結果，失敗可重試。影格 Blob 僅在記憶體；未上傳前重新整理需重新掃描。沒有 localStorage 或 IndexedDB 照片保存。

## Architecture

```text
Mobile Camera / Demo Camera
    ↓ Frame Capture (JPEG, 2 FPS)
    ↓ Key Frame Selection (up to 16)
Inspection Service
    ↓ Replaceable Mock / HTTP API adapter
AI Backend → Potential Damage Detection (pending teammate integration)
    ↓ Result UI / Human Review
```

Next.js 16.3.8、React 19.3、TypeScript、Tailwind CSS 4、Lucide React、Framer Motion。共用 CSS token 統一白底、紅色主色、綠色完成狀態、琥珀警告與元件尺寸。支援鍵盤焦點與 reduced-motion。

## Current Status

| Area                 | Status                             |
| -------------------- | ---------------------------------- |
| Frontend             | complete                           |
| Mobile Camera        | prototype complete；實機驗證待進行 |
| Key Frame Pipeline   | complete                           |
| API Architecture     | complete                           |
| Mock API             | complete                           |
| HTTP Integration     | complete                           |
| AI Backend           | pending teammate integration       |
| 3D Model             | future enhancement                 |
| Experimental Metrics | pending real experiment results    |

沿用既有 UI。此版本完成 Deployment + Mobile Demo Readiness；新增展示入口與備援，保留原本 Mock / HTTP 流程。

## Current MVP

所有 AI 回應、報告時間、車損、信心度、Demo 攝影機與績效數值均為 **MOCK / DEMO DATA**。SVG 圖片不是實際車損證據。完整 Demo 收集 24 張模擬影格並選出最多 16 張，分析與報告顯示同一批選定影格數量；27.4 秒為模擬報告數據。

網路不佳僅模擬 UI 提示，**尚未實作 IndexedDB 離線暫存與重傳**。完成還車只改變本機 Demo 狀態，不會操作真實租車帳號。此為可建置的前端 MVP，正式部署仍需端到端後端整合與真實資料驗證。

## Future Integration

- Camera：`components/camera/CameraPreview.tsx` 切換 Mock / RealCameraPreview。真實模式只在按下「開始真實掃描」後 mount 並請求 getUserMedia；行動裝置若支援可優先顯示真實模式，桌面預設 Demo。首次進入頁面不請求權限。
- Frames：`lib/camera-frame-capture.ts` 約每 500 ms（2 FPS）由 video → canvas → JPEG Blob（quality 0.8）擷取；最長邊 ≤ 1280 px，保持比例，不放大低解析度影像。原生 video 仍使用裝置預覽影格率。CapturedFrame 提供 Blob、previewUrl、timestamp（毫秒）、vehicleView 與 optional quality。
- Selection / storage：`lib/frame-selection.ts` 優先依 12 個 guided sector 分組（舊影格退回 front/left/rear/right），每組均勻抽樣，通常選 16 張並保留角度多樣性；`MemoryFrameStore` 最多保留 80 張暫存，淘汰時保留各方向。未選用的 Blob URL 立即 revoke；選定影格在上傳前可開發預覽，上傳成功後立即釋放 Blob/URL；開始新檢查或 provider 卸載同樣清除。中途離開掃描或切換模式會清除未完成影格；canvas 非同步結果若晚到，直接 revoke。
- AI：UI 只透過 `services/inspection-service.ts` 操作。詳見 [API contract](docs/API_CONTRACT.md) 與 [AI team quick guide](docs/AI_INTEGRATION_GUIDE.md)。未新增 AI 模型、Python 套件或 3D 引擎。
- 車輛資料與車損資訊從共用型別、資料、service 與 context 取得。Unknown 漏掃區域獨立於 no_damage；車損類型、部位與影像 URL 皆由結果提供。車體示意圖目前只校準左前車門定位，其他部位仍需擴充。

## Mock / API mode

`.env.example`：

```dotenv
NEXT_PUBLIC_USE_MOCK_AI=true
NEXT_PUBLIC_AI_API_URL=/api/dev
NEXT_PUBLIC_DEMO_RESULT=potential_damage
NEXT_PUBLIC_ENABLE_DEMO=true
```

預設或 true 使用 Mock；只有明確設定 false 才使用 HTTP adapter。複製到 `.env.local` 後重啟 dev server，production 需重新 build。NEXT_PUBLIC 變數會公開，不可保存 API 密鑰。Mock create 延遲 300 ms、upload 500 ms、processing 約 3 秒，無需後端。

HTTP adapter 使用 fetchWithTimeout：一般請求 15 秒、影格上傳 30 秒、狀態／結果讀取 10 秒，含 response body。GET 遇 network、timeout、408、429、5xx 最多再試 2 次（250/500 ms backoff）；INVALID_RESPONSE 與其他 4xx 不重試。POST create/upload/complete 不自動重送，upload 與 complete 由使用者重試同一 inspectionId。提供回應 schema 驗證與安全中文錯誤。掃描頁先上傳 → complete → /analyzing 輪詢（HTTP 每約 1 秒、最多 60 秒）→ 結果分流。失敗上傳保留記憶體影格供重試；成功上傳後釋放 Blob/URL。AbortController 在卸載、逾時或停止時取消讀取；service 共用成功的 mutations 避免重複提交。

## HTTP Development Integration

使用本機 HTTP stub：

```dotenv
NEXT_PUBLIC_USE_MOCK_AI=false
NEXT_PUBLIC_AI_API_URL=/api/dev
NEXT_PUBLIC_DEMO_RESULT=potential_damage
```

設定 `.env.local` 並重啟 `npm run dev`。原 Demo scan 在此開發 stub 模式會產生明確標記 DEMO 的實際 JPEG Blob，經真正 multipart HTTP 請求傳送；真實相機也可沿用。Stub 處理約 3 秒，沒有 AI。

開啟 `/dev/integration` 測試五端點、上傳數、最後狀態與 raw result。可測 health、create、獨立 frame upload、no_damage、potential_damage、processing_failure、result_timeout、Unknown 漏掃、缺圖、多筆異常、未知 enum、500、503、upload_failure 與 Reset Session。健康檢查不建立 inspection。API URL 支援 `?result=no_damage` 或 `?failure=upload_failure`，整個掃描流程也會套用。Stub 與除錯頁在 production 回 404；影像僅存 server 記憶體（10 筆、15 分鐘 TTL），重啟即清除。

跨來源 backend 的 CORS 與 exact AI team handoff 見 [AI_BACKEND_HANDOFF](docs/AI_BACKEND_HANDOFF.md)。契約版本為 `API_CONTRACT_VERSION = "1.0"`，僅文件常數，沒有額外 version header。

開發環境提供可摺疊 API Debug：session ID、MOCK/API、相機模式、已擷取／保留影格數、coverage、processing status、raw result JSON，以及 Key Frames 縮圖。AI Result scenario 選項也僅在 development 顯示，production 不顯示除錯面板。

## Local Development

Node.js 20.9+（本次使用 Node.js 26）。

```bash
npm install
npm run dev
```

也可用 `npm run dev -- --port 3001`。開啟終端列出的實際網址（例如 http://localhost:3001/demo）；stub 使用 `/api/dev`，換 port 不需改程式。預設不需要 `.env`、攝影機權限或後端。

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
npm run format
```

## Mobile Camera Testing

相機需要安全來源：localhost 或 HTTPS（[MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)）。電腦的 localhost 並不是手機的 localhost；手機開啟 `http://192.168.x.x:3001` 一般不能使用相機，Demo 模式仍可使用。

建議測試流程：

1. 使用 [Vercel 公開 Demo](https://ai-vehicle-inspection.vercel.app/demo) 的 HTTPS 網址，或另建自己的 Preview deployment。
2. 在手機 Safari / Chrome 開啟 HTTPS 網址，經 `/return → /scan-guide → /scan`。
3. 選「真實相機」，確認隱私提示，按「開始真實掃描」，允許相機權限。後鏡頭為 ideal environment，裝置仍可能選擇其他可用鏡頭。
4. 手機直立，依車頭 → 左側 → 車尾 → 右側指引慢慢拍攝。預覽用 `<video playsInline muted autoPlay>`；橫向只顯示建議，不鎖定方向。
5. 依 12 區指引移位，點「已移至此角度，開始擷取」才拍攝下一區。每區收集 2 張有效影格；至少完成 10/12 區、包含車頭／左側／車尾／右側且有效影格 ≥12 張才可完成。10–11 區保留 83%／92%，不強制 100%。
6. 按完成後關閉相機，分組選出最多 16 張，繼續原本 `/analyzing → /damage 或 /result`。預設 Mock AI 不會傳送相機影像，也不分析照片內容。
7. 在 development 的 API Debug 可於上傳前展開 Key Frames；成功上傳後本機影格釋放，保留影格數與 inspectionId。production 沒有此面板。
8. 切到背景、離開掃描頁、切回 Demo、拒絕權限、關閉裝置鏡頭等情境都應停止 tracks。若權限被拒絕，可修改瀏覽器設定後按「重新開啟相機」，或選 Demo。track ended、持續 mute 1.5 秒、video error 或背景切換會停止串流，顯示「相機已停止，請重新開啟相機。」；重新開始會清除未完成影格，不拼接不同掃描。

亮度使用 32×32 canvas 的平均 luminance（0–1）。移動品質使用連續 tiny-frame RGB 平均差值的粗略代理，光線變化也可能觸發重試；不是物理速度、模糊或 AI 偵測。blurScore、vehicleCoverage 尚未計算。沒有實作車損、車體部位、OCR 或其他 AI 判斷。

單元測試使用模擬 MediaStream / canvas，不會打開電腦鏡頭。尚需實際 iOS Safari / Android 裝置驗證相機選擇、permission／playback、背景切換與長時間拍攝；內建瀏覽器的 UI smoke test 不代表實機驗證。

## Guided 360 Scan / Smart Torch

此里程碑僅升級 `/scan`，沿用頂部導覽、配色、還車與既有 API 流程。

- **Smart Torch（真實瀏覽器控制）**：啟用串流後檢查 active video track 的 `getCapabilities().torch`，不依裝置名稱推定。預設自動；亮度 <0.18 持續 1.5 秒判定偏暗，>0.35 持續 2 秒恢復明亮，中間區間保持既有狀態並重設計時。`applyConstraints` 僅於狀態變化執行，設 2.5 秒冷卻、序列化請求、失敗不逐幀重試，可手動切自動／開啟／關閉。完成、離頁、切 Demo、背景中斷、track ended 都清理補光並停止 tracks；晚完成的 ON 後仍排入 OFF。手動開啟模式維持使用者設定，切回自動後才依亮度關閉。
- **瀏覽器限制**：iPhone Safari、Android Chrome、前／後鏡頭的 torch 能力各異，可能缺少 getCapabilities、torch 或拒絕 constraints。不支援時隱藏控制；失敗僅顯示光線提示／手動開啟。過暗影格不計入，可移至明亮處、確認略過該角度、改 Demo；四個主要方向仍是必要條件。需實機驗證，桌面 UI 測試不能證明硬體補光成功。
- **VehicleFramingGuide**：固定取景參考框，並非偵測到的車輛框。真實模式透過 `VehicleFramingProvider`，尚未接 AI，保持 UNKNOWN。Demo 可模擬 GOOD、TOO_CLOSE、TOO_FAR；邏輯另支援 PARTIAL。可調常數：ratio .55–.85 GOOD、>.90 太近、<.40 太遠、normalized box 接觸 2% 邊界 PARTIAL；只是未驗證的原型門檻。
- **VehicleCoverageRing**：原創 12 段環、中央車輛圖示、完成數及次要百分比；灰色待拍、紅色目前角度、綠色完成、琥珀重試、虛線 Unknown。支援鍵盤、44px 點擊區、reduced-motion 與可選震動。
- **有效影格／進度**：JPEG 成功、亮度已知且 ≥.18、pixel-change ≤.20、非 TOO_FAST／模擬模糊、取景非明確無效。UNKNOWN 僅以原型方式接受。最低門檻常數 1 張，此版本採目標 2 張才完成一區。每區最多計 2 張、frame ID 去重、capture requestId 防止換區後晚到影格誤算。時間與取樣本身不產生進度。Demo 依有效模擬影格自動換區；Real 每次移位須確認，不會原地自動填滿全部角度。
- **完成／缺漏**：至少 10/12 區 + 車頭／左側／車尾／右側 + ≥12 張有效影格；12 區為「完整掃描」，10–11 為「主要車身區域已完成」。確認「無法拍攝此角度」標 unavailable，可點環重新拍攝。完成時所有未完成角度以保守車體部位對應合併至本機 result 的 `missingAreas`（Unknown），包含略過與提前完成的區域；不可推論沒有損傷。輕量 metadata 保存在本次 sessionStorage，可刷新恢復，後端 coverage 分數不被改寫。
- **有界儲存／API**：保留既有最多 80 張 memory store，此流程最多接受 24 張，通常選 16 張（約 12–20 的目標範圍），每個已完成 sector 至少保留一張。拒收、淘汰、上傳成功、切模式與離頁均釋放 Blob URL。新增 `scan`、`motionScore` 只在前端使用；既有 multipart metadata 仍只有 id、timestamp、vehicleView、quality，沒有新增 API 欄位、依賴或環境變數。
- **下一步 AI 接點**：`lib/vehicle-framing.ts` 的 provider 接隊友 vehicle bounding-box model；`lib/vehicle-view-classifier.ts` 的 classifier 接隊友 viewpoint model，再以實際預測驗證角度。現在 Real 只是 guided-prototype requested labels，Demo 是 simulated labels，均不能聲稱 AI 已驗證 360°。`types/scan.ts` 的角度覆蓋與 damage detection 分開。

新增 Node 單元測試覆蓋亮度門檻／遲滯、torch 能力／失敗／冷卻／清理、取景門檻、有效／無效／重複／晚到影格、12 區推進、略過／重拍、10 區與四面規則、完整 12 區、Demo／Real 標籤、key-frame 多樣性及 Unknown session 恢復。實機待驗：補光真的亮起／熄滅、不同鏡頭、曝光恢復、反光與暗色車身、繞車動作、背景／離頁中斷。

## Routes

| Route              | Purpose                                |
| ------------------ | -------------------------------------- |
| `/`                | Hackathon Demo 首頁                    |
| `/demo`            | Hackathon 展示入口、情境捷徑與重新開始 |
| `/return`          | 還車入口與車輛資訊                     |
| `/scan-guide`      | 掃描前指引                             |
| `/scan`            | Demo／真實相機、擷取計數與拍攝指引     |
| `/analyzing`       | API 輪詢、分析進度、失敗重試           |
| `/damage`          | 中性疑似異常提示及模擬補拍             |
| `/result`          | 摘要、影像比較、報告、完成還車         |
| `/dev/integration` | development-only HTTP 測試頁           |
| `/dashboard`       | 模擬 KPI、圖表與可篩選實驗表格         |

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
data/                  # labeled demo metrics and empty real experiment measurements
types/                 # camera, inspection, CapturedFrame and ExperimentResult contracts
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

`npm test` 驗證相機請求共用、晚到 MediaStream 停止、權限失敗／重試、resize / JPEG 擷取、曝光 metadata、各方向抽樣、記憶體清理、集中 Demo 情境（多處車損、Unknown、後端失敗）、重試/重複提交、影格抽樣、五個 HTTP endpoints、multipart 對齊、null URL normalization、結果 schema、網路/HTTP/JSON/timeout 錯誤。使用 Node 內建 test runner，不需要 AI server；另含原生 HTTP multipart roundtrip、stub 分流／錯誤、輪詢取消及 session fallback 測試。

## Hackathon Notes

Dashboard 的 94.2% accuracy、2.8 秒 detection、28.6 秒完整檢查、96% coverage、各類別辨識率及 3D 列印實驗表格均為 **MOCK DATA，非實際測量**。63% time reduction 僅為示範數值的四捨五入結果。展示時請明確說明模型尚未整合，數字須待團隊提供實際實驗結果後替換。

AI 僅協助篩選疑似異常，不直接作為責任判定依據。

## Environment Presets

| Preset                   | USE_MOCK_AI | AI_API_URL                                     | DEMO_RESULT                     |
| ------------------------ | ----------- | ---------------------------------------------- | ------------------------------- |
| LOCAL DEMO / Vercel demo | true        | 可省略                                         | potential_damage 或展示情境     |
| HTTP DEV STUB            | false       | /api/dev                                       | potential_damage 或其他開發情境 |
| REAL AI BACKEND          | false       | https://example-ai-backend.com（換成團隊 URL） | 可省略                          |

設定 `.env.local` 後重啟；Vercel NEXT_PUBLIC 設定變更後重新部署/build。正常 UI 不顯示後端連線指標；Backend Connected / Backend Unreachable / Mock Mode 只在開發測試頁使用。

## Vercel Deployment Readiness

使用 Next.js preset，Root Directory 設為本專案目錄，Install `npm ci`，Build `npm run build`，不用 static export、額外 server 或 vercel.json。

Vercel Preview/Production 環境變數：`NEXT_PUBLIC_USE_MOCK_AI`、`NEXT_PUBLIC_AI_API_URL`、`NEXT_PUBLIC_DEMO_RESULT`（預設 potential_damage）、`NEXT_PUBLIC_ENABLE_DEMO`（HTTP 展示才設 true）；舊 `NEXT_PUBLIC_DEV_AI_RESULT` 只限 development stub，正式部署可省略。第一版 Hackathon demo 設 Mock=true；接真實 backend 時改 false + 可由手機到達的 HTTPS API URL，再重新部署。後端 CORS 必須允許實際前端 HTTPS origin，圖片也須 HTTPS。不要在部署設定使用 localhost 或本機 /api/dev：production stub 與 /dev/integration 都回 404。

已完成 Vercel Preview 與 Production 部署，正式網址為 [ai-vehicle-inspection.vercel.app](https://ai-vehicle-inspection.vercel.app)。Preview 保留 Vercel 帳號保護，正式網域公開可達。兩個環境均已透過 CLI 設定 Mock=true、DEMO_RESULT=potential_damage、ENABLE_DEMO=true，不需手動加入後端 URL。平台配置依 [Vercel Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs) 與 [environment variables](https://vercel.com/docs/environment-variables) 官方文件。

CLI 登入、Root Directory、環境變數與 Preview → Production 流程見 [VERCEL_DEPLOYMENT](docs/VERCEL_DEPLOYMENT.md)。

## Mobile / Manual E2E Tests

完整跨瀏覽器清單見 [MOBILE_TEST_CHECKLIST](docs/MOBILE_TEST_CHECKLIST.md)。本專案沒有既有 Playwright 套件或 e2e 設定；保留 Node 測試與 Codex 瀏覽器互動驗證，避免加入額外瀏覽器依賴。實機相機不能由這些測試代替。

## Privacy

Prototype 版本中的影像僅用於本次車況檢測流程；實際正式服務的保存與隱私政策需依營運規範訂定。

前端不承諾後端的加密、保存期限或自動刪除。`resetInspection()` 只清除此次 sessionStorage key、context、影格/URL 與暫時掃描狀態，不操作其他瀏覽器資料，也不刪除已上傳的 backend 影像。

## GitHub

Private repository：[Hungtsai0223/ai-vehicle-inspection](https://github.com/Hungtsai0223/ai-vehicle-inspection)。GitHub CLI 已登入，`origin` 使用 HTTPS；從本專案目錄推送更新：

```bash
git add .
git commit -m "Describe the change"
git push origin main
```

## Presentation Entry and Demo Configuration

評審或展示者先開 `/demo`；想直接走還車流程可開 `/return`。`/scan` 是相機或 Demo 掃描；`/dashboard` 展示明確標示的模擬 KPI 與實驗表格。`/dev/integration` 僅 development 可使用，production 回 404，/demo 不提供 raw API URL、ID、JSON 或環境細節。

`NEXT_PUBLIC_DEMO_RESULT` 集中於 `lib/demo-config.ts`，支援 potential_damage、no_damage、multiple_damage、unknown_area、backend_error。Mock 完整流程會使用設定值；HTTP dev stub 會對應為既有情境（unknown_area→incomplete、backend_error→processing_failure）。顯式 query 或舊 NEXT_PUBLIC_DEV_AI_RESULT 優先；真實 backend 不受此設定操控。環境變數更新需重新啟動 dev 或重新 build/deploy。

/demo 提供直接展示單處、無車損、多處、覆蓋不足的捷徑，完全不發出 API 請求。後端失敗演練只在 Mock 可用：走完整流程後顯示錯誤，再由展示者按「使用 Demo 結果繼續」。不會自動偽造成功，備援頁明確標示 Demo Mode、未分析本次拍攝影像。正式版 HTTP 預設不提供 Demo 結果；若是 Hackathon 展示部署，明確設定 NEXT_PUBLIC_ENABLE_DEMO=true。實際服務設 false，Mock=true 時仍屬展示環境。

「重新開始 Demo」清掉此專案的 context/sessionStorage key、影格、selected frames、Blob URL、結果與處理狀態，再回 /return。結果捷徑只保存輕量情境標記，刷新後在本機重建 Demo 結果；沒有將模擬結果 ID 送到真實 backend。未上傳的照片仍不能跨 refresh 恢復。

## Experiment Data Handoff

`data/demo-metrics.ts` 保存所有示範 KPI、辨識率、效率與示範實驗列；`data/experiment-results.ts` 的 realExperimentResults 目前為空。隊友只需填入符合 `types/experiment.ts` 的 ExperimentResult[]，Dashboard 實驗表格會使用真實列並標示 REAL EXPERIMENT DATA，既有 KPI/圖表仍清楚標示 Mock，不會由少量實驗推導準確率。表格篩選選項由傳入資料產生。

before/after/mask 是專案自製的中性抽象 SVG，圖中與 UI 都標示 Demo Image，不是 AI 推論或真實車損證據。相機沿用最長邊 1280 px、JPEG quality 0.8；刮痕細節與實際 bytes/image 仍需手機驗證。

展示講稿：[DEMO_SCRIPT](docs/DEMO_SCRIPT.md)。AI 接線確認：[AI_TEAM_CHECKLIST](docs/AI_TEAM_CHECKLIST.md) 與 [AI_BACKEND_HANDOFF](docs/AI_BACKEND_HANDOFF.md)。
