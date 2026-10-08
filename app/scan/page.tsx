"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { ScanOverlay } from "@/components/scan/scan-components";
import { VehicleCoverageRing } from "@/components/scan/VehicleCoverageRing";
import { SCAN_SECTORS } from "@/lib/scan-coverage";
import { DemoControls } from "@/components/scan/demo-controls";
import { useVehicleScan } from "@/components/scan/use-vehicle-scan";
import { useInspection } from "@/components/inspection/inspection-context";
import { getPreferredCameraMode } from "@/lib/camera-access";
import type { CameraMode } from "@/types/camera";
import type { ScanState } from "@/types/inspection";
import { DemoRecovery } from "@/components/inspection/demo-recovery";
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
  const scan = useVehicleScan(validation);
  const skipDialog = useRef<HTMLDialogElement>(null);
  const currentSector = SCAN_SECTORS.find(
    (s) => s.id === scan.coverage.currentSector,
  );
  const instruction =
    scan.coverage.capturedSectorCount === 12
      ? "車況掃描完成"
      : (currentSector?.instruction ?? "開始後，依指引繞行車身");
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
        state={mode === "real" ? "good" : validation}
        progress={scan.prototypeProgress}
        instruction={instruction}
        framing={
          mode === "real"
            ? scan.framing
            : validation === "too_close"
              ? "TOO_CLOSE"
              : validation === "too_far"
                ? "TOO_FAR"
                : "GOOD"
        }
        qualityMessage={scan.qualityMessage}
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
        <VehicleCoverageRing
          coverage={scan.coverage}
          onSelect={scan.selectSector}
          disabled={scan.phase !== "scanning" || mode === "demo"}
        />
        <div className="guided-movement" role="status">
          <strong>{instruction}</strong>
          {scan.canFinish && (
            <span className="guided-completion">
              {scan.coverage.capturedSectorCount === 12
                ? "完整掃描"
                : "主要車身區域已完成"}{" "}
              · 車況掃描完成
            </span>
          )}
          {scan.phase === "scanning" && currentSector && (
            <small>
              {currentSector.label} ·{" "}
              {scan.coverage.sectors.find((s) => s.id === currentSector.id)
                ?.validFrameCount ?? 0}{" "}
              / 2 張有效影格
            </small>
          )}
        </div>
        {mode === "real" && scan.phase === "scanning" && currentSector && (
          <div className="guided-actions">
            {!scan.coverage.armed && (
              <Button className="secondary" onClick={scan.armCurrent}>
                已移至此角度，開始擷取
              </Button>
            )}
            {scan.coverage.armed && (
              <p className="guided-capturing">保持穩定，正在擷取此角度…</p>
            )}
            <button
              className="skip-angle"
              type="button"
              onClick={() => {
                scan.pauseCurrent();
                skipDialog.current?.showModal();
              }}
            >
              無法拍攝此角度
            </button>
          </div>
        )}
        {mode === "real" &&
          scan.phase === "scanning" &&
          !currentSector &&
          !scan.canFinish && (
            <p className="notice">
              主要角度尚未完成，請點選環上的 Unknown
              角度重新拍攝。需完成車頭、左側、車尾及右側。
            </p>
          )}
        <div className="frame-capture-count" role="status">
          已擷取影格 <b>{scan.coverage.validFrameCount}</b>
        </div>
        {mode === "real" && (
          <p className="prototype-progress-note">
            每次移位後確認開始擷取；需至少完成 10
            個角度，包含車頭、左側、車尾與右側。角度為暫定引導標籤，尚未接入 AI
            視角／車身辨識。
          </p>
        )}
        {mode === "demo" && (
          <p className="prototype-progress-note">
            Demo：角度與取景狀態為模擬，仍需有效影格才推進。
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
          (ctx.scenario === "incomplete" ||
            ctx.scenario === "unknown_area") && (
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
        {scan.error &&
          mode === "real" &&
          scan.cameraState !== "idle" &&
          scan.cameraState !== "permission_granted" && (
            <div className="camera-fallback" role="status">
              <p>相機目前無法啟用</p>
              <Button className="secondary" onClick={() => changeMode("demo")}>
                改用 Demo 模式
              </Button>
            </div>
          )}
        {scan.error &&
          (scan.phase === "upload-error" || ctx.status === "failed") && (
            <DemoRecovery />
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
      <dialog
        ref={skipDialog}
        className="recapture-dialog"
        aria-labelledby="skip-angle-title"
      >
        <h2 id="skip-angle-title">無法拍攝{currentSector?.label}？</h2>
        <p>
          此角度將標記為
          Unknown，相關區域需要後續人工確認，不能視為沒有損傷。車頭、左側、車尾與右側仍需拍攝才能完成掃描。
        </p>
        <Button
          className="secondary"
          onClick={() => {
            skipDialog.current?.close();
            scan.armCurrent();
          }}
        >
          繼續拍攝
        </Button>
        <Button
          onClick={() => {
            scan.skipCurrent();
            skipDialog.current?.close();
          }}
        >
          確認無法拍攝
        </Button>
      </dialog>
    </div>
  );
}
