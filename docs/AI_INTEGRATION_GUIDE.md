# AI team quick integration guide

你們只需提供以下 endpoints；前端不依賴模型的實作方式。

| Method | Endpoint                            | Response                                                                      |
| ------ | ----------------------------------- | ----------------------------------------------------------------------------- |
| POST   | `/api/v1/inspections`               | `{ "inspectionId": "insp_2026_001", "status": "scanning" }`                   |
| POST   | `/api/v1/inspections/{id}/frames`   | `{ "accepted": 16 }`                                                          |
| POST   | `/api/v1/inspections/{id}/complete` | `{ "inspectionId": "insp_2026_001", "status": "processing" }`                 |
| GET    | `/api/v1/inspections/{id}`          | `{ "inspectionId": "insp_2026_001", "status": "completed", "progress": 100 }` |
| GET    | `/api/v1/inspections/{id}/result`   | 下方 JSON                                                                     |

最小後端流程：建立 session → 保存上傳影格 → complete 啟動分析 → 回傳結果。現有前端還需要上表的 GET status；同步模型可直接在 complete 後讓 status 回傳 completed / 100。create body 提供 vehicle；frames 使用 multipart 的 `frames[]`、`timestamps[]`（秒），以及可選 `viewAngles[]`（度），相同索引對應同一張影格。上傳與 complete 請支援相同 session 的安全重試。

請先回傳這個 exact result JSON 驗證串接，再替換成模型輸出：

```json
{
  "inspectionId": "insp_2026_001",
  "vehicle": {
    "id": "vehicle_001",
    "model": "Toyota Yaris Cross",
    "plate": "RAC-2026"
  },
  "status": "completed",
  "detectionStatus": "potential_damage",
  "coverage": 0.96,
  "scanDurationSeconds": 27.4,
  "processingTimeSeconds": 2.84,
  "keyFrameCount": 16,
  "missingAreas": [],
  "damages": [
    {
      "id": "damage_001",
      "part": "left_front_door",
      "damageType": "scratch",
      "confidence": 0.91,
      "isPotentialNewDamage": true,
      "beforeImageUrl": null,
      "afterImageUrl": null,
      "maskImageUrl": null
    }
  ],
  "createdAt": "2026-10-02T00:00:00.000Z"
}
```

無車損時設 `detectionStatus: "no_damage"`、`damages: []`。漏掃區域使用 `missingAreas: ["right_rear_door"]`，代表 Unknown，不能宣稱該部位沒有車損。confidence/coverage 都用 0–1，所有 duration 用秒。完整 enum 與 HTTP codes 見 [API_CONTRACT.md](./API_CONTRACT.md)。

模型可以使用 YOLO、SAM、OpenCV、PyTorch 或其他方式。FastAPI 僅為可選的 HTTP server 範例，並非要求；此專案沒有安裝或實作任何模型。

前端 `.env.local` 設定後重新啟動（正式環境重新 build）：

```dotenv
NEXT_PUBLIC_USE_MOCK_AI=false
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

目前 CameraPreview 仍為 mock，產生的是無影像 bytes 的 metadata，API adapter 會拒絕這種上傳。要端到端測試真實影像，先在 CameraPreview 介面接入實際 JPEG/PNG CapturedFrame.blob；RealCameraPreview 目前刻意停用。尚未完成相機擷取時可用既有 adapter tests 驗證 HTTP 合約，再保持 mock=true 展示原流程。
