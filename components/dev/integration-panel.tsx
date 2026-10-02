"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useInspection } from "@/components/inspection/inspection-context";
import { Button, Action } from "@/components/ui/primitives";
import { HttpInspectionApi } from "@/services/http-inspection-api";
import {
  createInspectionService,
  inspectionErrorMessage,
} from "@/services/inspection-service";
import {
  checkBackendHealth,
  type BackendHealth,
} from "@/services/backend-health";
import { API_CONTRACT_VERSION, getApiBaseUrl } from "@/lib/api-config";
import { BackendStatusIndicator } from "./backend-status-indicator";
import { pollInspection } from "@/services/poll-inspection";
import { createMockFrame } from "@/lib/mock-frames";
import {
  isDevelopmentStub,
  materializeDemoFrames,
} from "@/lib/dev-demo-frames";
import { releaseFramePreview } from "@/lib/frame-store";
import { stubResults, stubFailures } from "@/lib/dev-stub-options";
import type { CapturedFrame } from "@/types/frame";
import type { InspectionResult } from "@/types/inspection";
const subscribe = () => () => {};
const cameraAvailable = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  window.isSecureContext;
export function IntegrationPanel() {
  const ctx = useInspection();
  const router = useRouter();
  const camera = useSyncExternalStore(subscribe, cameraAvailable, () => false);
  const [health, setHealth] = useState<BackendHealth>("unknown");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [lastId, setLastId] = useState("");
  const [lastUpload, setLastUpload] = useState(0);
  const [lastStatus, setLastStatus] = useState("—");
  const [lastResult, setLastResult] = useState<InspectionResult | null>(null);
  const [resultMode, setResultMode] = useState("potential_damage");
  const [failure, setFailure] = useState("none");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const baseUrl = getApiBaseUrl();
  const stub = isDevelopmentStub(baseUrl);
  function service(mode: string, selectedFailure = failure) {
    const url = new URL(baseUrl, window.location.origin);
    if (stub) {
      url.searchParams.set("result", mode);
      url.searchParams.set("failure", selectedFailure);
    }
    return createInspectionService(new HttpInspectionApi(url.href), "API");
  }
  async function testHealth() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setMessage("");
    const state = await checkBackendHealth(baseUrl, {
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    setHealth(state);
    setBusy(false);
    setMessage(
      state === "reachable"
        ? "GET /health 成功，沒有建立 inspection。"
        : state === "unknown"
          ? "後端尚未提供有效的 health 回應。"
          : "無法連線至後端，請確認 URL 與 CORS。",
    );
  }
  async function run(
    kind:
      | "create"
      | "upload"
      | "potential_damage"
      | "no_damage"
      | "selected"
      | "503",
  ) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setMessage("");
    setLastResult(null);
    setLastUpload(0);
    let generated: CapturedFrame[] = [];
    try {
      const api = service(
        kind === "selected"
          ? resultMode
          : kind === "no_damage"
            ? "no_damage"
            : "potential_damage",
        kind === "503" ? "503" : failure,
      );
      const session = await api.createInspection(
        { vehicle: ctx.vehicle },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setLastId(session.inspectionId);
      setLastStatus(session.status);
      if (kind === "create") {
        setMessage(
          "HTTP create 成功；建立了一筆空的檢查紀錄，未自動重試 POST。",
        );
        return;
      }
      if (!stub) {
        setMessage(
          "外部後端請使用真實相機流程。Demo JPEG 僅送至開發 HTTP stub。",
        );
        return;
      }
      generated = await materializeDemoFrames(
        Array.from({ length: 16 }, (_, i) => createMockFrame(i, i * 500)),
      );
      if (controller.signal.aborted) return;
      setLastStatus("uploading");
      const receipt = await api.uploadInspectionFrames(
        session.inspectionId,
        generated,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setLastUpload(receipt.accepted);
      setLastStatus("uploaded");
      generated.forEach(releaseFramePreview);
      generated = [];
      if (kind === "upload") {
        setMessage("16 張 JPEG multipart 上傳成功；本測試不啟動分析。");
        return;
      }
      await api.completeInspection(session.inspectionId, {
        signal: controller.signal,
      });
      const result = await pollInspection(
        api,
        session.inspectionId,
        (status) =>
          setLastStatus(
            `${status.status} · ${status.stage} · ${Math.round(status.progress)}%`,
          ),
        { signal: controller.signal, vehicle: ctx.vehicle },
      );
      if (controller.signal.aborted) return;
      setLastResult(result);
      setMessage(
        "HTTP create → JPEG multipart → complete → poll → result 成功。",
      );
      if (ctx.mode === "API") ctx.acceptCompletedResult(result);
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessage(inspectionErrorMessage(error));
        setLastStatus("failed");
      }
    } finally {
      generated.forEach(releaseFramePreview);
      if (abort.current === controller && !controller.signal.aborted)
        setBusy(false);
    }
  }
  function reset() {
    abort.current?.abort();
    ctx.resetInspection();
    setBusy(false);
    setMessage("本次 inspection session 與影格已清除。");
    setLastId("");
    setLastUpload(0);
    setLastStatus("idle");
    setLastResult(null);
    setHealth("unknown");
  }
  return (
    <div className="page integration-page">
      <h1>HTTP Integration</h1>
      <p className="lead">
        僅開發環境使用。Stub 不執行 AI；測試影格是標記 DEMO 的實際 JPEG bytes。
      </p>
      <BackendStatusIndicator mode={ctx.mode} health={health} />
      <dl className="summary-grid">
        {[
          ["Frontend Mode", ctx.mode === "API" ? "HTTP" : "MOCK"],
          ["API URL", baseUrl],
          ["Backend Health", health],
          ["Camera Availability", camera ? "available" : "unavailable"],
          [
            "Environment",
            `${process.env.NODE_ENV} · Contract ${API_CONTRACT_VERSION}`,
          ],
          ["Last Inspection ID", lastId || ctx.inspectionId || "—"],
          [
            "Last Upload Frame Count",
            `${lastUpload || (ctx.uploadComplete ? ctx.keyFrameCount : 0)} frames`,
          ],
          [
            "Current Inspection Status",
            lastStatus === "—" ? ctx.status : lastStatus,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <small>
        Camera Availability 僅檢查瀏覽器支援與
        HTTPS，尚未請求權限或確認相機硬體。
      </small>
      <div className="integration-actions">
        <Button disabled={busy} onClick={() => void testHealth()}>
          Test Health
        </Button>
        <Button disabled={busy} onClick={() => void run("create")}>
          Test Create Inspection
        </Button>
        <Button disabled={busy || !stub} onClick={() => void run("upload")}>
          Test Frame Upload
        </Button>
        <Button
          disabled={busy || !stub}
          onClick={() => void run("potential_damage")}
        >
          Test Potential Damage
        </Button>
        <Button disabled={busy || !stub} onClick={() => void run("no_damage")}>
          Test No Damage
        </Button>
        <Button disabled={busy || !stub} onClick={() => void run("503")}>
          Test 503 Error
        </Button>
        <Button className="secondary" onClick={reset}>
          Reset Session
        </Button>
      </div>
      {stub && (
        <fieldset disabled={busy}>
          <legend>HTTP stub 測試情境</legend>
          <label>
            結果
            <select
              value={resultMode}
              onChange={(e) => setResultMode(e.target.value)}
            >
              {stubResults.map((mode) => (
                <option key={mode}>{mode}</option>
              ))}
            </select>
          </label>
          <label>
            網路失敗
            <select
              value={failure}
              onChange={(e) => setFailure(e.target.value)}
            >
              {stubFailures.map((mode) => (
                <option key={mode}>{mode}</option>
              ))}
            </select>
          </label>
          <Button disabled={busy} onClick={() => void run("selected")}>
            執行情境
          </Button>
        </fieldset>
      )}
      <p role="status">{busy ? "正在執行 HTTP 測試…" : message}</p>
      {busy && (
        <Button
          className="secondary"
          onClick={() => {
            abort.current?.abort();
            setBusy(false);
            setMessage("已停止測試");
          }}
        >
          停止測試
        </Button>
      )}
      <h2>Last Result</h2>
      {lastResult || ctx.result ? (
        <>
          {ctx.mode === "API" && (
            <Action
              href={
                (lastResult ?? ctx.result)?.detectionStatus ===
                "potential_damage"
                  ? "/damage"
                  : "/result"
              }
            >
              查看測試結果
            </Action>
          )}
          <pre>{JSON.stringify(lastResult ?? ctx.result, null, 2)}</pre>
        </>
      ) : (
        <p>—</p>
      )}
      <Button
        disabled={busy || !ctx.sessionReady}
        className="secondary"
        onClick={() => router.push("/scan")}
      >
        測試完整掃描流程
      </Button>
    </div>
  );
}
