import type { CapturedFrame } from "../types/frame";
import type {
  ScanState,
  InspectionResult,
  VehiclePart,
} from "../types/inspection";
import type {
  FramingState,
  ScanSector,
  VehicleScanCoverage,
} from "../types/scan";
export const SCAN_SECTORS: {
  id: ScanSector;
  label: string;
  instruction: string;
}[] = [
  { id: "front", label: "車頭", instruction: "請對準車頭" },
  { id: "front_left", label: "左前斜角", instruction: "請慢慢移向左前方" },
  {
    id: "left_front",
    label: "左前側",
    instruction: "請移至左前側，保持完整車身入鏡",
  },
  { id: "left", label: "左側", instruction: "請沿左側車身緩慢移動" },
  { id: "left_rear", label: "左後側", instruction: "請繼續往左後方移動" },
  { id: "rear_left", label: "左後斜角", instruction: "請從左後方對準車尾" },
  { id: "rear", label: "車尾", instruction: "請對準車尾" },
  { id: "rear_right", label: "右後斜角", instruction: "請慢慢移向右後方" },
  {
    id: "right_rear",
    label: "右後側",
    instruction: "請移至右後側，保持完整車身入鏡",
  },
  { id: "right", label: "右側", instruction: "請沿右側車身緩慢移動" },
  { id: "right_front", label: "右前側", instruction: "請慢慢移向右前方" },
  { id: "front_right", label: "右前斜角", instruction: "即將完成，請回到車頭" },
];
export const SCAN_QUALITY = {
  minBrightness: 0.18,
  maxMotion: 0.2,
  minimumFramesPerSector: 1,
  targetFramesPerSector: 2,
  minimumTotalFrames: 12,
  minimumSectors: 10,
} as const;
export function initialCoverage(active = false): VehicleScanCoverage {
  return {
    sectors: SCAN_SECTORS.map(({ id }, i) => ({
      id,
      status: active && i === 0 ? "current" : "pending",
      validFrameCount: 0,
    })),
    capturedSectorCount: 0,
    totalSectorCount: 12,
    completionRatio: 0,
    validFrameCount: 0,
    currentSector: active ? "front" : undefined,
    armed: active,
    requestId: 1,
    acceptedFrameIds: [],
  };
}
function summarize(coverage: VehicleScanCoverage): VehicleScanCoverage {
  const capturedSectorCount = coverage.sectors.filter(
    (s) => s.status === "captured",
  ).length;
  return {
    ...coverage,
    capturedSectorCount,
    completionRatio: capturedSectorCount / 12,
    validFrameCount: coverage.sectors.reduce(
      (sum, s) => sum + s.validFrameCount,
      0,
    ),
  };
}
export function chooseSector(
  coverage: VehicleScanCoverage,
  sector: ScanSector,
  armed = false,
): VehicleScanCoverage {
  if (coverage.sectors.find((s) => s.id === sector)?.status === "captured")
    return coverage;
  return {
    ...coverage,
    currentSector: sector,
    armed,
    requestId: coverage.requestId + 1,
    sectors: coverage.sectors.map((s) =>
      s.id === sector
        ? { ...s, status: "current" }
        : s.status === "current" || s.status === "needs_retry"
          ? { ...s, status: "pending" }
          : s,
    ),
  };
}
export function armSector(coverage: VehicleScanCoverage) {
  return coverage.currentSector
    ? chooseSector(coverage, coverage.currentSector, true)
    : coverage;
}
function nextSector(coverage: VehicleScanCoverage, autoAdvance: boolean) {
  const next = coverage.sectors.find(
    (s) => s.status === "pending" || s.status === "needs_retry",
  );
  return next
    ? chooseSector(coverage, next.id, autoAdvance)
    : { ...coverage, currentSector: undefined, armed: false };
}
export function markUnavailable(
  coverage: VehicleScanCoverage,
): VehicleScanCoverage {
  if (!coverage.currentSector) return coverage;
  // A partial sector cannot count as captured. Already stored valid frames stay bounded.
  const updated = {
    ...coverage,
    sectors: coverage.sectors.map((s) =>
      s.id === coverage.currentSector
        ? { ...s, status: "unavailable" as const }
        : s,
    ),
  };
  return summarize(nextSector(updated, false));
}
export function frameQualityProblem(
  frame: CapturedFrame,
  framing: FramingState,
  simulatedState?: ScanState,
): string | undefined {
  if (
    simulatedState === "too_fast" ||
    simulatedState === "blurry" ||
    (frame.motionScore !== undefined &&
      frame.motionScore > SCAN_QUALITY.maxMotion)
  )
    return "請放慢移動速度，保持手機穩定";
  if (
    simulatedState === "too_dark" ||
    frame.quality.exposureScore === undefined ||
    !Number.isFinite(frame.quality.exposureScore) ||
    frame.quality.exposureScore < SCAN_QUALITY.minBrightness
  )
    return "光線不足或亮度尚未確認，請移至明亮處或開啟補光";
  if (framing === "TOO_CLOSE" || framing === "TOO_FAR" || framing === "PARTIAL")
    return framing === "TOO_FAR"
      ? "請靠近一些，保持完整車身入鏡"
      : "請退後一些，保持完整車身入鏡";
  return undefined; // UNKNOWN is provisional, never AI-verified.
}
export function recordSectorFrame(
  coverage: VehicleScanCoverage,
  frame: CapturedFrame,
  problem: string | undefined,
  autoAdvance: boolean,
): { coverage: VehicleScanCoverage; accepted: boolean } {
  if (
    !coverage.armed ||
    !coverage.currentSector ||
    frame.scan?.sector !== coverage.currentSector ||
    frame.scan.requestId !== coverage.requestId ||
    coverage.acceptedFrameIds.includes(frame.id)
  )
    return { coverage, accepted: false };
  if (problem)
    return {
      coverage: {
        ...coverage,
        sectors: coverage.sectors.map((s) =>
          s.id === coverage.currentSector ? { ...s, status: "needs_retry" } : s,
        ),
      },
      accepted: false,
    };
  const sectors = coverage.sectors.map((s) =>
    s.id === coverage.currentSector
      ? {
          ...s,
          validFrameCount: s.validFrameCount + 1,
          bestFrameId: s.bestFrameId ?? frame.id,
          status:
            s.validFrameCount + 1 >= SCAN_QUALITY.targetFramesPerSector
              ? ("captured" as const)
              : ("current" as const),
        }
      : s,
  );
  let updated = summarize({
    ...coverage,
    sectors,
    acceptedFrameIds: [...coverage.acceptedFrameIds, frame.id],
  });
  if (
    sectors.find((s) => s.id === coverage.currentSector)?.status === "captured"
  )
    updated = nextSector(updated, autoAdvance);
  return { coverage: updated, accepted: true };
}
export function canCompleteScan(coverage: VehicleScanCoverage): boolean {
  return (
    coverage.capturedSectorCount >= SCAN_QUALITY.minimumSectors &&
    coverage.validFrameCount >= SCAN_QUALITY.minimumTotalFrames &&
    ["front", "left", "rear", "right"].every((id) =>
      coverage.sectors.some((s) => s.id === id && s.status === "captured"),
    )
  );
}
export function unavailableAreas(
  result: InspectionResult,
  sectors: ScanSector[],
): InspectionResult {
  const mapping: Record<ScanSector, VehiclePart[]> = {
    front: ["front_bumper", "hood"],
    front_left: ["front_bumper", "left_fender"],
    left_front: ["left_fender", "left_front_door"],
    left: ["left_front_door", "left_rear_door"],
    left_rear: ["left_rear_door"],
    rear_left: ["rear_bumper", "left_rear_door"],
    rear: ["rear_bumper", "trunk"],
    rear_right: ["rear_bumper", "right_rear_door"],
    right_rear: ["right_rear_door"],
    right: ["right_front_door", "right_rear_door"],
    right_front: ["right_front_door", "right_fender"],
    front_right: ["front_bumper", "right_fender"],
  };
  if (!sectors.length) return result;
  return {
    ...result,
    missingAreas: [
      ...new Set([
        ...(result.missingAreas ?? []),
        ...sectors.flatMap((s) => mapping[s]),
      ]),
    ],
  };
}
