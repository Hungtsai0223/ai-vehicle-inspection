import type { CapturedFrame, VehicleView } from "../types/frame";
const views: VehicleView[] = ["front", "left", "rear", "right"];
export function createMockFrame(
  index: number,
  timestamp: number,
): CapturedFrame {
  return {
    id: `mock_frame_${index}`,
    timestamp,
    vehicleView: views[Math.min(3, Math.floor(index / 4))],
    previewUrl: "/mock/after.svg",
    quality: { blurScore: 0.08, exposureScore: 0.85, vehicleCoverage: 0.96 },
  };
}
