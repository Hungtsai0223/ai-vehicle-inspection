import type { CapturedFrame } from "../types/frame";
import { selectKeyFrames } from "./frame-selection";
export const KEYFRAME_IMPORT_LIMITS = {
  metadataBytes: 2 * 1024 * 1024,
  images: 5000,
  selected: 16,
  imageBytes: 16 * 1024 * 1024,
  totalBytes: 64 * 1024 * 1024,
} as const;
type ImportImage = Blob & { name: string };
const invalid = () =>
  new Error(
    "影格資料無效：請選擇成功輸出的 metadata.json 與同一批原始 JPEG 影格。",
  );
function filename(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^(?:images|images_original)\/[^/\\]+\.jpg$/.test(value) ||
    value.includes("..")
  )
    throw invalid();
  return value.slice(value.indexOf("/") + 1);
}
/** Python timestamps are seconds; the existing HTTP contract expects milliseconds.
 * Geometry quality is not a vehicle-view classifier. Preserve unknown labels.
 * Use raw source frames, never feed CLAHE-enhanced evidence into damage comparison. */
export function importKeyframes(
  metadata: unknown,
  images: ImportImage[],
): CapturedFrame[] {
  if (!metadata || typeof metadata !== "object") throw invalid();
  const data = metadata as Record<string, unknown>;
  if (
    data.schema_version !== 1 ||
    data.status !== "complete" ||
    !Array.isArray(data.keyframes) ||
    !data.keyframes.length ||
    data.keyframes.length > KEYFRAME_IMPORT_LIMITS.images ||
    images.length > KEYFRAME_IMPORT_LIMITS.images
  )
    throw invalid();
  const fileMap = new Map<string, ImportImage>();
  for (const image of images) {
    if (fileMap.has(image.name))
      throw new Error("檔名重複，請只選擇 images_original 中的一批影格。");
    fileMap.set(image.name, image);
  }
  const ids = new Set<number>();
  const names = new Set<string>();
  const frames = data.keyframes.map((value: unknown): CapturedFrame => {
    if (!value || typeof value !== "object") throw invalid();
    const row = value as Record<string, unknown>;
    if (
      !Number.isSafeInteger(row.frame_index) ||
      (row.frame_index as number) < 0 ||
      ids.has(row.frame_index as number) ||
      typeof row.timestamp_seconds !== "number" ||
      !Number.isFinite(row.timestamp_seconds) ||
      row.timestamp_seconds < 0 ||
      row.timestamp_seconds > Number.MAX_SAFE_INTEGER / 1000 ||
      row.selected !== true ||
      typeof row.preprocessed !== "boolean"
    )
      throw invalid();
    ids.add(row.frame_index as number);
    const name = filename(row.preprocessed ? row.original_image : row.image);
    if (names.has(name)) throw invalid();
    names.add(name);
    const blob = fileMap.get(name);
    if (
      !blob ||
      blob.type !== "image/jpeg" ||
      !blob.size ||
      blob.size > KEYFRAME_IMPORT_LIMITS.imageBytes
    )
      throw invalid();
    const quality = (row.original_quality ?? row.quality) as
      Record<string, unknown> | undefined;
    const luma = quality?.mean_luma;
    if (
      typeof luma !== "number" ||
      !Number.isFinite(luma) ||
      luma < 0 ||
      luma > 255
    )
      throw invalid();
    return {
      id: `import_frame_${row.frame_index}`,
      timestamp: Math.round(row.timestamp_seconds * 1000),
      blob,
      vehicleView: "unknown",
      quality: { exposureScore: luma / 255 },
    };
  });
  const selected = selectKeyFrames(frames, KEYFRAME_IMPORT_LIMITS.selected);
  if (
    selected.reduce((sum, frame) => sum + frame.blob!.size, 0) >
    KEYFRAME_IMPORT_LIMITS.totalBytes
  )
    throw new Error("選定影格總量超過 64 MiB，請縮小圖片後重新匯入。");
  return selected;
}
