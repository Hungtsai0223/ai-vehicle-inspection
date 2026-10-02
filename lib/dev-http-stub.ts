import type {
  InspectionResult,
  ProcessingStage,
  Vehicle,
} from "../types/inspection";
import { createUniqueId } from "./unique-id";
import { stubResults } from "./dev-stub-options";
type StubResult = (typeof stubResults)[number];
interface StubFrame {
  id: string;
  timestamp: number;
  vehicleView: string;
  quality?: Record<string, number>;
  bytes: Uint8Array;
  contentType: string;
}
interface StubSession {
  id: string;
  vehicle: Vehicle;
  createdAt: string;
  result: StubResult;
  frames: StubFrame[];
  started?: number;
  uploadFailureSimulated?: boolean;
}
interface StubStore {
  sessions: Map<string, StubSession>;
}
const globalStore = globalThis as typeof globalThis & {
  vehicleHttpStub?: StubStore;
};
const store: StubStore = (globalStore.vehicleHttpStub ??= {
  sessions: new Map(),
});
const headers = { "Cache-Control": "no-store" };
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers });
}
function error(status: number, message: string) {
  return json({ error: message }, status);
}
function cleanup() {
  const cutoff = Date.now() - 15 * 60_000;
  for (const [id, session] of store.sessions)
    if (Date.parse(session.createdAt) < cutoff) store.sessions.delete(id);
  while (store.sessions.size >= 10)
    store.sessions.delete(store.sessions.keys().next().value!);
}
const stages: ProcessingStage[] = [
  "image_validation",
  "vehicle_part_detection",
  "damage_detection",
  "before_after_comparison",
];
function progress(session: StubSession) {
  const progress =
    session.started == null
      ? 0
      : session.result === "result_timeout"
        ? 72
        : Math.min(100, (Date.now() - session.started) / 30);
  const status =
    session.started == null
      ? "scanning"
      : session.result === "processing_failure" && progress >= 50
        ? "failed"
        : progress >= 100
          ? "completed"
          : "processing";
  return {
    inspectionId: session.id,
    status,
    progress,
    stage:
      progress >= 100
        ? "completed"
        : stages[Math.min(3, Math.floor(progress / 25))],
  };
}
function result(session: StubSession): InspectionResult {
  const after = `/api/dev/api/v1/inspections/${encodeURIComponent(session.id)}/images/${encodeURIComponent(session.frames[Math.min(13, session.frames.length - 1)].id)}`;
  const noDamage = session.result === "no_damage";
  return {
    inspectionId: session.id,
    vehicle: session.vehicle,
    status: "completed",
    detectionStatus: noDamage ? "no_damage" : "potential_damage",
    coverage: session.result === "incomplete" ? 0.75 : noDamage ? 0.97 : 0.96,
    scanDurationSeconds:
      Math.max(...session.frames.map((frame) => frame.timestamp)) / 1000,
    processingTimeSeconds: 3,
    keyFrameCount: session.frames.length,
    createdAt: session.createdAt,
    missingAreas: session.result === "incomplete" ? ["right_rear_door"] : [],
    damages: noDamage
      ? []
      : [
          {
            id: "damage_001",
            part: "left_front_door",
            damageType: "scratch",
            confidence: 0.91,
            isPotentialNewDamage: true,
            boundingBox: { x: 0.38, y: 0.42, width: 0.18, height: 0.13 },
            beforeImageUrl: undefined,
            afterImageUrl:
              session.result === "missing_images"
                ? "/api/dev/missing-image.jpg"
                : after,
            maskImageUrl: undefined,
          },
        ],
  };
}
/** Dev-only ephemeral HTTP transport fixture. No inference, disk storage or server credentials. */
export async function handleStubRequest(request: Request, segments: string[]) {
  if (process.env.NODE_ENV !== "development") return error(404, "Not found");
  const url = new URL(request.url);
  const failure = url.searchParams.get("failure") ?? "none";
  if (failure === "500" || failure === "503")
    return error(Number(failure), "Simulated service failure");
  if (!segments.length && request.method === "GET")
    return json({
      reachable: true,
      implementation: "HTTP development stub; no AI inference",
    });
  if (!segments.length && request.method === "POST") {
    const input = await request.json().catch(() => null);
    if (
      !input ||
      ![input.vehicleId, input.vehicleModel, input.plate].every(
        (v) => typeof v === "string" && v.trim(),
      )
    )
      return error(400, "Invalid vehicle");
    const requestedResult =
      url.searchParams.get("result") ??
      process.env.NEXT_PUBLIC_DEV_AI_RESULT ??
      "potential_damage";
    if (!stubResults.includes(requestedResult as StubResult))
      return error(400, "Invalid development result mode");
    cleanup();
    const id = createUniqueId("http_dev");
    store.sessions.set(id, {
      id,
      vehicle: {
        id: input.vehicleId,
        model: input.vehicleModel,
        plate: input.plate,
      },
      createdAt: new Date().toISOString(),
      result: requestedResult as StubResult,
      frames: [],
    });
    return json({ inspectionId: id, status: "scanning" }, 201);
  }
  const session = store.sessions.get(segments[0]);
  if (!session || Date.now() - Date.parse(session.createdAt) > 15 * 60_000) {
    if (session) store.sessions.delete(session.id);
    return error(404, "Inspection not found; restart the scan");
  }
  if (segments.length === 1 && request.method === "GET")
    return json(progress(session));
  if (
    segments[1] === "frames" &&
    segments.length === 2 &&
    request.method === "POST"
  ) {
    if (failure === "upload_failure" && !session.uploadFailureSimulated) {
      session.uploadFailureSimulated = true;
      return error(500, "Simulated upload failure; retry this inspection");
    }
    if (session.started != null)
      return error(409, "Processing has already started");
    const length = Number(request.headers.get("Content-Length"));
    if (length > 24 * 1024 * 1024) return error(413, "Upload too large");
    const form = await request.formData().catch(() => null);
    if (!form) return error(400, "Invalid multipart");
    const files = form.getAll("frames");
    const metadataFields = form.getAll("metadata");
    const raw = metadataFields[0];
    const metadata = typeof raw === "string" ? JSON.parse(raw || "null") : null;
    if (
      metadataFields.length !== 1 ||
      !Array.isArray(metadata?.frames) ||
      files.length !== metadata.frames.length ||
      files.length < 1 ||
      files.length > 20
    )
      return error(400, "Frame and metadata count mismatch");
    if (
      files.some(
        (file) =>
          typeof file === "string" ||
          !["image/jpeg", "image/png"].includes(file.type) ||
          file.size < 4 ||
          file.size > 2 * 1024 * 1024,
      )
    )
      return error(400, "Invalid image");
    if (
      new Set(metadata.frames.map((f: { id?: string }) => f?.id)).size !==
        files.length ||
      metadata.frames.some(
        (f: { id?: unknown; timestamp?: unknown; vehicleView?: unknown }) =>
          !f ||
          typeof f.id !== "string" ||
          !f.id ||
          typeof f.timestamp !== "number" ||
          !Number.isFinite(f.timestamp) ||
          f.timestamp < 0 ||
          !["front", "left", "rear", "right", "unknown"].includes(
            String(f.vehicleView),
          ),
      )
    )
      return error(400, "Invalid metadata");
    const next: StubFrame[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const valid =
        file.type === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71;
      if (!valid) return error(400, "Image bytes do not match MIME type");
      next.push({ ...metadata.frames[i], bytes, contentType: file.type });
    }
    session.frames = next;
    return json({ accepted: next.length });
  }
  if (
    segments[1] === "complete" &&
    segments.length === 2 &&
    request.method === "POST"
  ) {
    if (!session.frames.length) return error(400, "Upload frames first");
    session.started ??= Date.now();
    return json({ inspectionId: session.id, status: progress(session).status });
  }
  if (
    segments[1] === "result" &&
    segments.length === 2 &&
    request.method === "GET"
  ) {
    if (progress(session).status !== "completed")
      return error(409, "Not completed");
    return json(result(session));
  }
  if (
    segments[1] === "images" &&
    segments.length === 3 &&
    request.method === "GET"
  ) {
    const frame = session.frames.find((frame) => frame.id === segments[2]);
    if (!frame) return error(404, "Image not found");
    return new Response(
      new Blob([new Uint8Array(frame.bytes)], { type: frame.contentType }),
      { headers: { ...headers, "Content-Type": frame.contentType } },
    );
  }
  return error(404, "Not found");
}
