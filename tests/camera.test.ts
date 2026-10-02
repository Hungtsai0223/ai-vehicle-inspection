import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CameraSession,
  CameraAccessError,
  cameraErrorState,
  environmentCameraConstraints,
  getPreferredCameraMode,
  requestEnvironmentCamera,
} from "../lib/camera-access";
import {
  frameDimensions,
  estimateVehicleView,
  estimateExposure,
  captureCameraFrame,
  frameSamplingIntervalMs,
} from "../lib/camera-frame-capture";
import { MemoryFrameStore } from "../lib/frame-store";
import { selectKeyFrames } from "../lib/frame-selection";
import { createMockFrame } from "../lib/mock-frames";
function fakeStream() {
  const stopped = [0, 0];
  return {
    stream: {
      getTracks: () =>
        stopped.map((_, i) => ({
          stop: () => {
            stopped[i]++;
          },
        })),
    } as unknown as MediaStream,
    stopped,
  };
}
test("camera request asks for environment video only; server render defaults safely to demo", () => {
  assert.deepEqual(environmentCameraConstraints, {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  });
  assert.equal(getPreferredCameraMode(), "demo");
  assert.equal(frameSamplingIntervalMs, 500);
});
test("camera access is guarded outside a secure browser context", async () => {
  await assert.rejects(
    requestEnvironmentCamera(),
    (error: unknown) =>
      error instanceof CameraAccessError && error.state === "insecure_context",
  );
});
test("camera permission failures map to friendly states without exposing device errors", () => {
  assert.equal(
    cameraErrorState(
      new DOMException("private device details", "NotAllowedError"),
    ),
    "permission_denied",
  );
  assert.equal(
    cameraErrorState(new DOMException("no device", "NotFoundError")),
    "camera_unavailable",
  );
  assert.equal(
    cameraErrorState(new DOMException("busy", "NotReadableError")),
    "camera_unavailable",
  );
  assert.equal(
    cameraErrorState(new CameraAccessError("insecure_context")),
    "insecure_context",
  );
  assert.ok(
    !new CameraAccessError("permission_denied").message.includes("private"),
  );
});
test("camera session shares a pending permission request across mount-cleanup-remount", async () => {
  const { stream, stopped } = fakeStream();
  let resolve!: (stream: MediaStream) => void;
  let requests = 0;
  const session = new CameraSession(() => {
    requests++;
    return new Promise((done) => {
      resolve = done;
    });
  });
  const first = session.open();
  session.close();
  const second = session.open();
  assert.equal(first, second);
  resolve(stream);
  assert.equal(await second, stream);
  assert.equal(requests, 1);
  assert.deepEqual(stopped, [0, 0]);
  session.close();
  assert.deepEqual(stopped, [1, 1]);
  session.close();
  assert.deepEqual(stopped, [1, 1]);
});
test("permission resolving after leaving the page immediately stops ALL tracks", async () => {
  const { stream, stopped } = fakeStream();
  let resolve!: (stream: MediaStream) => void;
  const session = new CameraSession(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = session.open();
  session.close();
  resolve(stream);
  await assert.rejects(
    pending,
    (error: unknown) =>
      error instanceof CameraAccessError && error.state === "paused",
  );
  assert.deepEqual(stopped, [1, 1]);
});
test("failed permission requests can be retried without reusing a stopped stream", async () => {
  const { stream, stopped } = fakeStream();
  let requests = 0;
  const session = new CameraSession(async () => {
    requests++;
    if (requests === 1) throw new DOMException("denied", "NotAllowedError");
    return stream;
  });
  await assert.rejects(session.open());
  assert.equal(await session.open(), stream);
  session.close();
  assert.equal(requests, 2);
  assert.deepEqual(stopped, [1, 1]);
});
test("capture resize preserves portrait/landscape aspect ratio and does not upscale", () => {
  assert.deepEqual(frameDimensions(1920, 1080), { width: 1280, height: 720 });
  assert.deepEqual(frameDimensions(1080, 1920), { width: 720, height: 1280 });
  assert.deepEqual(frameDimensions(640, 480), { width: 640, height: 480 });
  assert.throws(() => frameDimensions(0, 480));
});
test("view labels are progress estimates; lightweight exposure is normalized luminance", () => {
  assert.deepEqual([0, 25, 50, 75, 95].map(estimateVehicleView), [
    "front",
    "left",
    "rear",
    "right",
    "right",
  ]);
  assert.equal(estimateExposure(new Uint8ClampedArray([0, 0, 0, 255])), 0);
  assert.ok(
    Math.abs(
      estimateExposure(new Uint8ClampedArray([255, 255, 255, 255]))! - 1,
    ) < 0.00001,
  );
  assert.equal(estimateExposure(new Uint8ClampedArray()), undefined);
});
test("video capture encodes JPEG at 0.8, resizes, and returns owned Blob URL metadata", async () => {
  let drawing: unknown[] = [];
  let format = "";
  let quality = 0;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (...args: unknown[]) => {
        drawing = args;
      },
    }),
    toBlob: (done: (blob: Blob) => void, type: string, value: number) => {
      format = type;
      quality = value;
      done(new Blob([new Uint8Array([255, 216, 255])], { type }));
    },
  } as unknown as HTMLCanvasElement;
  const qualityCanvas = {
    getContext: () => ({
      drawImage() {},
      getImageData: () => ({
        data: new Uint8ClampedArray([128, 128, 128, 255]),
      }),
    }),
  } as unknown as HTMLCanvasElement;
  const video = {
    readyState: 2,
    videoWidth: 1920,
    videoHeight: 1080,
  } as HTMLVideoElement;
  const frame = await captureCameraFrame(video, {
    timestamp: 7000,
    prototypeProgress: 30,
    canvas,
    qualityCanvas,
  });
  assert.ok(frame?.blob?.size);
  assert.equal(format, "image/jpeg");
  assert.equal(quality, 0.8);
  assert.deepEqual(drawing.slice(1), [0, 0, 1280, 720]);
  assert.equal(frame?.timestamp, 7000);
  assert.equal(frame?.vehicleView, "left");
  assert.ok(frame?.previewUrl?.startsWith("blob:"));
  assert.equal(frame?.quality.vehicleCoverage, undefined);
  assert.equal(frame?.quality.blurScore, undefined);
  URL.revokeObjectURL(frame!.previewUrl!);
  assert.equal(
    await captureCameraFrame({ readyState: 0 } as HTMLVideoElement, {
      timestamp: 0,
      prototypeProgress: 0,
    }),
    null,
  );
});
test("key-frame selection balances four views and samples nonconsecutive frames", () => {
  const views = ["front", "left", "rear", "right"] as const;
  const frames = Array.from({ length: 80 }, (_, i) => ({
    ...createMockFrame(i, i * 500),
    vehicleView: views[Math.floor(i / 20)],
  }));
  const keyFrames = selectKeyFrames(frames);
  assert.equal(keyFrames.length, 16);
  for (const view of views)
    assert.equal(
      keyFrames.filter((frame) => frame.vehicleView === view).length,
      4,
    );
  assert.ok(
    keyFrames.every(
      (frame, i) => i === 0 || frame.timestamp > keyFrames[i - 1].timestamp,
    ),
  );
  assert.equal(selectKeyFrames(frames.slice(0, 5)).length, 5);
});
test("frame store bounds memory, retains all views, and releases discarded/finished frames once", () => {
  const released: string[] = [];
  const store = new MemoryFrameStore(20, (frame) => released.push(frame.id));
  const views = ["front", "left", "rear", "right"] as const;
  for (let i = 0; i < 80; i++)
    store.addFrame({
      ...createMockFrame(i, i * 500),
      vehicleView: views[Math.floor(i / 20)],
    });
  assert.equal(store.getFrames().length, 20);
  for (const view of views)
    assert.ok(store.getFrames().some((frame) => frame.vehicleView === view));
  assert.equal(released.length, 60);
  assert.equal(store.retainKeyFrames().length, 16);
  assert.equal(released.length, 64);
  store.clear();
  store.clear();
  assert.equal(store.getFrames().length, 0);
  assert.equal(released.length, 80);
  assert.equal(new Set(released).size, 80);
});
