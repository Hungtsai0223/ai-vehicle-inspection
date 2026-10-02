# Verification · 2026-10-02

## Integration Hardening + Mobile Deployment Readiness

Existing routes and visual design retained. This report supersedes the original MVP verification: real camera capture, HTTP transport and lightweight session recovery are now implemented. The AI model remains outside this repository.

## Automated checks

| Command            | Result                                |
| ------------------ | ------------------------------------- |
| `npm run lint`     | Pass, no warnings                     |
| `npx tsc --noEmit` | Pass                                  |
| `npm test`         | Pass, 36 tests, no failures/skips     |
| `npm run build`    | Pass, Next.js 16.3.8 production build |
| `git diff --check` | Pass                                  |

Tests cover camera permission/session cleanup and JPEG capture, bounded frame storage/key selection, Mock lifecycle, native multipart HTTP transport, result schemas, GET retry limits and abortable backoff, response-body timeout, JPEG/PNG/WebP validation, health states, unknown enums, multiple detections, sample wire JSON and reset scope. No extra browser-test dependency was added.

## Browser verification

Environment: Codex in-app browser, 390 × 844 portrait and 844 × 390 landscape. These checks are not physical iPhone/Android or Desktop Chrome verification.

| Scenario                        | Observed result                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mock full journey               | `/return → /scan-guide → /scan → /analyzing → /damage → /result → /dashboard`; 16 Demo frames; completed return                                                                       |
| HTTP stub full journey          | Same routes; 16 actual Demo JPEG Blobs sent as multipart; complete/status/result succeeded; completed return and dashboard                                                            |
| Health                          | `Test Health` showed Backend Connected/reachable, without creating an inspection                                                                                                      |
| Standalone upload               | `Test Frame Upload` uploaded 16 JPEGs without starting analysis                                                                                                                       |
| Multiple damages                | `/damage` switched among three detections; `/result` showed all three at 91%, 84%, 54% and high/medium/low AI Confidence                                                              |
| Unknown values                  | New backend part/type strings normalized to 未知區域/疑似異常; developer JSON retained raw values                                                                                     |
| No damage                       | `/result` showed no-damage copy and zero damage cards                                                                                                                                 |
| Upload failure and manual retry | First upload returned controlled 500; 16 frames and the same inspection ID remained; user retry succeeded; frame buffer became 0, uploaded=true                                       |
| Refresh during analysis         | Reload at 22% resumed the existing session and reached `/damage`; server log showed one create, one complete, two frame uploads (failure + manual retry), then GET status/result only |
| Refresh completed result/damage | Both automatically re-fetched the same completed inspection without requiring rescan                                                                                                  |
| Reset during processing         | Cancelled development test, cleared ID/counts/result; reload stayed cleared without a late response restoring state                                                                   |
| Portrait layout                 | Result document width 375px ≤ viewport 390px, three result cards visible without horizontal overflow                                                                                  |
| Landscape layout                | Scan width 829px ≤ viewport 844px; portrait suggestion visible and non-blocking                                                                                                       |
| Normal flow console             | No application errors; reduced-motion warning reflects browser preference                                                                                                             |
| Error fixtures                  | Intentional 500/503 logged only safe development diagnostics; normal user messages contain no backend stack                                                                           |

Screenshots saved beside the project: `hardened-result-mobile.png`, `hardened-scan-landscape.png` and `hardened-integration-preview.png`. The result screenshot demonstrates multiple detections, neutral confidence levels and the original layout.

## Production boundary

Local `npm run build` / `npm start` verified `/return` = 200, `/dev/integration` = 404, `/api/dev/health` = 404, and dev inspection GET/POST endpoints = 404. Production does not expose the debug panel or stub. Vercel configuration and public environment presets are documented; no configured Vercel project or Git remote exists here, so no deployment or push was performed.

## Remaining manual validation

Use [MOBILE_TEST_CHECKLIST](MOBILE_TEST_CHECKLIST.md) for Desktop Chrome, physical iPhone Safari and Android Chrome. Camera interruption/background/reopen handling was reviewed and its core lifecycle covered with simulated streams; physical device permission/playback/capture quality has not been tested. Record real phone JPEG sizes and visible damage detail before release.

Connect a reachable HTTPS teammate backend using [AI_BACKEND_HANDOFF](AI_BACKEND_HANDOFF.md), allow the actual frontend origin through CORS, change the public API environment variables, restart/rebuild, then verify all six endpoints and the complete real-camera journey. Actual model compatibility, retention policy and measured accuracy remain pending. Unuploaded in-memory photos cannot survive refresh; reset clears frontend data only. Dashboard metrics and completion remain prototype behavior.
