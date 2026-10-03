# AI Team Integration Checklist · Contract 1.0

先填以下資訊並用 [AI_BACKEND_HANDOFF](AI_BACKEND_HANDOFF.md) 的 curl 完成六端點測試，再替換 Mock。此清單不要求特定模型、訓練框架或真實推論策略。

- [ ] Backend HTTPS URL（手機可達；是否有 base path）、實際前端 origin 的 CORS / OPTIONS。
- [ ] GET /health 回傳 200 `{ "status": "ok" }`。
- [ ] 接受的 JPEG / PNG / WebP 格式；單張與整批最大 bytes；支援最長邊 1280 px / quality 0.8。
- [ ] 預期／最小／最大影格數；目前 frontend 最多選 16 張，一次 multipart 上傳。
- [ ] 重複 frames 檔案 + 一次 metadata JSON；timestamp 是掃描起始後毫秒，vehicleView 為估計。
- [ ] Create、upload accepted count、complete、status、result schema 與 contract 1.0 相容。
- [ ] Damage type values：scratch / dent / paint_damage / contamination / unknown，新增值前先通知。
- [ ] Vehicle part values 與 API_CONTRACT 一致；未知非空值會顯示 fallback，不會校準新車體標記。
- [ ] Confidence、coverage 有限數值 0–1；progress 0–100。
- [ ] Bounding box 的 x/y/width/height 為影像 normalized 0–1，框不越界；w/h > 0。
- [ ] Mask 圖片格式、透明度、尺寸、可達 HTTPS URL；before/after/mask 可 null/省略。
- [ ] Processing stage、平均／最長處理時間與 timeout：約每秒 poll，前端總等待 60 秒，讀取 10 秒、upload 30 秒、一般 15 秒。
- [ ] 同一 inspection ID 的重傳去重；complete 冪等；GET 可 retry，POST 不自動重送。
- [ ] no_damage 的 damages=[]；potential_damage 至少一項；missingAreas 與檢測結論分開。
- [ ] 結果／影像保存期足以重新整理恢復，確認正式影像保存、存取與隱私政策。
- [ ] 使用兩份 docs/examples JSON 相容性測試；以真實資料取代 Demo 占位圖。
- [ ] 驗證 500/503、網路中斷、upload retry、refresh during processing，錯誤不回公開 traceback。
- [ ] NEXT_PUBLIC_USE_MOCK_AI=false、NEXT_PUBLIC_AI_API_URL=團隊 HTTPS URL；真實服務 NEXT_PUBLIC_ENABLE_DEMO=false；重新 build/deploy。
- [ ] iPhone Safari / Android Chrome 真實相機完整流程依 MOBILE_TEST_CHECKLIST 執行。
- [ ] 3D 實驗依 ExperimentResult[] 填入 data/experiment-results.ts；沒有實測前保持空陣列。

AI model implementation 與實驗結論仍由團隊提供；前端不會從 Demo 數字推導科學成效。
