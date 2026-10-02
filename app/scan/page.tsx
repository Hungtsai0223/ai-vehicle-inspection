"use client";
import { useState, useSyncExternalStore } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import {
  ScanOverlay,
  ScanProgress,
  CoverageIndicator,
} from "@/components/scan/scan-components";
import { DemoControls } from "@/components/scan/demo-controls";
import { useVehicleScan } from "@/components/scan/use-vehicle-scan";
import { useInspection } from "@/components/inspection/inspection-context";
import { getPreferredCameraMode } from "@/lib/camera-access";
import type { CameraMode } from "@/types/camera";
import type { ScanState } from "@/types/inspection";
const subscribe = () => () => {};
const serverMode = (): CameraMode => "demo";
export default function Scan() {
  const ctx = useInspection();
  const preferredMode = useSyncExternalStore(
    subscribe,
    getPreferredCameraMode,
    serverMode,
  );
  const [selectedMode, setSelectedMode] = useState<CameraMode | null>(null);
  const mode = selectedMode ?? preferredMode;
  const [validation, setValidation] = useState<ScanState>("good");
  const scan = useVehicleScan();
  const exposure = ctx.frames[ctx.frames.length - 1]?.quality.exposureScore;
  const realValidation: ScanState =
    exposure !== undefined && exposure < 0.15 ? "too_dark" : "good";
  function changeMode(value: CameraMode) {
    scan.reset();
    setSelectedMode(value);
    ctx.setCameraMode(value);
  }
  function primaryAction() {
    if (scan.phase === "upload-error") void scan.retryUpload();
    else if (mode === "real" && scan.phase === "scanning") scan.finish();
    else {
      setSelectedMode(mode);
      scan.start(mode);
    }
  }
  return (
    <div className={`scan-page ${mode === "real" ? "real-scan" : ""}`}>
      <p className="scan-vehicle-name">{ctx.vehicle.model}</p>
      <ScanOverlay
        state={mode === "real" ? realValidation : validation}
        progress={scan.prototypeProgress}
        mode={mode}
        scanActive={scan.phase === "scanning" && ctx.status === "scanning"}
        cameraRequested={scan.cameraRequested}
        cameraRequestId={scan.cameraRequestId}
        cameraPermission={scan.cameraState}
        onFrameCapture={scan.onFrameCapture}
        onCameraReady={scan.onCameraReady}
        onCameraStateChange={scan.onCameraStateChange}
        onCaptureError={scan.onCaptureError}
        onUseDemo={() => changeMode("demo")}
        getCaptureMetadata={scan.getCaptureMetadata}
      />
      <div className="scan-bottom">
        <fieldset
          className="camera-mode-selector"
          disabled={
            scan.phase === "complete" ||
            scan.phase === "upload-error" ||
            !ctx.sessionReady
          }
        >
          <legend className="sr-only">拍攝模式</legend>
          <button
            type="button"
            aria-pressed={mode === "real"}
            onClick={() => {
              if (mode !== "real") changeMode("real");
            }}
          >
            真實相機
          </button>
          <button
            type="button"
            aria-pressed={mode === "demo"}
            onClick={() => {
              if (mode !== "demo") changeMode("demo");
            }}
          >
            Demo 模式
          </button>
        </fieldset>
        {mode === "real" && (
          <p className="camera-privacy-note">
            Prototype
            版本中的影像僅用於本次車況檢測流程；實際正式服務的保存與隱私政策需依營運規範訂定。
            <small>
              目前只暫存在瀏覽器記憶體。
              {ctx.mode === "API"
                ? "選定影格將上傳至設定的分析服務，伺服器保存策略另定。"
                : "本次使用 Mock AI，不會上傳相機影像。"}
            </small>
          </p>
        )}
        <p className="portrait-suggestion">
          建議將手機保持直立，以獲得較完整的掃描畫面。
        </p>
        {scan.phase === "complete" && (
          <p className="scan-complete" role="status">
            <CheckCircle size={18} />
            {ctx.transferStage === "uploading"
              ? `正在上傳 ${ctx.keyFrameCount} 張關鍵影格`
              : ctx.transferStage === "uploaded"
                ? "影像上傳完成，正在準備分析"
                : "正在準備影像"}
            <small>{ctx.keyFrameCount} 張關鍵影格</small>
          </p>
        )}
        <ScanProgress
          progress={scan.prototypeProgress}
          prototype={mode === "real"}
        />
        <CoverageIndicator
          progress={scan.prototypeProgress}
          incomplete={
            mode === "demo" &&
            ctx.mode === "MOCK" &&
            ctx.scenario === "incomplete"
          }
          prototype={mode === "real"}
        />
        <div className="frame-capture-count" role="status">
          已擷取影格 <b>{ctx.capturedFrameCount}</b>
        </div>
        {mode === "real" && (
          <p className="prototype-progress-note">
            四面拍攝後，按「完成掃描」。進度與方位是時間引導，並非車輛覆蓋偵測。
          </p>
        )}
        {mode === "demo" && ctx.mode === "MOCK" && ctx.poorNetwork && (
          <p role="status" className="notice">
            網路連線中斷，目前掃描結果尚未成功送出。
            <small>
              Demo：僅模擬提示，需按「重新上傳」重試，尚未實作背景上傳。
            </small>
          </p>
        )}
        {mode === "demo" &&
          ctx.mode === "MOCK" &&
          ctx.scenario === "incomplete" && (
            <p className="notice">
              右側車身未完整掃描 · Unknown
              <small>仍可完成檢查，交由後續人工確認。</small>
            </p>
          )}
        {scan.error && (
          <p role="alert" className="notice">
            {scan.phase === "upload-error" && !ctx.uploadComplete && (
              <strong>
                影像上傳失敗
                <br />
              </strong>
            )}
            {scan.error}
          </p>
        )}
        <Button
          onClick={primaryAction}
          disabled={
            !ctx.sessionReady ||
            scan.phase === "complete" ||
            scan.phase === "opening" ||
            (scan.phase === "scanning" && (mode === "demo" || !scan.canFinish))
          }
        >
          {scan.phase === "upload-error"
            ? ctx.uploadComplete
              ? "重新準備分析"
              : "重新上傳"
            : scan.phase === "complete"
              ? "掃描完成，準備分析…"
              : scan.phase === "opening"
                ? mode === "real"
                  ? "正在開啟相機…"
                  : "正在準備掃描…"
                : scan.phase === "scanning"
                  ? mode === "real"
                    ? "完成掃描"
                    : "正在擷取影像…"
                  : mode === "real"
                    ? scan.cameraState !== "idle"
                      ? "重新開啟相機"
                      : "開始真實掃描"
                    : "開始模擬掃描"}
        </Button>
        {mode === "demo" && ctx.mode === "MOCK" && (
          <DemoControls
            state={validation}
            onStateChange={setValidation}
            scenario={ctx.scenario}
            onScenarioChange={ctx.setScenario}
            poorNetwork={ctx.poorNetwork}
            onNetworkChange={ctx.setPoorNetwork}
            disabled={scan.running}
          />
        )}
      </div>
    </div>
  );
}
