# Vercel Deployment

此專案使用 Next.js 16.3.8 App Router、React 19.3 與 npm。`app/demo/page.tsx` 提供 `/demo`；本機 production 由 `next start --port 3001` 提供頁面。公開部署不依賴本機 server。

## Current deployment · 2026-10-03

- Production：[ai-vehicle-inspection.vercel.app](https://ai-vehicle-inspection.vercel.app)。
- 公開 Demo：[ai-vehicle-inspection.vercel.app/demo](https://ai-vehicle-inspection.vercel.app/demo)，不需 Vercel 登入。
- 已驗證 Preview：[Preview /demo](https://ai-vehicle-inspection-lmigg341z-ralf-tsai-s-projects.vercel.app/demo)，保留 Vercel 帳號保護。
- Vercel project：ralf-tsai-s-projects / ai-vehicle-inspection，已連結 private GitHub repo 的 main 分支。
- 下列三個 Demo 變數已透過 CLI 同時設定至 Preview／Production；目前無需到 Dashboard 手動補值。
- 首頁、/demo 重新載入、主要路由、21 個 CSS／JS／圖片資源均正常；公開 Demo 的五種指定尺寸與結果／重設操作已驗證。
- 實機 iPhone Safari／Android Chrome 相機權限與拍攝仍待測試，真實 AI 尚未串接。

雲端 build 成功。非阻擋警告包含 ESLint 9 的支援期限、5 項 ESLint 工具鏈高風險 audit 項目，以及 unrs-resolver postinstall 未列入 npm allowScripts；未使用 audit fix --force 或升降主要框架版本。`npm audit --omit=dev` 為 0 項漏洞。

## Project settings

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| CLI working directory | `outputs/ai-vehicle-inspection`，包含 package.json 的目錄 |
| Root Directory | CLI 從專案根目錄部署時為 `.`；若 GitHub repository 直接包含專案檔案，同樣為 `.` |
| Install Command | `npm install`（可使用 lockfile 的 `npm ci`） |
| Build Command | `npm run build` |
| Output Directory | 保留 Next.js preset 預設；本機輸出為 `.next`，不用 `dist` 或 static export |
| Node.js | 建議 Vercel 支援的 Node.js 24 LTS；Next.js 至少需要 20.9 |

## Preview and Production environment

| Variable | Hackathon demo value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_MOCK_AI` | `true` | 展示使用 Mock，不需要 AI backend |
| `NEXT_PUBLIC_DEMO_RESULT` | `potential_damage` | 也支援 no_damage、multiple_damage、unknown_area、backend_error |
| `NEXT_PUBLIC_ENABLE_DEMO` | `true` | 明確啟用展示捷徑與備援 |
| `NEXT_PUBLIC_AI_API_URL` | 不設定 | Mock 不使用；真實串接才設定團隊 HTTPS backend URL |

上述值不是秘密。所有 NEXT_PUBLIC 變數會公開於瀏覽器，不能放 API key、password 或 token。Preview 與 Production 均設定，變更後重新部署。

不要在正式 HTTP 模式使用 `/api/dev`、localhost 或本機 IP；`/api/dev` 與 `/dev/integration` 在 production 回 404。接真實 AI 時設定 Mock=false、團隊 HTTPS API URL、ENABLE_DEMO=false，並設定 backend CORS 為實際前端 HTTPS origin。

`.gitignore` 與 `.vercelignore` 排除環境檔、node_modules、建置輸出、臨時影像與除錯檔。`.vercel` 連線資訊不進 Git。

## CLI deployment sequence

從本專案根目錄執行：

```bash
npm install
npm run build
npx vercel login
npx vercel
```

依提示選擇自己的帳號／團隊、建立或連結專案，維持上述 Next.js 設定。在 Vercel Dashboard 設定 Preview／Production 環境變數，再部署 Preview。

Preview 驗證首頁、`/demo`、重新整理 `/demo`、展示結果捷徑、圖片與手機版。通過後：

```bash
npx vercel --prod
```

再次驗證 Production；以未登入的瀏覽器確認公開網址可達。若 Preview 有帳號保護，只作預覽驗證；Production 須符合公開展示需求。相機在 Vercel HTTPS 網址可取得安全來源，實際鏡頭／權限仍需 iPhone Safari 與 Android Chrome 驗證。

## GitHub

Private repository：[Hungtsai0223/ai-vehicle-inspection](https://github.com/Hungtsai0223/ai-vehicle-inspection)，`origin` 已連結 HTTPS remote，主分支為 `main`。Repository 根目錄直接包含 package.json；從 GitHub 匯入 Vercel 時，Root Directory 使用 `.`，不要再填本機的 outputs 路徑。

若使用 Vercel 的 GitHub 匯入功能，選擇此 private repository；CLI 也可從同一專案根目錄部署。更新專案後：

```bash
git push origin main
```

不要把 GitHub 或 Vercel 登入 token 放進 repository 或公開環境變數。

參考：[Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)、[Vercel CLI deploy](https://vercel.com/docs/cli/deploy)、[Vercel CLI login](https://vercel.com/docs/cli/login)。
