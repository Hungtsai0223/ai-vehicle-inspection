import type { CapturedFrame, VehicleView } from "../types/frame";
const views: VehicleView[] = ["front", "left", "rear", "right", "unknown"];
/** Allocate evenly across available view groups, then spread picks within each group.
 * View labels are only progress estimates. Future ranking can combine sharpness,
 * real vehicle coverage, view recognition, diversity and exposure on the backend.
 */
export function selectKeyFrames(
  frames: CapturedFrame[],
  maximum = 16,
): CapturedFrame[] {
  const unique = Array.from(
    new Map(frames.map((frame) => [frame.id, frame])).values(),
  )
    .filter(
      (frame) =>
        Number.isFinite(frame.timestamp) &&
        frame.timestamp >= 0 &&
        views.includes(frame.vehicleView),
    )
    .sort((a, b) => a.timestamp - b.timestamp);
  const count = Math.min(
    unique.length,
    Math.max(1, Number.isFinite(maximum) ? Math.floor(maximum) : 16),
  );
  if (count === unique.length) return unique;
  const groups = views
    .map((view) => unique.filter((frame) => frame.vehicleView === view))
    .filter((group) => group.length);
  const quotas = groups.map(() => 0);
  let allocated = 0;
  while (allocated < count)
    for (let i = 0; i < groups.length && allocated < count; i++) {
      if (quotas[i] < groups[i].length) {
        quotas[i]++;
        allocated++;
      }
    }
  return groups
    .flatMap((group, i) =>
      Array.from(
        { length: quotas[i] },
        (_, index) =>
          group[
            quotas[i] === 1
              ? Math.floor((group.length - 1) / 2)
              : Math.round((index * (group.length - 1)) / (quotas[i] - 1))
          ],
      ),
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}
