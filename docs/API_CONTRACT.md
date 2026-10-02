# AI Vehicle Inspection API Contract v1

前端資料流為 UI → Inspection Service → Mock / HTTP Adapter → AI Backend。兩種 adapter 共用 `services/inspection-api.ts`；預設 Mock 不需要後端。下列契約不依賴模型或後端框架。

## 共通約定

- Base URL：`NEXT_PUBLIC_AI_API_URL`，例如 `http://localhost:8000`。所有路徑以 `/api/v1` 開始。
- JSON 欄位採 camelCase；回應為 `application/json`。inspectionId 為非空字串；前端會 URL encode。
- `confidence`、`coverage`：0–1 浮點數，不能回傳百分比 91 或 96。
- `progress`：0–100。`scanDurationSeconds`、`processingTimeSeconds`、上傳 `timestamps[]`：秒。
- `keyFrameCount`、`accepted`：非負整數。`createdAt`：ISO 8601 時間。
- InspectionStatus：`idle | scanning | uploading | processing | completed | failed`。一般生命週期為 scanning → uploading → processing → completed；失敗為 failed。
- DetectionStatus：`no_damage | potential_damage`。只描述已充分掃描區域；`missingAreas` 獨立描述 Unknown。
- DamageType：`scratch | dent | paint_damage | contamination | unknown`。
- VehiclePart：`front_bumper | rear_bumper | hood | trunk | left_front_door | left_rear_door | right_front_door | right_rear_door | left_fender | right_fender | headlight | taillight | wheel | unknown`。
- `boundingBox` 可省略；x/y/width/height 為影像座標 0–1，寬高 > 0，矩形不可超出影像。
- beforeImageUrl/afterImageUrl/maskImageUrl 可省略或為 null；adapter 將 null 轉成 undefined。支援 HTTP(S) URL 或以單一 `/` 開始的相對 URL；跨來源圖片須可存取。
- `no_damage` 必須搭配空 damages；`potential_damage` 至少有一項。damage id 必須唯一。Unknown 部位請使用明確的 `unknown` enum，不要傳入未定義字串。

## 1. Create inspection

`POST /api/v1/inspections`，Content-Type: application/json

```json
{
  "vehicle": {
    "id": "vehicle_001",
    "model": "Toyota Yaris Cross",
    "plate": "RAC-2026"
  }
}
```

201 回應：

```json
{ "inspectionId": "insp_2026_001", "status": "scanning" }
```

後端應保存車輛資料與建立時間。Demo scenario 僅供 mock adapter 使用，不會送至 HTTP API。

## 2. Upload selected key frames

`POST /api/v1/inspections/{inspectionId}/frames`，multipart/form-data

| Field          | Required | Format                                             |
| -------------- | -------- | -------------------------------------------------- |
| `frames[]`     | Yes      | 重複欄位，每個為實際 JPEG/PNG 檔案                 |
| `timestamps[]` | Yes      | 重複欄位，掃描開始後的秒數，依影格順序排列         |
| `viewAngles[]` | No       | 重複欄位，front=0、left=90、rear=180、right=270 度 |

HTTP adapter 另附 `metadata` JSON 欄位，與 frames[] 相同順序；最小後端可先接受並忽略未使用的 quality 資訊：

```json
{
  "frames": [
    {
      "id": "frame_001",
      "timestamp": 0.5,
      "vehicleView": "front",
      "quality": { "exposureScore": 0.62 }
    }
  ]
}
```

metadata.timestamp 同樣以秒計。exposureScore 是 32×32 樣本平均亮度（0–1）；blurScore 與 vehicleCoverage 未計算時省略，不可把進度方位或亮度當作 AI 判定。Mock mode 模擬成功上傳，不傳送實拍影像。

三組欄位依序對齊，數量相同。任何影格視角 unknown 時，前端會省略整組 viewAngles。這是粗略視角標籤，並非校準後相機姿態。不要自行設定 multipart Content-Type；瀏覽器會加入 boundary。

200 回應（例如 16 張）：

```json
{ "accepted": 16 }
```

前端要求整批接受，accepted 必須等於本次數量。最小版本請以 inspectionId 保存並替換相同影格批次，使網路失敗後可安全重傳；不要在每次重試累加相同影格。正常 mock 掃描產生 16 張 metadata，不含真實影像 bytes；HTTP adapter 會拒絕上傳這些 mock 資料。

## 3. Complete scan / begin analysis

`POST /api/v1/inspections/{inspectionId}/complete`，無 request body。

200 回應：

```json
{ "inspectionId": "insp_2026_001", "status": "processing" }
```

若已完成，也可回傳 completed。此操作須冪等：重複 complete 不應重新啟動同一份分析。未上傳影格可回傳 400；不可處理影像可回傳 422。

## 4. Poll inspection status

`GET /api/v1/inspections/{inspectionId}`

200 回應：

```json
{ "inspectionId": "insp_2026_001", "status": "processing", "progress": 72 }
```

完成時回傳 completed / 100；分析失敗回傳 failed。API 模式每約 1 秒輪詢，整次等待上限為 120 秒；每個 HTTP request 逾時為 15 秒。輪詢逾時或網路失敗可重試；service 保留成功上傳與 complete 的結果，避免重複送出。

## 5. Receive inspection result

`GET /api/v1/inspections/{inspectionId}/result`

只在 completed 後呼叫。200 完整回應：

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
      "boundingBox": { "x": 0.2, "y": 0.3, "width": 0.25, "height": 0.2 },
      "beforeImageUrl": null,
      "afterImageUrl": null,
      "maskImageUrl": null
    }
  ],
  "createdAt": "2026-10-02T00:00:00.000Z"
}
```

最小後端可省略 vehicle / createdAt：HTTP adapter 使用同一 create session 的送出車輛與前端建立時間補齊。建議後端回傳自己的完整資料；前端建立時間僅是 fallback。其餘核心欄位不可省略。missingAreas 可省略，視為空陣列。

無車損且部分漏掃的例子：

```json
{
  "inspectionId": "insp_2026_001",
  "vehicle": {
    "id": "vehicle_001",
    "model": "Toyota Yaris Cross",
    "plate": "RAC-2026"
  },
  "status": "completed",
  "detectionStatus": "no_damage",
  "coverage": 0.75,
  "scanDurationSeconds": 27.4,
  "processingTimeSeconds": 2.84,
  "keyFrameCount": 16,
  "missingAreas": ["right_rear_door"],
  "damages": [],
  "createdAt": "2026-10-02T00:00:00.000Z"
}
```

前端顯示「未偵測到明顯新增車損」與「部分區域未完整掃描 · Unknown」，並註明無車損結論只適用於已完整掃描區域。Unknown 不代表無車損，也不阻止完成示範流程。coverage 數值本身不能推導漏掃部位，請回傳 missingAreas。

## HTTP codes and error behavior

| Code | Meaning                          |
| ---- | -------------------------------- |
| 200  | 成功，上傳、complete、狀態或結果 |
| 201  | session 已建立                   |
| 400  | 輸入無效或缺少影格               |
| 404  | 找不到 inspection                |
| 422  | AI 無法處理影像                  |
| 500  | 後端錯誤                         |
| 503  | AI 服務不可用                    |

錯誤 body 可提供後端診斷資訊，但前端不讀取或顯示原始錯誤 body。NETWORK_ERROR（包含 503 / 連線失敗）、UPLOAD_FAILED（上傳 HTTP 失敗 / 無真實影像）、PROCESSING_FAILED（分析失敗 / failed 狀態）、INVALID_RESPONSE（JSON 或 schema 無效）、TIMEOUT 皆映射為繁體中文提示；詳細資訊僅在 development console 記錄。

## Integration boundaries

前端已實作使用者啟動的真實相機與記憶體影格管線；尚未實作離線持久化、登入認證或 session 恢復。API base URL 是 build-time 公開設定；不可放置密鑰。跨來源測試請讓後端允許前端 origin（例如 localhost:3000）的 GET/POST、Content-Type 與 OPTIONS。正式認證、影像保存策略、upload 大小限制與相機擷取另行約定。
