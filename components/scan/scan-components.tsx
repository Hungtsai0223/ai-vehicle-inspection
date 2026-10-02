"use client";
import { Check, ArrowRight, AlertTriangle, Car, Camera } from "lucide-react";
import { VehicleIllustration } from "@/components/vehicle/vehicle-illustration";
import type { ValidationState } from "@/types/inspection";
export interface CameraPreviewProps {
  state: ValidationState;
}
// TODO: RealCameraPreview implements this interface with getUserMedia; stop tracks on unmount.
export function MockCameraPreview({ state }: CameraPreviewProps) {
  return (
    <div
      className={`camera-preview ${state === "BLURRY" ? "blurred" : ""} ${state === "TOO_DARK" ? "dim" : ""}`}
    >
      <div className="camera-grid" />
      <span className="camera-label">
        <Camera size={14} /> 模擬攝影機 · 不存取鏡頭
      </span>
      <VehicleIllustration dark />
      <BoundingBox good={state === "GOOD"} />
    </div>
  );
}
export function BoundingBox({ good }: { good: boolean }) {
  return (
    <div className={`bounding-box ${good ? "valid" : ""}`}>
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}
export const validationMessages: Record<ValidationState, string> = {
  GOOD: "拍攝狀態良好",
  TOO_CLOSE: "請稍微後退",
  TOO_FAR: "請靠近車輛",
  BLURRY: "畫面模糊，請放慢速度",
  TOO_FAST: "移動速度太快",
  TOO_DARK: "環境較暗，請靠近車輛",
};
export function ScanStatusBadge({ state }: { state: ValidationState }) {
  return (
    <div
      role="status"
      className={`scan-status ${state === "GOOD" ? "good" : "warning"}`}
    >
      {state === "GOOD" ? <Check size={18} /> : <AlertTriangle size={18} />}{" "}
      {validationMessages[state]}
    </div>
  );
}
export function ScanOverlay({ state }: { state: ValidationState }) {
  return (
    <div className="scan-overlay">
      <MockCameraPreview state={state} />
      <div className="checks">
        {["車輛完整入鏡", "距離適中", "畫面清晰"].map((label, i) => (
          <span key={label}>
            {state === "GOOD" || i === 0 ? (
              <Check size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}{" "}
            {label}
          </span>
        ))}
      </div>
      <div className="direction">
        <ArrowRight size={22} />
        請向右緩慢移動
      </div>
    </div>
  );
}
export function ScanProgress({ progress }: { progress: number }) {
  return (
    <div className="scan-progress">
      <div className="row">
        <strong>掃描進度</strong>
        <b>
          {Math.round(progress)}
          <small>%</small>
        </b>
      </div>
      <div
        role="progressbar"
        aria-label="車輛掃描進度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="progress-track"
      >
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
export function CoverageIndicator({
  progress,
  incomplete = false,
}: {
  progress: number;
  incomplete?: boolean;
}) {
  return (
    <div className="coverage">
      {["車頭", "左側", "車尾", "右側"].map((label, i) => {
        const done = progress >= (i + 1) * 25;
        const unknown = incomplete && i === 3;
        return (
          <div
            className={
              unknown
                ? "unknown"
                : done
                  ? "done"
                  : progress >= i * 25
                    ? "current"
                    : ""
            }
            key={label}
          >
            <Car size={24} />
            <span>{label}</span>
            <small>
              {unknown
                ? "Unknown"
                : done
                  ? "✓ 完成"
                  : progress >= i * 25
                    ? "掃描中"
                    : "待掃描"}
            </small>
          </div>
        );
      })}
    </div>
  );
}
