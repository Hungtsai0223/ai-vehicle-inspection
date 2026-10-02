import type { CapturedFrame } from "../types/frame";
/** Preserve chronology and spread samples across the scan. Future ranking can combine
 * sharpness, vehicle coverage, view angle, frame diversity and exposure.
 * Keep expensive CV on the backend. Never fabricate missing frames.
 */
export function selectKeyFrames(
  frames: CapturedFrame[],
  maximum = 16,
): CapturedFrame[] {
  const unique = Array.from(
    new Map(frames.map((frame) => [frame.id, frame])).values(),
  )
    .filter((frame) => Number.isFinite(frame.timestamp) && frame.timestamp >= 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  const count = Math.min(unique.length, Math.max(1, Math.floor(maximum)));
  if (count === unique.length) return unique;
  if (count === 1) return unique.slice(0, 1);
  return Array.from(
    { length: count },
    (_, index) =>
      unique[Math.round((index * (unique.length - 1)) / (count - 1))],
  );
}
