import type {
  DamageDetection,
  InspectionProgress,
  InspectionResult,
  ProcessingStage,
  Vehicle,
} from "../types/inspection";
import type { InspectionSession, UploadReceipt } from "./inspection-api";
import { InspectionApiError } from "./inspection-errors";
const statuses = [
  "idle",
  "scanning",
  "uploading",
  "processing",
  "completed",
  "failed",
];
const parts = [
  "front_bumper",
  "rear_bumper",
  "hood",
  "trunk",
  "left_front_door",
  "left_rear_door",
  "right_front_door",
  "right_rear_door",
  "left_fender",
  "right_fender",
  "headlight",
  "taillight",
  "wheel",
  "unknown",
];
const damageTypes = [
  "scratch",
  "dent",
  "paint_damage",
  "contamination",
  "unknown",
];
function invalid(): never {
  throw new InspectionApiError(
    "INVALID_RESPONSE",
    "Response does not match the inspection contract",
  );
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) invalid();
  return value;
}
function number(value: unknown, maximum = Infinity): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > maximum
  )
    invalid();
  return value;
}
function enumValue<T extends string>(
  value: unknown,
  allowed: readonly string[],
): T {
  if (typeof value !== "string" || !allowed.includes(value)) invalid();
  return value as T;
}
function vehicle(value: unknown): Vehicle {
  const v = record(value);
  return { id: string(v.id), model: string(v.model), plate: string(v.plate) };
}
function imageUrl(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const url = string(value);
  if (
    !(url.startsWith("/") && !url.startsWith("//")) &&
    !/^https?:\/\//i.test(url)
  )
    invalid();
  try {
    new URL(url, "https://backend.invalid");
  } catch {
    invalid();
  }
  return url;
}
function damage(value: unknown): DamageDetection {
  const d = record(value);
  const rawPart = string(d.part);
  const rawDamageType = string(d.damageType);
  if (typeof d.isPotentialNewDamage !== "boolean") invalid();
  const box = d.boundingBox == null ? undefined : record(d.boundingBox);
  const boundingBox = box
    ? {
        x: number(box.x, 1),
        y: number(box.y, 1),
        width: number(box.width, 1),
        height: number(box.height, 1),
      }
    : undefined;
  if (
    boundingBox &&
    (boundingBox.width === 0 ||
      boundingBox.height === 0 ||
      boundingBox.x + boundingBox.width > 1 ||
      boundingBox.y + boundingBox.height > 1)
  )
    invalid();
  return {
    id: string(d.id),
    part: (parts.includes(rawPart)
      ? rawPart
      : "unknown") as DamageDetection["part"],
    damageType: (damageTypes.includes(rawDamageType)
      ? rawDamageType
      : "unknown") as DamageDetection["damageType"],
    ...(!parts.includes(rawPart) ? { rawPart } : {}),
    ...(!damageTypes.includes(rawDamageType) ? { rawDamageType } : {}),
    confidence: number(d.confidence, 1),
    isPotentialNewDamage: d.isPotentialNewDamage,
    boundingBox,
    beforeImageUrl: imageUrl(d.beforeImageUrl),
    afterImageUrl: imageUrl(d.afterImageUrl),
    maskImageUrl: imageUrl(d.maskImageUrl),
  };
}
export function parseSession(
  value: unknown,
  expectedId?: string,
): InspectionSession {
  const s = record(value);
  const inspectionId = string(s.inspectionId);
  if (expectedId && inspectionId !== expectedId) invalid();
  return { inspectionId, status: enumValue(s.status, statuses) };
}
export function parseUpload(
  value: unknown,
  expectedCount: number,
): UploadReceipt {
  const accepted = number(record(value).accepted);
  if (!Number.isInteger(accepted) || accepted !== expectedCount) invalid();
  return { accepted };
}
export function parseProgress(value: unknown, id: string): InspectionProgress {
  return {
    ...parseSession(value, id),
    progress: number(record(value).progress, 100),
    stage:
      record(value).stage == null
        ? undefined
        : enumValue<ProcessingStage>(record(value).stage, [
            "image_validation",
            "vehicle_part_detection",
            "damage_detection",
            "before_after_comparison",
            "completed",
          ]),
  };
}
export function parseResult(
  value: unknown,
  id: string,
  metadata?: { vehicle: Vehicle; createdAt: string },
): InspectionResult {
  const r = record(value);
  const session = parseSession(value, id);
  if (session.status !== "completed" || !Array.isArray(r.damages)) invalid();
  const damages = r.damages.map(damage);
  if (new Set(damages.map((d) => d.id)).size !== damages.length) invalid();
  const detectionStatus = enumValue<InspectionResult["detectionStatus"]>(
    r.detectionStatus,
    ["no_damage", "potential_damage"],
  );
  if (
    (detectionStatus === "no_damage" && damages.length > 0) ||
    (detectionStatus === "potential_damage" && damages.length === 0)
  )
    invalid();
  const keyFrameCount = number(r.keyFrameCount);
  if (!Number.isInteger(keyFrameCount)) invalid();
  if (r.missingAreas !== undefined && !Array.isArray(r.missingAreas)) invalid();
  const createdAt = string(r.createdAt ?? metadata?.createdAt);
  if (!Number.isFinite(Date.parse(createdAt))) invalid();
  return {
    ...session,
    vehicle: vehicle(r.vehicle ?? metadata?.vehicle),
    detectionStatus,
    coverage: number(r.coverage, 1),
    scanDurationSeconds: number(r.scanDurationSeconds),
    processingTimeSeconds: number(r.processingTimeSeconds),
    keyFrameCount,
    missingAreas:
      (r.missingAreas as unknown[] | undefined)?.map((part) =>
        parts.includes(string(part))
          ? (part as DamageDetection["part"])
          : "unknown",
      ) ?? [],
    damages,
    createdAt,
  };
}
