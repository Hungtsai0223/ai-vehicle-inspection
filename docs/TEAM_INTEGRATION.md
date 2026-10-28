# 同學分支整合與接線狀態（2026-10-28）

## GitHub 檢查結果

- `main` 原基礎 `ac4ab3b` 已合併 Next.js 16.4.3 與 HTTP 安全標頭。工作站原先停在 `68e59b6`，已先 fast-forward 更新。
- `feature/keyframe-extraction`（`f072a42`）內已 merge `feature/3d-damage-mapping`（`2f318b5`）。整合分支以一次 merge 保留兩人的四筆提交，不重寫歷史。
- 兩個同學分支與 main 沒有檔案衝突，但 Python CLI、照片 API 與 Next.js 原本不是同一條資料流程。
- 另有五個 Dependabot PR：React、Framer Motion、Lucide、Node 型別與 Prettier。此輪維持既有 UI 依賴版本；只更新既有範圍內的間接 Zod 依賴，修復 npm audit 發現的開發工具高風險項目。大版本更新應各自驗證。
- Repository 目前 GitHub visibility 為 Public；此整合沒有變更可見性或任何存取權限。

## 可以使用與仍待完成的部分

| 子系統             | 本次可執行內容                                                                       | 與正式還車流程的關係                                              |
| ------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Python 關鍵影格    | 影片解碼、原圖對照、亮度處理、ORB/RANSAC、CLI 與測試                                 | 可從開發匯入頁送入現有五端點；不推論車輛角度                      |
| Next.js 開發匯入頁 | 驗證 metadata/JPEG、秒轉毫秒、最多 16 張、原始曝光、HTTP upload/complete/poll/result | `/dev/integration`，production 仍回 404；API 模式可接回既有結果頁 |
| 照片差異 API       | 成對圖片差分、檔案/數量/尺寸驗證、可追蹤的 nested results                            | 與 `/api/v1/inspections` 不相容，不能把它直接填成 AI_API_URL      |
| 3D 檢視            | 模型載入、多組照片切換、實際像素尺寸、差異點與近似投射                               | 獨立原型，沒有相機校正、可信 2D/3D 對應或車損分類模型             |
| 既有還車 UI        | /demo、/scan 與原 API contract                                                       | 維持原功能；沒有把像素差異偽裝成 AI 車損結果                      |

### 啟動 Python 子系統

從 repository 根目錄：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.lock -e ./vehicle_keyframes
python -m vehicle_keyframes.cli 0001-1000.mp4 --output vehicle_keyframes/output/car01 --sample-seconds 0.3 --no-save-rejected
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Windows 使用 `.venv\Scripts\Activate.ps1` 啟用環境。執行影片工具不需啟動 HTTP API。`--output` 必須是新目錄。`--no-save-rejected` 只關閉被排除照片的診斷寫檔，保留 metadata；原預設仍可輸出完整診斷。關閉前處理時，品質分析從原本重複兩次減為一次。Config 與 CLI 共用門檻檢查。

開啟 `http://127.0.0.1:8000/` 是獨立照片差異／3D 工具，`/docs` 為 FastAPI 文件。頁面使用 same-origin `/api/compare-damage-batch`，不再把 API 固定指向另一台機器的 localhost。3D 套件沿用同學指定的 Three.js 0.160.0 CDN；需網路與 WebGL，缺少時不能證明模型渲染成功。Python 只提供指定 HTML、JS 與 GLB，不公開整個 repository。

### 將影片影格接回系統

1. 開發前端預設 API URL `/api/dev` 可驗證 HTTP 協定，stub 不執行 AI。接隊友正式模型時，將 `NEXT_PUBLIC_USE_MOCK_AI=false`、`NEXT_PUBLIC_AI_API_URL` 設為實作 [API_CONTRACT](API_CONTRACT.md) 的 HTTPS 服務。
2. `npm run dev -- --port 3001`，開啟 `/dev/integration` →「匯入同學的關鍵影格」。
3. 選該次 `metadata.json`，再選 `images_original` 的 JPEG；若當次關閉前處理，才使用 `images`。檔案選擇器只讀到檔名，無法驗證同名圖是否遭修改，操作者須選正確原始目錄。
4. 按「驗證影格資料」只做本機檢查。檢查成功後才可按「上傳關鍵影格並分析」，送到頁面顯示的 API。最大 metadata 2 MiB、候選 5000、選定 16、每張 16 MiB、選定總量 64 MiB。
5. 已知影格 timestamp_seconds ×1000，保留 chronological order。geometry 不是 viewpoint，全部維持 vehicleView=unknown。原始 mean_luma/255 可作 exposureScore，Laplacian variance 不等同前端 blurScore，不直接搬入；CLAHE 圖不自動成為車損證據。
6. 仍使用原 create → multipart `frames` + `metadata` → complete → poll → result；不增加或改寫後端必填欄位。取消／重設會中斷讀取，沒有聲稱撤回伺服器已收下的請求。失敗後重新送出會建立新的檢查，不代表背景續傳。
7. API 模式的完成結果可由同頁下方連結進入現有 `/damage`／`/result`；Mock 模式只在開發頁呈現這次測試回應，不把外部服務 id 存成 Mock 檢查。

### 照片差分與 3D 的限制

`main.py` 不是車損 AI。它使用 `damage_detector.py` 的像素差分，光線、背景、視角與尺寸改變都可能產生差異。空清單只代表沒有超過當前差分門檻，不是 no_damage 的證據；不產生虛構 confidence 或 InspectionResult。HTTP 回應保留原 `results[].damages[]`，新增實際影像尺寸、coordinate_space、resized 與 calibrated=false。

已修正：JSON 層級、0 座標被預設值取代、1920×1080 固定比例、多組只顯示第一組、HTTP error 顯示、物件 URL/WebGL 清理、車模尺寸正規化與版面溢出，以及無效 homography 導致的 OpenCV crash。上傳最多 12 組、每張 8 MiB、16MP；前後數量不符回 422，不再 zip 靜默漏掉資料。CPU 比對移出 async event loop。CORS 預設僅本機開發 origin，若獨立前端需要跨來源，可設定 Python `POC_ALLOWED_ORIGINS`；這不是 Next.js 的 NEXT_PUBLIC 變數。

近似投射固定從模型一側發射射線，沒有使用真實相機姿態。原 `pnp_mapping_poc.py` 也只使用合成點與估計內參；尚未證明模型部位或世界座標精度。GLB 車型與目前 UI 的 Yaris Cross 不同，不能當作已校準車輛。下一階段需要隊友提供：車型/座標定義、相機內參、可信 feature correspondences、前後照片配對規則、視角/車損模型，以及契約 1.0 的 inspection service。

## 部署與測試

Next.js 不啟動 Python；Vercel 仍用既有 Next.js preset。`.vercelignore` 排除 Python 依賴、影片與 GLB，正式頁面不增加 3D bundle。獨立 Python 服務尚未部署，沒有設定新的 production API URL。

```bash
npm test
npm run lint
npm run typecheck
npm run build
python -m unittest discover -s vehicle_keyframes/tests -v
python -m unittest discover -s poc_tests -v
```

GitHub Actions 加入 Python 子系統測試，以及前端 lint/typecheck；npm production audit 與既有測試/build 持續保留。Python lock 記錄本次測試的解析版本，更新依賴後須重新驗證。當前 Starlette TestClient 對舊 HTTPX 介面有 deprecation warning，現有測試可正常通過；尚未切換未驗證的新 HTTP client。
