import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getDemoScenario,
  demoScenarios,
  demoStubResult,
  canUseDemoResults,
} from "../lib/demo-config";
import { resultFor, mockVehicle } from "../lib/mock-data";
import { parseResult } from "../services/inspection-response";
import { MockInspectionApi } from "../services/mock-inspection-api";
import { pollInspection } from "../services/poll-inspection";
import { InspectionApiError } from "../services/inspection-errors";
import { createInspectionService } from "../services/inspection-service";
import { createMockFrame } from "../lib/mock-frames";
import {
  readInspectionSession,
  saveInspectionSession,
  sessionStorageKey,
} from "../lib/inspection-session";
import { resolveApiUrl } from "../lib/api-config";
import { realExperimentResults } from "../data/experiment-results";
import { demoExperimentResults } from "../data/demo-metrics";

test("central demo configuration supports five scenarios, safe defaults and legacy stub mappings", () => {
  for (const { value } of demoScenarios)
    assert.equal(getDemoScenario(value), value);
  assert.equal(getDemoScenario("invalid"), "potential_damage");
  assert.equal(demoStubResult("unknown_area"), "incomplete");
  assert.equal(demoStubResult("backend_error"), "processing_failure");
  assert.equal(demoStubResult("multiple_damage"), "multiple_damage");
});
test("production HTTP only offers simulated results when explicitly enabled", () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_USE_MOCK_AI: process.env.NEXT_PUBLIC_USE_MOCK_AI,
    NEXT_PUBLIC_ENABLE_DEMO: process.env.NEXT_PUBLIC_ENABLE_DEMO,
  };
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.NEXT_PUBLIC_USE_MOCK_AI = "false";
    delete process.env.NEXT_PUBLIC_ENABLE_DEMO;
    assert.equal(canUseDemoResults(), false);
    process.env.NEXT_PUBLIC_ENABLE_DEMO = "true";
    assert.equal(canUseDemoResults(), true);
    process.env.NEXT_PUBLIC_ENABLE_DEMO = "false";
    process.env.NEXT_PUBLIC_USE_MOCK_AI = "true";
    assert.equal(canUseDemoResults(), true);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test("multiple/unknown/no-damage demos stay schema-compatible and failure never creates a result", () => {
  const multi = parseResult(resultFor("multiple_damage", "id"), "id");
  assert.deepEqual(
    multi.damages.map((d) => [d.part, d.confidence, d.isPotentialNewDamage]),
    [
      ["left_front_door", 0.91, true],
      ["rear_bumper", 0.84, true],
    ],
  );
  assert.equal(multi.coverage, 0.94);
  const unknown = parseResult(resultFor("unknown_area", "id"), "id");
  assert.equal(unknown.detectionStatus, "potential_damage");
  assert.deepEqual(unknown.missingAreas, ["right_rear_door"]);
  assert.equal(
    parseResult(resultFor("no_damage", "id"), "id").damages.length,
    0,
  );
  assert.throws(
    () => resultFor("backend_error"),
    (error: unknown) =>
      error instanceof InspectionApiError && error.code === "PROCESSING_FAILED",
  );
});
test("Mock full lifecycle preserves multiple results and surfaces backend-error rehearsal", async () => {
  for (const scenario of [
    "multiple_damage",
    "unknown_area",
    "backend_error",
  ] as const) {
    const api = new MockInspectionApi({
      create: 0,
      upload: 0,
      request: 0,
      processing: 1,
    });
    const { inspectionId } = await api.createInspection({
      vehicle: mockVehicle,
      scenario,
    });
    await api.uploadInspectionFrames(inspectionId, [createMockFrame(0, 0)]);
    await api.completeInspection(inspectionId);
    if (scenario === "backend_error")
      await assert.rejects(
        api.getInspectionResult(inspectionId),
        (error: unknown) =>
          error instanceof InspectionApiError &&
          error.code === "PROCESSING_FAILED",
      );
    else {
      const result = await pollInspection(api, inspectionId, () => {}, {
        intervalMs: 1,
        timeoutMs: 1000,
      });
      assert.equal(result.keyFrameCount, 1);
      assert.equal(
        result.damages.length,
        scenario === "multiple_damage" ? 2 : 1,
      );
    }
  }
});
test("explicit API-mode presentation session restores its demo source without storing results or photos", () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { origin: "http://localhost:3456" },
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  try {
    saveInspectionSession({
      version: 1,
      mode: "API",
      inspectionId: "presentation_test",
      vehicle: mockVehicle,
      createdAt: new Date().toISOString(),
      scanDuration: 26.8,
      capturedFrameCount: 16,
      keyFrameCount: 16,
      cameraMode: "demo",
      status: "completed",
      uploadComplete: true,
      scenario: "multiple_damage",
      demoResultScenario: "multiple_damage",
    });
    const saved = readInspectionSession("API");
    assert.equal(saved?.demoResultScenario, "multiple_damage");
    assert.equal(
      resolveApiUrl("/api/dev", "/health").href,
      "http://localhost:3456/api/dev/health",
    );
    assert.ok(!values.get(sessionStorageKey)?.includes('"damages"'));
    const malformed = { ...saved, demoResultScenario: "backend_error" };
    values.set(sessionStorageKey, JSON.stringify(malformed));
    assert.equal(readInspectionSession("API"), null);
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
});
test("real experiments remain empty; existing demonstration records use normalized types", () => {
  assert.deepEqual(realExperimentResults, []);
  assert.equal(demoExperimentResults.length, 4);
  assert.ok(
    demoExperimentResults.every(
      (row) =>
        row.confidence >= 0 &&
        row.confidence <= 1 &&
        row.processingTimeSeconds > 0,
    ),
  );
});

test("cancelled Mock creation, upload and completion cannot advance an inspection", async () => {
  const api = new MockInspectionApi({
    create: 10,
    upload: 10,
    request: 10,
    processing: 1,
  });
  const aborted = (error: unknown) =>
    error instanceof InspectionApiError && error.code === "ABORTED";
  const creation = new AbortController();
  const pendingCreate = api.createInspection(
    { vehicle: mockVehicle },
    { signal: creation.signal },
  );
  creation.abort();
  await assert.rejects(pendingCreate, aborted);
  const { inspectionId } = await api.createInspection({ vehicle: mockVehicle });
  const upload = new AbortController();
  const pendingUpload = api.uploadInspectionFrames(
    inspectionId,
    [createMockFrame(0, 0)],
    { signal: upload.signal },
  );
  upload.abort();
  await assert.rejects(pendingUpload, aborted);
  await assert.rejects(
    api.completeInspection(inspectionId),
    (error: unknown) =>
      error instanceof InspectionApiError && error.code === "UPLOAD_FAILED",
  );
  await api.uploadInspectionFrames(inspectionId, [createMockFrame(0, 0)]);
  const completion = new AbortController();
  const pendingComplete = api.completeInspection(inspectionId, {
    signal: completion.signal,
  });
  completion.abort();
  await assert.rejects(pendingComplete, aborted);
  assert.equal(
    (await api.getInspectionStatus(inspectionId)).status,
    "scanning",
  );
});

test("reset forgets Mock records and cancelled result reads do not resume after reset", async () => {
  const api = new MockInspectionApi({
    create: 0,
    upload: 0,
    request: 10,
    processing: 1,
  });
  const service = createInspectionService(api, "MOCK");
  const { inspectionId } = await service.createInspection();
  await service.uploadInspectionFrames(inspectionId, [createMockFrame(0, 0)]);
  await service.completeInspection(inspectionId);
  const controller = new AbortController();
  const pending = service.getInspectionResult(inspectionId, {
    signal: controller.signal,
  });
  controller.abort();
  service.forgetInspection(inspectionId);
  await assert.rejects(
    pending,
    (error: unknown) =>
      error instanceof InspectionApiError && error.code === "ABORTED",
  );
  await assert.rejects(
    service.getInspectionStatus(inspectionId),
    (error: unknown) =>
      error instanceof InspectionApiError && error.code === "PROCESSING_FAILED",
  );
});

test("saved presentation results cannot bypass a disabled production Demo setting", () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_USE_MOCK_AI: process.env.NEXT_PUBLIC_USE_MOCK_AI,
    NEXT_PUBLIC_ENABLE_DEMO: process.env.NEXT_PUBLIC_ENABLE_DEMO,
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const saved = {
    version: 1,
    mode: "API",
    inspectionId: "presentation_test",
    vehicle: mockVehicle,
    createdAt: new Date().toISOString(),
    scanDuration: 26.8,
    capturedFrameCount: 16,
    keyFrameCount: 16,
    cameraMode: "demo",
    status: "completed",
    uploadComplete: true,
    scenario: "no_damage",
    demoResultScenario: "no_damage",
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage: { getItem: () => JSON.stringify(saved) } },
  });
  try {
    Object.assign(process.env, {
      NODE_ENV: "production",
      NEXT_PUBLIC_USE_MOCK_AI: "false",
      NEXT_PUBLIC_ENABLE_DEMO: "false",
    });
    assert.equal(readInspectionSession("API"), null);
    process.env.NEXT_PUBLIC_ENABLE_DEMO = "true";
    assert.equal(readInspectionSession("API")?.demoResultScenario, "no_damage");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
