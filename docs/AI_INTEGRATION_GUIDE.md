# AI team integration guide

前端已能 create → 真實 JPEG multipart upload → complete → poll → result → /damage 或 /result。此里程碑沒有實作推論。

## Five endpoints

| Method | Endpoint                          | Response                                  |
| ------ | --------------------------------- | ----------------------------------------- |
| POST   | /api/v1/inspections               | inspectionId、status=scanning             |
| POST   | /api/v1/inspections/{id}/frames   | accepted，等於影格數                      |
| POST   | /api/v1/inspections/{id}/complete | inspectionId、status=processing/completed |
| GET    | /api/v1/inspections/{id}          | inspectionId、status、progress、stage     |
| GET    | /api/v1/inspections/{id}/result   | InspectionResult                          |

Create body 是 vehicleId / vehicleModel / plate。Multipart 是重複 `frames` 檔案 + 單一 `metadata` JSON；影格 timestamp 是掃描開始後的毫秒，報告 duration 是秒。完整範例及 enum 見 [API_CONTRACT.md](./API_CONTRACT.md)。

## Switch to teammate backend

`.env.local`：

```dotenv
NEXT_PUBLIC_USE_MOCK_AI=false
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

重啟 dev server；production 重新 build。NEXT_PUBLIC 設定可被使用者讀取，不能放密鑰。

外部 AI backend 的 Demo metadata 不會冒充實拍影像上傳；請使用真實相機拍攝。只有本機 development stub 能用明確標記 DEMO 的 JPEG fixture 驗證 HTTP。

## HTTP development stub

```dotenv
NEXT_PUBLIC_USE_MOCK_AI=false
NEXT_PUBLIC_AI_API_URL=http://localhost:3000/api/dev
NEXT_PUBLIC_DEV_AI_RESULT=potential_damage
```

執行 `npm run dev`；從 /return → /scan-guide → /scan 選 Demo 可用真實 canvas JPEG bytes 走完整 HTTP 流程；真實相機使用既有 capture pipeline。Stub 五個 endpoints 位於 /api/dev/api/v1/inspections，約 3 秒處理，不執行 AI。

開啟 /dev/integration，可測 Create、Connection、No Damage、Potential Damage，並選 processing_failure、result_timeout、incomplete、missing_images、500、503、upload_failure。Connection 透過 create 驗證契約，會建立空的開發紀錄。

也可在 API URL 加 query，例如 `http://localhost:3000/api/dev?result=no_damage`、`?result=processing_failure`、`?failure=upload_failure`；query 將保留到每個 endpoint。upload_failure 在每筆 inspection 的首次上傳失敗，再按重試可成功。result query 優先於 NEXT_PUBLIC_DEV_AI_RESULT。

Stub 只在 NODE_ENV=development 接受請求；production /dev/integration 與 stub endpoints 都回 404。只保留最近 10 筆記憶體 session，TTL 15 分鐘，單批最多 20 張、單圖 2 MB、總 request 24 MB。重啟或 TTL 到期會遺失影像，圖片顯示 fallback；沒有 disk storage 或認證。這是開發 stub，不適用正式多程序環境。

## CORS

若 FastAPI 在 `http://localhost:8000`，前端在 `http://localhost:3000`，兩者是不同 origin。**後端**須允許 frontend origin、GET/POST、Content-Type 以及 OPTIONS preflight。

依照 [FastAPI 官方 CORS 說明](https://fastapi.tiangolo.com/tutorial/cors/)，allow_origins 先包含 `http://localhost:3000`，之後加入實際部署的前端 HTTPS URL。若改用 127.0.0.1 或不同 port，必須一併設定對應 origin。此前端不放入 FastAPI 專用 CORS 程式碼。

手機無法透過自己的 localhost 連到電腦 backend；手機測試需要可到達的 HTTPS API URL，避免 HTTPS 前端呼叫 HTTP API 的 mixed content。詳見 README Mobile Camera Testing。

## Session and retries

/scan 上傳成功才進 /analyzing。成功上傳後本機 Blob/URL 釋放；sessionStorage 只含輕量 metadata。/analyzing 每約 1 秒依 backend stage 更新 UI，60 秒逾時顯示「AI 分析時間較長，請稍後再試。」與「重新取得結果」。不刪除 inspection session。

refresh 後 /analyzing 可重新輪詢；refresh /result 或 /damage 可按「重新取得結果」。尚未上傳的實拍 Blob 不會序列化，refresh 需重新掃描。backend 應使批次上傳與 complete 可安全重試。

## Exact teammate handoff

請提供 base URL、五個 endpoints、CORS origins、最大影像大小與圖片保存政策。每項車損包含 id、part、damageType、confidence、isPotentialNewDamage；選擇性 boundingBox、beforeImageUrl、afterImageUrl、maskImageUrl。請用 0–1 信心度/coverage、normalized bounding box、獨立 missingAreas；回傳 no_damage 時 damages 必須空陣列。

前端不依賴模型/訓練方式；先回傳契約 JSON 即可測試，再替換推論輸出。此專案未安裝 YOLO、SAM、PyTorch、Python 或 Three.js。
