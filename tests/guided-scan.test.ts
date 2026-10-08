import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CameraTorchController,
  LowLightDetector,
  supportsTorch,
  LIGHT_THRESHOLDS,
} from "../lib/camera-torch";
import {
  framingState,
  pendingVehicleFramingProvider,
} from "../lib/vehicle-framing";
import { guidedVehicleViewClassifier } from "../lib/vehicle-view-classifier";
import {
  initialCoverage,
  recordSectorFrame,
  armSector,
  chooseSector,
  markUnavailable,
  canCompleteScan,
  frameQualityProblem,
  SCAN_SECTORS,
  unavailableAreas,
} from "../lib/scan-coverage";
import { FrameMotionEstimator } from "../lib/camera-frame-capture";
import { selectKeyFrames } from "../lib/frame-selection";
import { createMockFrame } from "../lib/mock-frames";
import { resultFor } from "../lib/mock-data";
import {
  readInspectionSession,
  saveInspectionSession,
  sessionStorageKey,
} from "../lib/inspection-session";
import type { VehicleScanCoverage } from "../types/scan";
function track(
  supported = true,
  apply: (enabled: boolean) => Promise<void> = async () => {},
) {
  const calls: boolean[] = [];
  return {
    calls,
    video: {
      kind: "video",
      readyState: "live",
      getCapabilities: () => ({ torch: supported }),
      applyConstraints: async (c: { advanced: { torch: boolean }[] }) => {
        calls.push(c.advanced[0].torch);
        await apply(c.advanced[0].torch);
      },
    } as unknown as MediaStreamTrack,
  };
}
function frame(c: VehicleScanCoverage, id: string) {
  return {
    ...createMockFrame(0, Number(id.replace(/\D/g, "")) || 0),
    id,
    scan: c.currentSector
      ? {
          sector: c.currentSector,
          requestId: c.requestId,
          source: "guided-prototype" as const,
        }
      : undefined,
  };
}
function capture(c: VehicleScanCoverage, auto = true, prefix = "f") {
  if (!c.armed) c = armSector(c);
  for (let i = 0; i < 2; i++)
    c = recordSectorFrame(
      c,
      frame(c, `${prefix}${c.currentSector}${i}`),
      undefined,
      auto,
    ).coverage;
  return c;
}
test("low-light requires sustained samples and brightness hysteresis", () => {
  const d = new LowLightDetector();
  assert.equal(d.observe(0.17, 0), false);
  assert.equal(d.observe(0.17, 1499), false);
  assert.equal(d.observe(0.17, 1500), true);
  assert.equal(d.observe(0.28, 2000), true);
  assert.equal(d.observe(0.36, 2500), true);
  assert.equal(d.observe(0.36, 4499), true);
  assert.equal(d.observe(0.36, 4500), false);
  d.observe(0.1, 5000);
  d.observe(undefined, 6400);
  assert.equal(d.observe(0.1, 6500), false);
  assert.equal(d.observe(0.1, 8000), true);
  assert.equal(d.observe(0.35, 99999), true);
  assert.equal(d.observe(NaN, 100000), true);
  const boundary = new LowLightDetector();
  boundary.observe(0.18, 0);
  assert.equal(boundary.observe(0.18, 10000), false);
});
test("torch capability detection handles missing/throwing APIs and ended tracks", () => {
  assert.equal(supportsTorch(track().video), true);
  assert.equal(supportsTorch(track(false).video), false);
  assert.equal(
    supportsTorch({ kind: "video", readyState: "live" } as MediaStreamTrack),
    false,
  );
  assert.equal(
    supportsTorch({
      ...track().video,
      getCapabilities() {
        throw Error("unavailable");
      },
    } as MediaStreamTrack),
    false,
  );
  assert.equal(
    supportsTorch({
      ...track().video,
      readyState: "ended",
    } as MediaStreamTrack),
    false,
  );
  assert.equal(
    supportsTorch({
      ...track().video,
      getCapabilities: () => ({}),
    } as MediaStreamTrack),
    false,
  );
});
test("automatic torch transitions only once, sufficient light turns it off", async () => {
  const t = track();
  let now = 0;
  const torch = new CameraTorchController(
    t.video,
    () => {},
    () => now,
  );
  torch.observe(0.1);
  now = 1500;
  torch.observe(0.1);
  await torch.settled();
  assert.equal(torch.state.torchEnabled, true);
  assert.equal(torch.state.autoTorchEnabled, true);
  for (let i = 0; i < 20; i++) torch.observe(0.1);
  assert.deepEqual(t.calls, [true]);
  now = 4000;
  torch.observe(0.5);
  now = 6000;
  torch.observe(0.5);
  await torch.settled();
  assert.deepEqual(t.calls, [true, false]);
  await torch.dispose();
});
test("torch rejection does not crash or retry each frame; manual retry remains possible", async () => {
  const t = track(true, async () => {
    throw new DOMException("not allowed", "NotSupportedError");
  });
  let now = 0;
  const torch = new CameraTorchController(
    t.video,
    () => {},
    () => now,
  );
  torch.observe(0.1);
  now = 1500;
  torch.observe(0.1);
  await torch.settled();
  assert.equal(torch.state.failed, true);
  assert.equal(torch.state.torchEnabled, false);
  for (let i = 0; i < 100; i++) {
    now += 500;
    torch.observe(0.1);
  }
  assert.deepEqual(t.calls, [true]);
  torch.setMode("on");
  await torch.settled();
  assert.deepEqual(t.calls, [true, true]);
  await torch.dispose();
  assert.equal(t.calls.at(-1), false);
});
test("torch cleanup serializes off after an in-flight enable and suppresses later state updates", async () => {
  let resolve!: () => void;
  const t = track(true, (enabled) =>
    enabled
      ? new Promise<void>((done) => {
          resolve = done;
        })
      : Promise.resolve(),
  );
  let changes = 0;
  const torch = new CameraTorchController(t.video, () => {
    changes++;
  });
  torch.setMode("on");
  await Promise.resolve();
  const disposing = torch.dispose();
  const count = changes;
  resolve();
  await disposing;
  assert.deepEqual(t.calls, [true, false]);
  assert.equal(torch.state.torchEnabled, false);
  assert.equal(changes, count);
  torch.observe(0.1, 99999);
  torch.setMode("on");
  assert.equal(changes, count);
});
test("manual off during pending enable is serialized; unsupported torch never applies", async () => {
  let resolve!: () => void;
  const t = track(true, (enabled) =>
    enabled
      ? new Promise<void>((done) => {
          resolve = done;
        })
      : Promise.resolve(),
  );
  const torch = new CameraTorchController(t.video);
  torch.setMode("on");
  await Promise.resolve();
  torch.setMode("off");
  resolve();
  await torch.settled();
  await torch.settled();
  assert.deepEqual(t.calls, [true, false]);
  await torch.dispose();
  const no = track(false);
  const unsupported = new CameraTorchController(no.video);
  unsupported.setMode("on");
  await unsupported.dispose();
  assert.deepEqual(no.calls, []);
});
test("automatic cooldown prevents rapid constraints when brightness reverses", async () => {
  const t = track();
  let now = 0;
  const torch = new CameraTorchController(
    t.video,
    () => {},
    () => now,
  );
  torch.observe(0.1);
  now = 1500;
  torch.observe(0.1);
  await torch.settled();
  now = 1501;
  torch.observe(0.5);
  now = 3501;
  torch.observe(0.5);
  await torch.settled();
  assert.deepEqual(t.calls, [true]);
  assert.ok(LIGHT_THRESHOLDS.cooldownMs > 2000);
  await torch.dispose();
  assert.equal(t.calls.at(-1), false);
});
test("framing thresholds and edge priority are tunable, unknown detector stays truthful", () => {
  for (const ratio of [0.55, 0.7, 0.85])
    assert.equal(
      framingState({ detected: true, coverageRatio: ratio }),
      "GOOD",
    );
  assert.equal(
    framingState({ detected: true, coverageRatio: 0.91 }),
    "TOO_CLOSE",
  );
  assert.equal(
    framingState({ detected: true, coverageRatio: 0.39 }),
    "TOO_FAR",
  );
  assert.equal(
    framingState({
      detected: true,
      coverageRatio: 0.7,
      boundingBox: { x: 0, y: 0.1, width: 0.7, height: 0.7 },
    }),
    "PARTIAL",
  );
  for (const ratio of [0.4, 0.5, 0.9, NaN, -1, 2])
    assert.equal(
      framingState({ detected: true, coverageRatio: ratio }),
      "UNKNOWN",
    );
  assert.equal(
    framingState(pendingVehicleFramingProvider.inspect(createMockFrame(0, 0))),
    "UNKNOWN",
  );
  assert.equal(
    framingState({ detected: false, coverageRatio: 0.7 }),
    "UNKNOWN",
  );
});
test("valid frame target advances sectors; time, invalid quality and duplicates cannot complete", () => {
  let c = initialCoverage(true);
  const f = frame(c, "one");
  assert.equal(initialCoverage().capturedSectorCount, 0);
  c = recordSectorFrame(c, f, "too dark", false).coverage;
  assert.equal(c.sectors[0].status, "needs_retry");
  assert.equal(c.validFrameCount, 0);
  c = recordSectorFrame(c, f, undefined, false).coverage;
  assert.equal(c.validFrameCount, 1);
  assert.equal(c.capturedSectorCount, 0);
  const duplicate = recordSectorFrame(c, f, undefined, false);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.coverage.validFrameCount, 1);
  c = recordSectorFrame(c, frame(c, "two"), undefined, false).coverage;
  assert.equal(c.capturedSectorCount, 1);
  assert.equal(c.currentSector, "front_left");
  assert.equal(c.armed, false);
  assert.equal(
    recordSectorFrame(c, frame(c, "three"), undefined, false).accepted,
    false,
  );
  const old = frame(c, "late");
  c = armSector(c);
  assert.equal(recordSectorFrame(c, old, undefined, false).accepted, false);
});
test("quality gate rejects dark, fast, failed/unknown brightness and invalid framing; unknown framing is provisional", () => {
  const f = frame(initialCoverage(true), "quality");
  assert.equal(frameQualityProblem(f, "UNKNOWN"), undefined);
  for (const state of ["TOO_CLOSE", "TOO_FAR", "PARTIAL"] as const)
    assert.ok(frameQualityProblem(f, state));
  assert.ok(
    frameQualityProblem({ ...f, quality: { exposureScore: 0.179 } }, "GOOD"),
  );
  assert.ok(frameQualityProblem({ ...f, quality: {} }, "GOOD"));
  assert.ok(frameQualityProblem({ ...f, motionScore: 0.21 }, "GOOD"));
  assert.ok(frameQualityProblem(f, "GOOD", "too_fast"));
  assert.ok(frameQualityProblem(f, "GOOD", "blurry"));
  assert.equal(
    frameQualityProblem(
      { ...f, quality: { exposureScore: 0.18 }, motionScore: 0.2 },
      "UNKNOWN",
    ),
    undefined,
  );
});
test("unavailable does not count, can be revisited; incomplete directions map to Unknown without changing damage or backend score", () => {
  let c = markUnavailable(initialCoverage(true));
  assert.equal(c.sectors[0].status, "unavailable");
  assert.equal(c.capturedSectorCount, 0);
  assert.equal(c.completionRatio, 0);
  c = chooseSector(c, "front");
  c = capture(c, false);
  assert.equal(c.sectors[0].status, "captured");
  const base = resultFor("no_damage", "id");
  const mapped = unavailableAreas(base, ["left", "front_right"]);
  assert.equal(mapped.detectionStatus, "no_damage");
  assert.equal(mapped.coverage, base.coverage);
  assert.ok(mapped.missingAreas?.includes("left_front_door"));
  assert.ok(mapped.missingAreas?.includes("front_bumper"));
});
test("10 / 12 requires four cardinal sectors and 12 valid frames; 12 / 12 is complete", () => {
  let c = initialCoverage(true);
  for (let i = 0; i < 10; i++) c = capture(c);
  assert.equal(c.capturedSectorCount, 10);
  assert.equal(canCompleteScan(c), true);
  assert.equal(Math.round(c.completionRatio * 100), 83);
  assert.equal(canCompleteScan({ ...c, validFrameCount: 11 }), false);
  const noFront = {
    ...c,
    sectors: c.sectors.map((s) =>
      s.id === "front" ? { ...s, status: "unavailable" as const } : s,
    ),
  };
  assert.equal(canCompleteScan(noFront), false);
  c = capture(c);
  assert.equal(Math.round(c.completionRatio * 100), 92);
  c = capture(c);
  assert.equal(c.capturedSectorCount, 12);
  assert.equal(c.validFrameCount, 24);
  assert.equal(c.currentSector, undefined);
  assert.equal(c.completionRatio, 1);
  assert.equal(canCompleteScan(c), true);
  assert.equal(
    recordSectorFrame(c, createMockFrame(99, 99999), undefined, true).accepted,
    false,
  );
});
test("Demo simulates guided progression; Real labels remain explicitly provisional", () => {
  const f = frame(initialCoverage(true), "label");
  const requested = f.scan!;
  assert.equal(
    guidedVehicleViewClassifier.classify(f, requested, "real").source,
    "guided-prototype",
  );
  assert.equal(
    guidedVehicleViewClassifier.classify(f, requested, "demo").source,
    "demo",
  );
  let c = initialCoverage(true);
  const ids = [];
  for (let i = 0; i < 12; i++) {
    ids.push(c.currentSector);
    c = capture(c, true);
  }
  assert.deepEqual(
    ids,
    SCAN_SECTORS.map((s) => s.id),
  );
});
test("selector keeps all 12 guided sectors in 16 key frames; motion proxy detects pixel change", () => {
  let c = initialCoverage(true);
  const frames = [];
  while (c.currentSector) {
    const f = frame(c, `s${frames.length}`);
    frames.push(f);
    c = recordSectorFrame(c, f, undefined, true).coverage;
  }
  const selected = selectKeyFrames(frames);
  assert.equal(selected.length, 16);
  assert.equal(new Set(selected.map((f) => f.scan?.sector)).size, 12);
  const estimator = new FrameMotionEstimator();
  assert.equal(
    estimator.observe(new Uint8ClampedArray([0, 0, 0, 255])),
    undefined,
  );
  assert.equal(
    estimator.observe(new Uint8ClampedArray([255, 255, 255, 255])),
    1,
  );
  assert.equal(
    estimator.observe(new Uint8ClampedArray([255, 255, 255, 255])),
    0,
  );
});
test("Unknown guided sectors survive session refresh and invalid sector metadata is rejected", () => {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
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
    const saved = {
      version: 1 as const,
      mode: "MOCK" as const,
      inspectionId: "guided",
      vehicle: { id: "car", model: "Car", plate: "ABC" },
      createdAt: new Date().toISOString(),
      scanDuration: 10,
      capturedFrameCount: 20,
      keyFrameCount: 16,
      cameraMode: "real" as const,
      status: "completed" as const,
      uploadComplete: true,
      scenario: "no_damage" as const,
      unavailableScanSectors: ["front_left" as const],
    };
    saveInspectionSession(saved);
    const recovered = readInspectionSession("MOCK");
    assert.deepEqual(recovered?.unavailableScanSectors, ["front_left"]);
    assert.ok(
      unavailableAreas(
        resultFor("no_damage", "guided"),
        recovered!.unavailableScanSectors!,
      ).missingAreas?.length,
    );
    values.set(
      sessionStorageKey,
      JSON.stringify({ ...saved, unavailableScanSectors: ["fake"] }),
    );
    assert.equal(readInspectionSession("MOCK"), null);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
