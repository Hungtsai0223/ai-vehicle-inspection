import type { CapturedFrame } from "../types/frame";
import type { FramingState, VehicleFramingResult } from "../types/scan";
/** Prototype tuning values, not scientifically validated. Boxes use normalized coordinates. */
export const FRAMING_THRESHOLDS = {
  goodMin: 0.55,
  goodMax: 0.85,
  tooClose: 0.9,
  tooFar: 0.4,
  edge: 0.02,
} as const;
export const framingMessages: Record<FramingState, string> = {
  GOOD: "車輛位置良好",
  TOO_CLOSE: "距離太近，請稍微後退",
  TOO_FAR: "距離太遠，請靠近車輛",
  PARTIAL: "請將完整車身保持在框線內",
  UNKNOWN: "正在確認車輛位置",
};
export function framingState(result: VehicleFramingResult): FramingState {
  if (!result.detected) return "UNKNOWN";
  const box = result.boundingBox;
  if (box) {
    if (
      ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
      box.width <= 0 ||
      box.height <= 0
    )
      return "UNKNOWN";
    const e = FRAMING_THRESHOLDS.edge;
    if (
      box.x <= e ||
      box.y <= e ||
      box.x + box.width >= 1 - e ||
      box.y + box.height >= 1 - e
    )
      return "PARTIAL";
  }
  const ratio = result.coverageRatio;
  if (ratio === undefined || !Number.isFinite(ratio) || ratio < 0 || ratio > 1)
    return "UNKNOWN";
  if (ratio > FRAMING_THRESHOLDS.tooClose) return "TOO_CLOSE";
  if (ratio < FRAMING_THRESHOLDS.tooFar) return "TOO_FAR";
  return ratio >= FRAMING_THRESHOLDS.goodMin &&
    ratio <= FRAMING_THRESHOLDS.goodMax
    ? "GOOD"
    : "UNKNOWN";
}
export interface VehicleFramingProvider {
  inspect(frame: CapturedFrame): VehicleFramingResult;
}
/** TODO: Replace with teammate vehicle detection model. Never fabricate a real bounding box. */
export const pendingVehicleFramingProvider: VehicleFramingProvider = {
  inspect: () => ({ detected: false }),
};
