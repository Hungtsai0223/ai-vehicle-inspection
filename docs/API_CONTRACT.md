# AI Vehicle Inspection API Contract v1

UI → InspectionService → Mock / HTTP adapter → AI backend。契約不依賴模型架構。

## Common conventions

Base URL 使用 `NEXT_PUBLIC_AI_API_URL`，例如 `http://localhost:8000`；下列路徑皆附加到 base URL。開發 HTTP stub base 是 `http://localhost:3000/api/dev`。

- JSON camelCase；`inspectionId` 非空，前端會 URL encode。
- `confidence`、`coverage` 為 0–1；`progress` 為 0–100。
- 影格 metadata `timestamp` 為 **掃描開始後的毫秒**，直接保留 CapturedFrame.timestamp；不是秒，也不是 epoch。報告 duration 欄位為秒。若後端需要絕對時間，需另外約定欄位。
- InspectionStatus：idle / scanning / uploading / processing / completed / failed。
- DetectionStatus：no_damage / potential_damage。missingAreas 獨立代表 Unknown，不能推論為 no_damage。
- DamageType：scratch / dent / paint_damage / contamination / unknown。
- VehiclePart：front_bumper / rear_bumper / hood / trunk / left_front_door / left_rear_door / right_front_door / right_rear_door / left_fender / right_fender / headlight / taillight / wheel / unknown。
- keyFrameCount / accepted 為非負整數；可選 createdAt 為 ISO 8601。

## 1. Create inspection

`POST /api/v1/inspections`，application/json：

```json
{
  "vehicleId": "vehicle_001",
  "vehicleModel": "Toyota Yaris Cross",
  "plate": "RAC-2026"
}
```

201 response：

```json
{ "inspectionId": "insp_001", "status": "scanning" }
```

## 2. Upload key frames

`POST /api/v1/inspections/{id}/frames`，multipart/form-data：

- 重複 **`frames`** 欄位：實際 JPEG/PNG bytes，每個檔名為影格 id.jpg/png。
- **`metadata`**：只出現一次，JSON 字串，順序與影像一致。
- 不再使用 frames[]、timestamps[] 或 viewAngles[]。
- **不可手動指定 Content-Type**；fetch 自動產生 multipart boundary（[MDN 說明](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects)）。

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

vehicleView：front / left / rear / right / unknown；目前由 Prototype 進度估計，並非模型辨識。quality 欄位內 blurScore / exposureScore / vehicleCoverage 可省略；亮度檢查不是車輛覆蓋率。

200 response：

```json
{ "accepted": 16 }
```

accepted 必須等於送出影格數。相同 inspectionId 的批次重傳應替換既有影格，避免重試累加。

## 3. Complete inspection

`POST /api/v1/inspections/{id}/complete`，無 body：

```json
{ "inspectionId": "insp_001", "status": "processing" }
```

已完成可回傳 completed。操作須冪等；重試、重新整理不能重新啟動同一份分析。

## 4. Get status

`GET /api/v1/inspections/{id}`：

```json
{
  "inspectionId": "insp_001",
  "status": "processing",
  "progress": 72,
  "stage": "damage_detection"
}
```

stage：image_validation → vehicle_part_detection → damage_detection → before_after_comparison → completed。完成為 completed / 100；失敗為 failed。前端每約 1 秒輪詢，等待上限 60 秒，單次 request 上限 15 秒；完成、失敗、逾時或頁面卸載後停止。AbortController 取消進行中的讀取。

## 5. Get result

`GET /api/v1/inspections/{id}/result`，只在 completed 後呼叫：

```json
{
  "inspectionId": "insp_001",
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
      "boundingBox": { "x": 0.38, "y": 0.42, "width": 0.18, "height": 0.13 },
      "beforeImageUrl": null,
      "afterImageUrl": "/results/frame_014.jpg",
      "maskImageUrl": null
    }
  ]
}
```

可選 vehicle：`{ "id": "vehicle_001", "model": "Toyota Yaris Cross", "plate": "RAC-2026" }`；可選 createdAt。前端在同一 session 與重新整理後可用輕量車輛資料補齊。

無車損：`detectionStatus: "no_damage"`、`damages: []`，直接 /result，不顯示假 DamageCard。potential_damage 必須至少有一項；damage id 唯一。

boundingBox 可省略或 null；x/y/width/height 為影像座標 0–1，寬高 > 0 且不可超出影像。beforeImageUrl/afterImageUrl/maskImageUrl 可省略或 null，支援 HTTP(S) 或單一 `/` 開頭路徑；相對圖片以 **API origin** 解讀。沒有圖片或載入失敗時顯示 placeholder。Bounding box 僅畫在還車時影像上。

`missingAreas: ["right_rear_door"]` 顯示「部分區域未完整掃描 · Unknown」。就算 detectionStatus=no_damage，這些部位仍是未確認。

## Errors and retries

400 invalid request；404 unknown inspection；409 state conflict；413 upload too large；422 cannot process；500 backend failure；503 service unavailable。UI 僅呈現繁體中文安全錯誤，不讀取或輸出後端原始 traceback。

上傳失敗留在 /scan，影格只保留記憶體供重試。上傳成功立即釋放本機 Blob/URL，之後的 complete 與分析重試只用 inspectionId。sessionStorage 只保存 id、車輛、duration、counts、mode、status、uploadComplete 等輕量資料，沒有照片或結果 JSON；刷新後可從 /analyzing 再取結果。未上傳的 Blob 在刷新後無法恢復。

## AI TEAM MUST RETURN

每項車損：**part、damageType、confidence**；另含唯一 id、isPotentialNewDamage。可選 **boundingBox**、**maskImageUrl**，以及 beforeImageUrl / afterImageUrl。

完整結果需 inspectionId、status、detectionStatus、coverage、scanDurationSeconds、processingTimeSeconds、keyFrameCount、damages，並建議回傳 missingAreas。請確認 status stage、圖片 origin、CORS、accepted 全批確認及 complete 冪等行為。

AI 團隊不需要知道前端 rendering 細節；前端不依賴 YOLO/SAM 版本、PyTorch 架構或 training strategy。
