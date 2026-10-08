import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { handleStubRequest } from "../lib/dev-http-stub";
import { HttpInspectionApi } from "../services/http-inspection-api";
import { pollInspection } from "../services/poll-inspection";
import { InspectionApiError } from "../services/inspection-errors";
import { mockVehicle } from "../lib/mock-data";
import { createMockFrame } from "../lib/mock-frames";
const errorCode = (code: string) => (error: unknown) =>
  error instanceof InspectionApiError && error.code === code;
// Small valid JPEG fixture; browser UI tests additionally upload 640×360 canvas JPEGs.
const jpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64",
);
const frames = Array.from({ length: 16 }, (_, i) => ({
  ...createMockFrame(i, i * 500),
  blob: new Blob([jpeg], { type: "image/jpeg" }),
}));
test("native HTTP transport: exact create, multipart bytes, polling, results and error modes", async (t) => {
  const originalEnv = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "development" });
  const uploads: { contentType: string; size: number }[] = [];
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      const url = `http://127.0.0.1${incoming.url}`;
      const request = new Request(url, {
        method: incoming.method,
        headers: incoming.headers as Record<string, string>,
        ...(body.length ? { body } : {}),
      });
      if (incoming.url?.includes("/frames"))
        uploads.push({
          contentType: request.headers.get("Content-Type") ?? "",
          size: body.length,
        });
      const segments =
        new URL(url).pathname
          .split("/api/v1/inspections")[1]
          ?.split("/")
          .filter(Boolean)
          .map(decodeURIComponent) ?? [];
      const response = await handleStubRequest(request, segments);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(400);
      outgoing.end("{}");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/dev`;
  try {
    for (const mode of ["potential_damage", "no_damage", "incomplete"] as const)
      await t.test(mode, async () => {
        const api = new HttpInspectionApi(`${base}?result=${mode}`);
        const { inspectionId } = await api.createInspection({
          vehicle: mockVehicle,
        });
        assert.equal(
          (await api.uploadInspectionFrames(inspectionId, frames)).accepted,
          16,
        );
        await api.completeInspection(inspectionId);
        const observed: string[] = [];
        const result = await pollInspection(
          api,
          inspectionId,
          (status) => observed.push(status.stage ?? ""),
          { intervalMs: 200, timeoutMs: 5000 },
        );
        assert.equal(
          result.detectionStatus,
          mode === "no_damage" ? "no_damage" : "potential_damage",
        );
        assert.equal(result.keyFrameCount, 16);
        assert.equal(result.scanDurationSeconds, 7.5);
        // Real HTTP polling may skip intermediate stages under CPU/network load.
        // Assert legal monotonic observations and completion, not wall-clock sampling luck.
        const stageOrder = [
          "image_validation",
          "vehicle_part_detection",
          "damage_detection",
          "before_after_comparison",
          "completed",
        ];
        assert.equal(observed.at(-1), "completed");
        assert.ok(
          observed.every(
            (stage, i) =>
              stageOrder.includes(stage) &&
              (i === 0 ||
                stageOrder.indexOf(stage) >=
                  stageOrder.indexOf(observed[i - 1])),
          ),
        );
        assert.deepEqual(
          result.missingAreas,
          mode === "incomplete" ? ["right_rear_door"] : [],
        );
        if (mode !== "no_damage") {
          assert.equal(result.damages[0].confidence, 0.91);
          const image = await fetch(result.damages[0].afterImageUrl!);
          assert.equal(image.status, 200);
          assert.deepEqual(
            new Uint8Array(await image.arrayBuffer()),
            new Uint8Array(jpeg),
          );
          assert.equal(result.damages[0].beforeImageUrl, undefined);
          assert.equal(result.damages[0].boundingBox?.x, 0.38);
        }
      });
    assert.ok(
      uploads.every(
        (upload) =>
          /multipart\/form-data; boundary=/.test(upload.contentType) &&
          upload.size > jpeg.length * 16,
      ),
    );
    for (const failure of ["500", "503"])
      await assert.rejects(
        new HttpInspectionApi(`${base}?failure=${failure}`).createInspection({
          vehicle: mockVehicle,
        }),
        errorCode("NETWORK_ERROR"),
      );
    const uploadApi = new HttpInspectionApi(`${base}?failure=upload_failure`);
    const uploadId = (
      await uploadApi.createInspection({ vehicle: mockVehicle })
    ).inspectionId;
    await assert.rejects(
      uploadApi.uploadInspectionFrames(uploadId, frames),
      errorCode("UPLOAD_FAILED"),
    );
    assert.equal(
      (await uploadApi.uploadInspectionFrames(uploadId, frames)).accepted,
      16,
    );
    for (const mode of ["processing_failure", "result_timeout"]) {
      const api = new HttpInspectionApi(`${base}?result=${mode}`);
      const id = (await api.createInspection({ vehicle: mockVehicle }))
        .inspectionId;
      await api.uploadInspectionFrames(id, frames);
      await api.completeInspection(id);
      await assert.rejects(
        pollInspection(api, id, () => {}, {
          intervalMs: 100,
          timeoutMs: mode === "result_timeout" ? 50 : 4000,
        }),
        errorCode(mode === "result_timeout" ? "TIMEOUT" : "PROCESSING_FAILED"),
      );
      assert.equal((await api.getInspectionStatus(id)).inspectionId, id); // timeout preserved session
    }
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.equal((await fetch(`${base}/api/v1/inspections`)).status, 404);
  } finally {
    if (originalEnv === undefined)
      Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: originalEnv });
    server.closeAllConnections();
    server.close();
  }
});
test("polling cancels an in-flight read and never requests a result or another poll", async () => {
  const controller = new AbortController();
  let statusCalls = 0;
  let resultCalls = 0;
  const operation = pollInspection(
    {
      getInspectionStatus: async (_id, options) => {
        statusCalls++;
        return new Promise((_resolve, reject) =>
          options?.signal?.addEventListener(
            "abort",
            () => reject(new InspectionApiError("ABORTED")),
            { once: true },
          ),
        );
      },
      getInspectionResult: async () => {
        resultCalls++;
        throw new Error("Unexpected result call");
      },
    },
    "id",
    () => {},
    { signal: controller.signal, timeoutMs: 100 },
  );
  controller.abort();
  await assert.rejects(operation, errorCode("ABORTED"));
  assert.equal(statusCalls, 1);
  assert.equal(resultCalls, 0);
});
test("resumed HTTP sessions use lightweight vehicle metadata and resolve API-origin images", async () => {
  const api = new HttpInspectionApi("http://backend.test", 500, async () =>
    Response.json({
      inspectionId: "resume",
      status: "completed",
      detectionStatus: "potential_damage",
      coverage: 0.96,
      scanDurationSeconds: 24,
      processingTimeSeconds: 3,
      keyFrameCount: 16,
      damages: [
        {
          id: "d",
          part: "left_front_door",
          damageType: "scratch",
          confidence: 0.91,
          isPotentialNewDamage: true,
          afterImageUrl: "/results/a.jpg",
        },
      ],
    }),
  );
  const result = await api.getInspectionResult("resume", {
    vehicle: mockVehicle,
    createdAt: "2026-10-02T00:00:00Z",
  });
  assert.deepEqual(result.vehicle, mockVehicle);
  assert.equal(
    result.damages[0].afterImageUrl,
    "http://backend.test/results/a.jpg",
  );
});

test("sessionStorage holds lightweight data, survives readback, and rejects another mode or malformed session", async () => {
  const { readInspectionSession, saveInspectionSession, sessionStorageKey } =
    await import("../lib/inspection-session");
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  try {
    const session = {
      version: 1 as const,
      mode: "API" as const,
      inspectionId: "resume",
      vehicle: mockVehicle,
      createdAt: "2026-10-02T00:00:00Z",
      scanDuration: 24,
      capturedFrameCount: 48,
      keyFrameCount: 16,
      cameraMode: "real" as const,
      status: "processing" as const,
      uploadComplete: true,
      scenario: "potential_damage" as const,
    };
    saveInspectionSession(session);
    assert.deepEqual(readInspectionSession("API"), session);
    assert.equal(readInspectionSession("MOCK"), null);
    const stored = values.get(sessionStorageKey)!;
    assert.ok(!/blob|previewUrl|damages/.test(stored));
    values.set(
      sessionStorageKey,
      JSON.stringify({
        ...session,
        frames: ["not allowed"],
        result: "not allowed",
      }),
    );
    assert.deepEqual(readInspectionSession("API"), session); // strips unknown/large fields
    values.set(
      sessionStorageKey,
      JSON.stringify({ ...session, keyFrameCount: -1 }),
    );
    assert.equal(readInspectionSession("API"), null);
    values.set(sessionStorageKey, "{bad json");
    assert.equal(readInspectionSession("API"), null);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
