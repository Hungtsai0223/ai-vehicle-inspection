"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useInspection } from "@/components/inspection/inspection-context";
import { Button, Action } from "@/components/ui/primitives";
import { HttpInspectionApi } from "@/services/http-inspection-api";
import {
  createInspectionService,
  inspectionErrorMessage,
  InspectionApiError,
} from "@/services/inspection-service";
import { pollInspection } from "@/services/poll-inspection";
import { createMockFrame } from "@/lib/mock-frames";
import {
  isDevelopmentStub,
  materializeDemoFrames,
} from "@/lib/dev-demo-frames";
import { releaseFramePreview } from "@/lib/frame-store";
import { stubResults, stubFailures } from "@/lib/dev-stub-options";
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
  const [reachable, setReachable] = useState("尚未測試");
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
  const baseUrl = process.env.NEXT_PUBLIC_AI_API_URL ?? "http://localhost:8000";
  const stub = isDevelopmentStub(baseUrl);
  function service(mode: string) {
    const url = new URL(baseUrl, window.location.origin);
    if (stub) {
      url.searchParams.set("result", mode);
      url.searchParams.set("failure", failure);
    }
    return createInspectionService(new HttpInspectionApi(url.href), "API");
  }
  async function run(
    kind:
      "connection" | "create" | "potential_damage" | "no_damage" | "selected",
  ) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setMessage("");
    let generated = [] as ReturnType<typeof createMockFrame>[];
    try {
      const api = service(
        kind === "selected"
          ? resultMode
          : kind === "no_damage"
            ? "no_damage"
            : "potential_damage",
      );
      const session = await api.createInspection(
        { vehicle: ctx.vehicle },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setReachable("reachable");
      setLastId(session.inspectionId);
      setLastStatus(session.status);
      if (kind === "connection" || kind === "create") {
        setMessage("HTTP create 成功；此測試會建立一筆空的開發檢查紀錄。");
        return;
      }
      if (!stub) {
        setMessage(
          "外部後端請使用真實相機流程。產生的 Demo JPEG 僅送至開發 HTTP stub。",
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
      );
      if (controller.signal.aborted) return;
      setLastUpload(receipt.accepted);
      generated.forEach(releaseFramePreview);
      generated = [];
      await api.completeInspection(session.inspectionId);
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
      ctx.acceptCompletedResult(result);
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessage(inspectionErrorMessage(error));
        setLastStatus("failed");
        if (
          error instanceof InspectionApiError &&
          error.code === "NETWORK_ERROR"
        )
          setReachable("unavailable");
      }
    } finally {
      generated.forEach(releaseFramePreview);
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="page integration-page">
      <h1>HTTP Integration</h1>
      <p className="lead">
        僅開發環境使用。Stub 不執行 AI；測試影格是標記 DEMO 的實際 JPEG bytes。
      </p>
      <dl className="summary-grid">
        {[
          ["Frontend mode", ctx.mode === "API" ? "HTTP" : "MOCK"],
          ["API URL", baseUrl],
          ["Camera", camera ? "available" : "unavailable"],
          ["Inspection service", reachable],
          ["Last inspection ID", lastId || ctx.inspectionId || "—"],
          [
            "Last upload",
            `${lastUpload || (ctx.uploadComplete ? ctx.keyFrameCount : 0)} frames`,
          ],
          ["Last backend status", lastStatus === "—" ? ctx.status : lastStatus],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="integration-actions">
        <Button disabled={busy} onClick={() => void run("create")}>
          Test Create Inspection
        </Button>
        <Button disabled={busy} onClick={() => void run("connection")}>
          Test API Connection
        </Button>
        <Button disabled={busy || !stub} onClick={() => void run("no_damage")}>
          Test No Damage
        </Button>
        <Button
          disabled={busy || !stub}
          onClick={() => void run("potential_damage")}
        >
          Test Potential Damage
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
      {lastResult && (
        <>
          <Action
            href={
              lastResult.detectionStatus === "potential_damage"
                ? "/damage"
                : "/result"
            }
          >
            查看測試結果
          </Action>
          <pre>{JSON.stringify(lastResult, null, 2)}</pre>
        </>
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
