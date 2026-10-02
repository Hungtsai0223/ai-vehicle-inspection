import type { CapturedFrame } from "../types/frame";
import { InspectionApiError } from "../services/inspection-errors";
export const supportedFrameTypes = ["image/jpeg", "image/png", "image/webp"];
export function validateUploadFrames(frames: CapturedFrame[]) {
  if (
    !frames.length ||
    new Set(frames.map((f) => f.id)).size !== frames.length ||
    frames.some(
      (frame) =>
        !frame.id ||
        !(frame.blob instanceof Blob) ||
        !frame.blob.size ||
        !supportedFrameTypes.includes(frame.blob.type) ||
        !Number.isFinite(frame.timestamp) ||
        frame.timestamp < 0 ||
        !["front", "left", "rear", "right", "unknown"].includes(
          frame.vehicleView,
        ) ||
        !frame.quality ||
        Object.values(frame.quality).some(
          (value) =>
            value !== undefined &&
            (!Number.isFinite(value) || value < 0 || value > 1),
        ),
    )
  )
    throw new InspectionApiError("INVALID_FRAMES");
}
