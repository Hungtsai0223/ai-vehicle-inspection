"use client";
import {
  Check,
  ArrowRight,
  AlertTriangle,
  Car,
  MoveHorizontal,
  Gauge,
  SunMoon,
  Focus,
} from "lucide-react";
import {
  CameraPreview,
  type CameraPreviewProps,
} from "@/components/camera/CameraPreview";
export {
  MockCameraPreview,
  BoundingBox,
} from "@/components/camera/mock-camera-preview";
import type { CameraPermissionState } from "@/types/camera";
import type { ScanState } from "@/types/inspection";
export const validationMessages: Record<ScanState, string> = {
  good: "拍攝狀態良好",
  too_close: "距離太近，請稍微後退",
  too_far: "距離太遠，請靠近車輛",
  blurry: "畫面模糊，請放慢速度",
  too_fast: "移動速度太快",
  too_dark: "環境較暗，請保持手機穩定",
};
const stateIcons = {
  good: Check,
  too_close: MoveHorizontal,
  too_far: MoveHorizontal,
  blurry: Focus,
  too_fast: Gauge,
  too_dark: SunMoon,
};
export function ScanStatusBadge({
  state,
  label,
}: {
  state: ScanState;
  label?: string;
}) {
  const Icon = stateIcons[state];
  return (
    <div
      role="status"
      className={`scan-status ${state === "good" ? "good" : "warning"}`}
    >
      <Icon size={18} />
      {label ?? validationMessages[state]}
    </div>
  );
}
export function scanDirection(progress: number) {
  return progress >= 100
    ? "車輛掃描完成"
    : progress < 25
      ? "請對準車頭"
      : progress < 50
        ? "請向右緩慢移動"
        : progress < 75
          ? "請繼續移動至車尾"
          : "即將完成掃描";
}
export function ScanOverlay({
  state = "good",
  progress,
  mode = "demo",
  cameraPermission = "idle",
  ...cameraProps
}: CameraPreviewProps & {
  progress: number;
  cameraPermission?: CameraPermissionState;
}) {
  const distanceGood = state !== "too_close" && state !== "too_far";
  const clarityGood =
    state !== "blurry" && state !== "too_dark" && state !== "too_fast";
  const validations =
    mode === "real"
      ? [
          { label: "請完整拍攝車身", valid: true },
          { label: "距離約 1–2 公尺", valid: true },
          { label: "保持手機穩定", valid: true },
        ]
      : [
          { label: "車輛完整入鏡", valid: true },
          {
            label: distanceGood ? "距離適中" : "調整拍攝距離",
            valid: distanceGood,
          },
          {
            label: clarityGood ? "畫面清晰" : "調整影像品質",
            valid: clarityGood,
          },
        ];
  const liveLabel =
    cameraPermission === "permission_granted"
      ? state === "too_dark"
        ? "影像亮度較低，請移至明亮處"
        : "相機已就緒 · 依指引拍攝"
      : "相機尚未就緒";
  return (
    <div className="scan-overlay">
      <CameraPreview state={state} mode={mode} {...cameraProps} />
      <div className="camera-instructions">
        <div className="direction" role="status">
          <ArrowRight size={22} />
          {scanDirection(progress)}
        </div>
        <div className="checks">
          {validations.map(({ label, valid }) => (
            <span className={valid ? "" : "needs-adjustment"} key={label}>
              {mode === "real" ? (
                <Focus size={14} />
              ) : valid ? (
                <Check size={14} />
              ) : (
                <AlertTriangle size={14} />
              )}{" "}
              {label}
            </span>
          ))}
        </div>
        <ScanStatusBadge
          state={state}
          label={mode === "real" ? liveLabel : undefined}
        />
      </div>
    </div>
  );
}
export function ScanProgress({
  progress,
  prototype = false,
}: {
  progress: number;
  prototype?: boolean;
}) {
  return (
    <div className="scan-progress">
      <div className="row">
        <strong>{prototype ? "拍攝引導進度" : "掃描進度"}</strong>
        <b>
          {Math.round(progress)}
          <small>%</small>
        </b>
      </div>
      <div
        role="progressbar"
        aria-label={prototype ? "Prototype 拍攝引導進度" : "車輛掃描進度"}
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
  prototype = false,
}: {
  progress: number;
  incomplete?: boolean;
  prototype?: boolean;
}) {
  return (
    <div
      className="coverage"
      aria-label={
        prototype ? "四面拍攝階段引導（非覆蓋偵測）" : "四面車身掃描覆蓋"
      }
    >
      {["車頭", "左側", "車尾", "右側"].map((label, i) => {
        const done = progress >= (i + 1) * 25;
        const current = progress >= i * 25;
        const unknown = incomplete && i === 3;
        return (
          <div
            className={
              unknown ? "unknown" : done ? "done" : current ? "current" : ""
            }
            key={label}
          >
            <Car size={24} />
            <span>{label}</span>
            <small>
              {unknown ? (
                "Unknown"
              ) : done ? (
                <>
                  <Check size={11} />
                  {prototype ? "引導完成" : "完成"}
                </>
              ) : current ? (
                prototype ? (
                  "拍攝中"
                ) : (
                  "掃描中"
                )
              ) : (
                "待掃描"
              )}
            </small>
          </div>
        );
      })}
    </div>
  );
}
