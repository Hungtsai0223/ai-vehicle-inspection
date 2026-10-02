import assert from "node:assert/strict";
import { test } from "node:test";
import { MockInspectionApi } from "../services/mock-inspection-api";
import { HttpInspectionApi } from "../services/http-inspection-api";
import { createInspectionService } from "../services/inspection-service";
import {
  InspectionApiError,
  inspectionErrorMessage,
} from "../services/inspection-errors";
import { parseResult, parseProgress } from "../services/inspection-response";
import { mockResult, mockVehicle } from "../lib/mock-data";
import { createMockFrame } from "../lib/mock-frames";
import { selectKeyFrames } from "../lib/frame-selection";
const frames = Array.from({ length: 16 }, (_, i) =>
  createMockFrame(i, i * 500),
);
const errorCode = (code: string) => (error: unknown) =>
  error instanceof InspectionApiError && error.code === code;
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
for (const scenario of [
  "potential_damage",
  "no_damage",
  "incomplete",
] as const) {
  test(`mock lifecycle: ${scenario}, without a backend or image bytes`, async () => {
    const service = createInspectionService(
      new MockInspectionApi({
        create: 0,
        upload: 0,
        request: 2,
        processing: 1,
      }),
      "MOCK",
    );
    const { inspectionId } = await service.createInspection({
      vehicle: mockVehicle,
      scenario,
    });
    assert.equal(
      (await service.getInspectionStatus(inspectionId)).status,
      "scanning",
    );
    assert.equal(
      (await service.uploadInspectionFrames(inspectionId, frames)).accepted,
      16,
    );
    await service.completeInspection(inspectionId);
    assert.equal(
      (await service.getInspectionStatus(inspectionId)).status,
      "completed",
    );
    const result = await service.getInspectionResult(inspectionId);
    assert.equal(result.inspectionId, inspectionId);
    assert.equal(result.status, "completed");
    assert.equal(
      result.detectionStatus,
      scenario === "no_damage" ? "no_damage" : "potential_damage",
    );
    assert.equal(result.damages.length, scenario === "no_damage" ? 0 : 1);
    assert.deepEqual(
      result.missingAreas,
      scenario === "incomplete" ? ["right_rear_door"] : [],
    );
  });
}
test("service deduplicates mutations and retries failed uploads with the retained frames", async () => {
  const api = new MockInspectionApi({
    create: 0,
    upload: 0,
    request: 2,
    processing: 1,
  });
  let calls = 0;
  const original = api.uploadInspectionFrames.bind(api);
  api.uploadInspectionFrames = async (id, frames) => {
    calls++;
    if (calls === 1) throw new InspectionApiError("UPLOAD_FAILED");
    return original(id, frames);
  };
  const service = createInspectionService(api, "MOCK");
  const { inspectionId } = await service.createInspection();
  const failed = await Promise.allSettled([
    service.uploadInspectionFrames(inspectionId, frames),
    service.uploadInspectionFrames(inspectionId, frames),
  ]);
  assert.ok(failed.every((result) => result.status === "rejected"));
  assert.equal(calls, 1);
  await Promise.all([
    service.uploadInspectionFrames(inspectionId, frames),
    service.uploadInspectionFrames(inspectionId, frames),
  ]);
  assert.equal(calls, 2);
  assert.equal(frames.length, 16);
  const completions = await Promise.all([
    service.completeInspection(inspectionId),
    service.completeInspection(inspectionId),
  ]);
  assert.deepEqual(completions[0], completions[1]);
});
test("key frames spread across the scan, preserve chronology, and never invent captures", () => {
  const many = Array.from({ length: 50 }, (_, i) =>
    createMockFrame(i, i * 100),
  );
  const selected = selectKeyFrames([...many.reverse(), many[0]]);
  assert.equal(selected.length, 16);
  assert.equal(selected[0].timestamp, 0);
  assert.equal(selected.at(-1)?.timestamp, 4900);
  assert.ok(
    selected.every(
      (frame, i) => i === 0 || frame.timestamp > selected[i - 1].timestamp,
    ),
  );
  assert.equal(selectKeyFrames(frames.slice(0, 3)).length, 3);
});
test("HTTP adapter uses all five v1 endpoints and exact multipart fields in milliseconds", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    const path = String(url);
    requests.push({ url: path, init });
    if (path.endsWith("/frames")) return json({ accepted: 2 });
    if (path.endsWith("/complete"))
      return json({ inspectionId: "insp/001", status: "processing" });
    if (path.endsWith("/result"))
      return json({ ...mockResult, inspectionId: "insp/001" });
    if (init?.method === "POST")
      return json({ inspectionId: "insp/001", status: "scanning" }, 201);
    return json({
      inspectionId: "insp/001",
      status: "completed",
      progress: 100,
    });
  };
  const api = new HttpInspectionApi("http://localhost:8000/", 500, fetcher);
  const { inspectionId } = await api.createInspection({
    vehicle: mockVehicle,
    scenario: "no_damage",
  });
  const realFrames = frames.slice(0, 2).map((frame) => ({
    ...frame,
    blob: new Blob([new Uint8Array([255, 216, 255])], { type: "image/jpeg" }),
  }));
  await api.uploadInspectionFrames(inspectionId, realFrames);
  await api.completeInspection(inspectionId);
  await api.getInspectionStatus(inspectionId);
  await api.getInspectionResult(inspectionId);
  assert.deepEqual(
    requests.map((r) => r.url),
    [
      "http://localhost:8000/api/v1/inspections",
      "http://localhost:8000/api/v1/inspections/insp%2F001/frames",
      "http://localhost:8000/api/v1/inspections/insp%2F001/complete",
      "http://localhost:8000/api/v1/inspections/insp%2F001",
      "http://localhost:8000/api/v1/inspections/insp%2F001/result",
    ],
  );
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
    vehicleId: mockVehicle.id,
    vehicleModel: mockVehicle.model,
    plate: mockVehicle.plate,
  });
  const body = requests[1].init?.body as FormData;
  assert.equal(body.getAll("frames").length, 2);
  assert.deepEqual([...body.keys()], ["frames", "frames", "metadata"]);
  assert.equal(requests[1].init?.headers, undefined);
  const metadata = JSON.parse(String(body.get("metadata"))) as {
    frames: {
      id: string;
      timestamp: number;
      vehicleView: string;
      quality: Record<string, number>;
    }[];
  };
  assert.deepEqual(
    metadata.frames.map((frame) => frame.id),
    realFrames.map((frame) => frame.id),
  );
  assert.deepEqual(
    metadata.frames.map((frame) => frame.timestamp),
    [0, 500],
  );
  assert.equal(metadata.frames[0].vehicleView, "front");
  assert.equal(
    metadata.frames[0].quality.exposureScore,
    realFrames[0].quality.exposureScore,
  );
});
test("API mode rejects mock metadata rather than uploading fabricated images", async () => {
  let called = false;
  const api = new HttpInspectionApi("http://localhost", 500, async () => {
    called = true;
    return json({});
  });
  await assert.rejects(
    api.uploadInspectionFrames("id", frames),
    errorCode("UPLOAD_FAILED"),
  );
  assert.equal(called, false);
});
test("wire null image URLs normalize; no-damage and unknown coverage can coexist", () => {
  const result = parseResult(
    {
      ...mockResult,
      detectionStatus: "no_damage",
      damages: [],
      missingAreas: ["right_rear_door"],
    },
    mockResult.inspectionId,
  );
  assert.equal(result.detectionStatus, "no_damage");
  assert.deepEqual(result.missingAreas, ["right_rear_door"]);
  const normalized = parseResult(
    {
      ...mockResult,
      vehicle: undefined,
      createdAt: undefined,
      damages: [
        {
          ...mockResult.damages[0],
          beforeImageUrl: null,
          afterImageUrl: null,
          maskImageUrl: null,
        },
      ],
    },
    mockResult.inspectionId,
    { vehicle: mockVehicle, createdAt: mockResult.createdAt },
  );
  assert.equal(normalized.damages[0].beforeImageUrl, undefined);
  assert.deepEqual(normalized.vehicle, mockVehicle);
});
test("malformed responses cannot enter UI state", () => {
  for (const patch of [
    { coverage: 96 },
    { status: "processing" },
    { detectionStatus: "no_damage" },
    { keyFrameCount: 1.5 },
    { missingAreas: ["roof"] },
    { inspectionId: "another" },
    { damages: [{ ...mockResult.damages[0], confidence: 91 }] },
    {
      damages: [
        { ...mockResult.damages[0], afterImageUrl: "javascript:alert(1)" },
      ],
    },
  ]) {
    assert.throws(
      () => parseResult({ ...mockResult, ...patch }, mockResult.inspectionId),
      errorCode("INVALID_RESPONSE"),
    );
  }
  assert.throws(
    () =>
      parseProgress(
        { inspectionId: "id", status: "processing", progress: 101 },
        "id",
      ),
    errorCode("INVALID_RESPONSE"),
  );
});
test("HTTP failures, network loss, invalid JSON and abort timeout have safe typed errors", async () => {
  const id = "id";
  await assert.rejects(
    new HttpInspectionApi(
      "http://localhost",
      500,
      async () => new Response("secret traceback", { status: 503 }),
    ).getInspectionStatus(id),
    errorCode("NETWORK_ERROR"),
  );
  await assert.rejects(
    new HttpInspectionApi(
      "http://localhost",
      500,
      async () => new Response("secret traceback", { status: 422 }),
    ).completeInspection(id),
    errorCode("PROCESSING_FAILED"),
  );
  await assert.rejects(
    new HttpInspectionApi(
      "http://localhost",
      500,
      async () => new Response("not-json"),
    ).getInspectionStatus(id),
    errorCode("INVALID_RESPONSE"),
  );
  await assert.rejects(
    new HttpInspectionApi("http://localhost", 500, async () => {
      throw new Error("private error");
    }).getInspectionStatus(id),
    errorCode("NETWORK_ERROR"),
  );
  const hanging: typeof fetch = async (_url, init) =>
    new Promise((_resolve, reject) =>
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      ),
    );
  await assert.rejects(
    new HttpInspectionApi("http://localhost", 5, hanging).getInspectionStatus(
      id,
    ),
    errorCode("TIMEOUT"),
  );
  assert.ok(
    !inspectionErrorMessage(new Error("secret traceback")).includes("secret"),
  );
});
