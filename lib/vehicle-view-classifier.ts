import type { CapturedFrame, VehicleView } from "../types/frame";
import type { CameraMode } from "../types/camera";
import type { ScanFrameLabel, ScanSector } from "../types/scan";
export interface VehicleViewClassifier {
  classify(
    frame: CapturedFrame,
    requested: ScanFrameLabel,
    mode: CameraMode,
  ): ScanFrameLabel;
}
/** TODO: Replace guided-sector labeling with teammate AI vehicle-view classifier.
 * This adapter labels the requested viewpoint; it does NOT recognize the image. */
export const guidedVehicleViewClassifier: VehicleViewClassifier = {
  classify: (_frame, requested, mode) => ({
    ...requested,
    source: mode === "demo" ? "demo" : "guided-prototype",
  }),
};
export function sectorVehicleView(sector: ScanSector): VehicleView {
  if (sector === "front" || sector === "front_left" || sector === "front_right")
    return "front";
  if (sector === "rear" || sector === "rear_left" || sector === "rear_right")
    return "rear";
  return sector.startsWith("left") ? "left" : "right";
}
