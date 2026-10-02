# Mobile / Manual Integration Test Checklist

每次記錄日期、裝置、OS、瀏覽器版本、frontend/backend URL、Mock/HTTP、contract 1.0、結果與截圖。桌面 viewport 不能替代實際 iPhone/Android；本次實機欄位保留未測。

| Platform       | Planned setup                    | Status                                 |
| -------------- | -------------------------------- | -------------------------------------- |
| Desktop Chrome | localhost，Mock + HTTP stub      | 待人工 Chrome 執行；Codex IAB 另行驗證 |
| iPhone Safari  | 真實手機、HTTPS frontend/backend | 未測，待實機                           |
| Android Chrome | 真實手機、HTTPS frontend/backend | 未測，待實機                           |

## Main journey (run in both Mock and HTTP)

- [ ] `/` landing renders and start action works.
- [ ] `/return` vehicle data → start scan → `/scan-guide`.
- [ ] Read guide → `/scan`; entry does not request camera permission.
- [ ] Demo Mode → complete ~8 second scan → frame count/key selection.
- [ ] preparing → uploading N key frames → uploaded; no fake byte percentages.
- [ ] Upload must succeed and complete must return before `/analyzing`.
- [ ] Backend stages/progress render; potential_damage → `/damage`, no_damage → `/result`.
- [ ] Multiple detections switch on `/damage`, all appear on `/result`.
- [ ] High/medium/low AI Confidence stays neutral; never responsibility/confirmed damage.
- [ ] Unknown part/type shows fallback; missingAreas remains Unknown, independent of no_damage.
- [ ] Backend images, null URL and broken URL fallback; bounding box only on after image.
- [ ] Finish return → `/dashboard`; dashboard metrics remain clearly MOCK DATA.

## Camera and mobile Safari

- [ ] Choose real camera and press start; user grants permission; inline muted preview starts.
- [ ] Rear-camera preference, aspect ratio and frame capture count verified.
- [ ] Capture four views; minimum 12 frames before finish; video preview keeps device frame rate.
- [ ] JPEG longest edge ≤1280px, quality 0.8; record actual bytes/image on target device.
- [ ] Deny permission → clear message, Demo fallback, enable permission → reopen works.
- [ ] Missing/busy camera → friendly message + retry / Demo.
- [ ] End/interrupt camera track → stopped notice, no continued sampling, reopen works.
- [ ] Background tab, switch apps, lock/unlock → stream stops, reopen camera CTA.
- [ ] Rapid navigation / delayed permission response leaves no active camera tracks.
- [ ] Landscape shows non-blocking portrait suggestion; no orientation lock or reload.
- [ ] Safari playsInline/muted/user-triggered play works; no reliance on device labels before permission.
- [ ] Memory stays bounded; unused object URLs revoked on upload/reset/leave.

## Network / session recovery

Use HTTP local stub with `?failure=upload_failure`, `?result=result_timeout`, dev integration selectors, or an actual controlled backend outage. Do not delete backend data to simulate UI reset.

- [ ] `Test Health` GET /health → reachable; no new inspection ID.
- [ ] Missing/malformed health → unknown; offline/503 → unreachable; only debug interface shows indicator.
- [ ] Test Create performs a single POST; Test Frame Upload sends JPEG multipart without completing.
- [ ] `Test 503 Error` displays friendly Chinese; no backend traceback.
- [ ] Disable network before upload → not sent notice; reconnect → manually「重新上傳」same id.
- [ ] Upload-failure retry retains images, succeeds, then frame buffer is empty.
- [ ] Refresh `/analyzing` after successful upload → resume GET polling with same id; no duplicate loop or complete POST.
- [ ] Refresh `/damage` and `/result` → automatically re-fetch completed result, no rescan.
- [ ] GET retries ≤2 for transient failures; 4xx/invalid JSON no retry; create/upload POST no automatic replay.
- [ ] 60-second analysis timeout preserves session;「重新取得結果」restarts polling.
- [ ] Leave analysis while waiting → AbortController stops request and next poll.
- [ ] Reset during a dev test cancels it; id/result/counts cleared, storage only own key removed.
- [ ] Reload before upload: images cannot recover (memory only); honest rescan prompt.
- [ ] Expired/deleted backend session: friendly error/retry, no fabricated results.

## Deployment / privacy

- [ ] Build/start succeeds; production /dev/integration and all /api/dev endpoints 404.
- [ ] Vercel Preview uses Mock=true, or HTTPS teammate API with false; never localhost or /api/dev.
- [ ] CORS allows actual frontend origin; backend/image HTTPS reachable from phone.
- [ ] NEXT_PUBLIC variables contain no secrets; environment change gets new build/deploy.
- [ ] Prototype privacy wording present; no claim of encryption, never storing or automatic deletion.
- [ ] Full flow keyboard/390×844 portrait/844×390 landscape without horizontal overflow.

No Playwright dependency was added: this repo uses built-in Node reliability tests and an interactive Codex IAB flow. Hardware camera checks remain manual.
