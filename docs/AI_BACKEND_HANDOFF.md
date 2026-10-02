# AI Backend Handoff · Contract 1.0

目標：先回傳相容 JSON，再替換成真正推論。前端不依賴 YOLO、SAM、PyTorch 或訓練策略。

`API_CONTRACT_VERSION = "1.0"` 定義於 lib/api-config.ts；不新增 version header。完整 enum / validation 見 [API_CONTRACT](API_CONTRACT.md)。

## Teammates implement these six endpoints

| Method | Path                              | Expected response                                                                                     |
| ------ | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | /health                           | 200 `{ "status": "ok" }`                                                                              |
| POST   | /api/v1/inspections               | 201 `{ "inspectionId": "insp_001", "status": "scanning" }`                                            |
| POST   | /api/v1/inspections/{id}/frames   | 200 `{ "accepted": 16 }`（等於實際檔案數）                                                            |
| POST   | /api/v1/inspections/{id}/complete | 200 `{ "inspectionId": "insp_001", "status": "processing" }`；已完成可 completed                      |
| GET    | /api/v1/inspections/{id}          | `{ "inspectionId": "insp_001", "status": "processing", "progress": 72, "stage": "damage_detection" }` |
| GET    | /api/v1/inspections/{id}/result   | completed 的 InspectionResult，見範例檔                                                               |

Create request：`{ "vehicleId": "vehicle_001", "vehicleModel": "Toyota Yaris Cross", "plate": "RAC-2026" }`，不是 vehicle 巢狀 object。

Upload request：multipart 的重複 `frames` 檔案（JPEG/PNG/WebP）與 **一次** `metadata` JSON 字串，順序對齊。範例：

```json
{
  "frames": [
    {
      "id": "frame_001",
      "timestamp": 500,
      "vehicleView": "front",
      "quality": { "exposureScore": 0.74 }
    }
  ]
}
```

timestamp 是**掃描開始後毫秒**，不是 epoch/秒；報告 duration 是秒。vehicleView = front/left/rear/right/unknown，是 Prototype 引導估計。quality 裡 blurScore/exposureScore/vehicleCoverage 可省略。影像由相機先降至最長邊 1280 px，JPEG quality 0.8。請回覆後端最大檔案／批次大小、image MIME 支援與資料保存政策。

Backend status = scanning / uploading / processing / completed / failed（frontend 另用 idle）。stage = image_validation / vehicle_part_detection / damage_detection / before_after_comparison / completed。progress 為 0–100。錯誤使用 HTTP 400/404/409/413/422/500/503，不將 traceback 當公開訊息。

## Result fields

必填：inspectionId、status=completed、detectionStatus、coverage、scanDurationSeconds、processingTimeSeconds、keyFrameCount、damages。

每項 damages 必填：唯一 id、part、damageType、confidence、isPotentialNewDamage。可選 boundingBox、beforeImageUrl、afterImageUrl、maskImageUrl；null / 省略皆可。圖片用 HTTPS 完整 URL 或單一 `/` 開頭 API-origin 路徑。vehicle、createdAt 可選，前端能由輕量 session 補齊。建議一併回傳 missingAreas。

- confidence / coverage：有限數值 0–1，越界會 INVALID_RESPONSE。
- boundingBox：x/y/width/height 各 0–1，寬高 >0，框不能超出影像。
- no_damage 必須 damages=[]；potential_damage 至少一項。
- 多筆 damages 全部顯示；信心度只作視覺提示，不判定責任。
- missingAreas 獨立代表 Unknown，不能解讀成 no_damage。
- 未知但非空 part/damageType 顯示「未知區域」／「疑似異常」，raw 值只保留於開發 JSON。

可直接拿 [potential damage JSON](examples/result-potential-damage.json) 或 [no damage JSON](examples/result-no-damage.json) 回傳測試。範例沒含 vehicle/createdAt，符合 wire contract 的 optional 定義。

## curl smoke test

先替換 URL、inspectionId、真實測試圖片路徑。curl 自動處理 multipart boundary，**不要**手動指定 multipart Content-Type。以下只有一張圖片，因此 accepted 預期為 1。

```bash
INSPECTION_API_BASE='https://<teammate-backend-host>'
curl --fail-with-body "$INSPECTION_API_BASE/health"

curl --fail-with-body -X POST "$INSPECTION_API_BASE/api/v1/inspections" \
  -H 'Content-Type: application/json' \
  --data '{"vehicleId":"vehicle_001","vehicleModel":"Toyota Yaris Cross","plate":"RAC-2026"}'

INSPECTION_TEST_ID='<inspectionId-from-create>'
curl --fail-with-body -X POST "$INSPECTION_API_BASE/api/v1/inspections/$INSPECTION_TEST_ID/frames" \
  -F 'frames=@/path/to/frame_001.jpg;type=image/jpeg' \
  -F 'metadata={"frames":[{"id":"frame_001","timestamp":500,"vehicleView":"front","quality":{"exposureScore":0.74}}]}'

curl --fail-with-body -X POST "$INSPECTION_API_BASE/api/v1/inspections/$INSPECTION_TEST_ID/complete"
curl --fail-with-body "$INSPECTION_API_BASE/api/v1/inspections/$INSPECTION_TEST_ID"
# Wait until status=completed, then:
curl --fail-with-body "$INSPECTION_API_BASE/api/v1/inspections/$INSPECTION_TEST_ID/result"
```

## Reliability and CORS agreement

GET 最多重試兩次，POST 不自動 replay。upload 允許使用者用**同一 id**重試，所以批次應替換/去重，不累加。complete 必須冪等，refresh 不應建立新分析。若 create timeout，前端無法確認 server 是否已建紀錄，使用者再開始可能產生空 session；後端需定期清理孤立紀錄，未宣稱 exactly-once create。

一般請求逾時 15 秒；upload 30 秒；status/result/health GET 10 秒。輪詢約每秒一次，總等待 60 秒（含 request 與 retry），逾時保留 id 可重新取結果。結果與影像需要維持足夠保存期供刷新恢復；Reset Session 只清前端，不刪後端。

依 [FastAPI CORS 官方文件](https://fastapi.tiangolo.com/tutorial/cors/) 允許 http://localhost:3000 與實際前端 HTTPS origin、GET/POST、Content-Type / OPTIONS。圖片 URL 也須在 HTTPS 頁面可載入。手機 localhost 指手機自身，不能指向開發電腦；提供手機可達 HTTPS backend。

## Frontend connection

```dotenv
NEXT_PUBLIC_USE_MOCK_AI=false
NEXT_PUBLIC_AI_API_URL=https://<teammate-backend-host>
```

本機重啟 dev server；Vercel 設定後重新部署。NEXT_PUBLIC 不是秘密，不放 API key。團隊確認 health → create → multipart → complete → poll → result，再用真實手機相機依 [MOBILE_TEST_CHECKLIST](MOBILE_TEST_CHECKLIST.md) 驗證。
