import { createUniqueId } from "./unique-id";
import type { CapturedFrame, VehicleView } from "../types/frame";
export const frameSamplingIntervalMs = 500;
export const prototypeScanDurationMs = 24_000;
export const CAMERA_FRAME_MAX_WIDTH = 1280;
export const CAMERA_JPEG_QUALITY = 0.8;
export function frameDimensions(
  width: number,
  height: number,
  maximumEdge = CAMERA_FRAME_MAX_WIDTH,
) {
  if (width <= 0 || height <= 0 || !Number.isFinite(width + height))
    throw new Error("Video has no drawable frame");
  const scale = Math.min(1, maximumEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
/** TODO: replace progress-based view estimation with AI vehicle-view recognition. */
export function estimateVehicleView(prototypeProgress: number): VehicleView {
  return prototypeProgress < 25
    ? "front"
    : prototypeProgress < 50
      ? "left"
      : prototypeProgress < 75
        ? "rear"
        : "right";
}
/** Mean luminance, not an exposure-quality/model score. Tiny 32×32 sample only.
 * Future blurScore and vehicleCoverage remain unset; no browser CV or part detection.
 */
export function estimateExposure(
  pixels: Uint8ClampedArray,
): number | undefined {
  if (!pixels.length || pixels.length % 4 !== 0) return undefined;
  let total = 0;
  for (let i = 0; i < pixels.length; i += 4)
    total +=
      0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
  return total / (pixels.length / 4) / 255;
}
export interface FrameCaptureOptions {
  timestamp: number;
  prototypeProgress: number;
  canvas?: HTMLCanvasElement;
  qualityCanvas?: HTMLCanvasElement;
}
export async function captureCameraFrame(
  video: HTMLVideoElement,
  options: FrameCaptureOptions,
): Promise<CapturedFrame | null> {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight)
    return null;
  const canvas = options.canvas ?? document.createElement("canvas");
  const size = frameDimensions(video.videoWidth, video.videoHeight);
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas capture unavailable");
  context.drawImage(video, 0, 0, size.width, size.height);
  let exposureScore: number | undefined;
  try {
    const sample = options.qualityCanvas ?? document.createElement("canvas");
    sample.width = 32;
    sample.height = 32;
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    if (sampleContext) {
      sampleContext.drawImage(canvas, 0, 0, 32, 32);
      exposureScore = estimateExposure(
        sampleContext.getImageData(0, 0, 32, 32).data,
      );
    }
  } catch {
    /* Optional quality metadata must not block capture. */
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", CAMERA_JPEG_QUALITY),
  );
  if (!blob?.size) throw new Error("Empty camera frame");
  return {
    id: createUniqueId("frame"),
    timestamp: options.timestamp,
    blob,
    previewUrl: URL.createObjectURL(blob),
    vehicleView: estimateVehicleView(options.prototypeProgress),
    quality: { exposureScore },
  };
}
