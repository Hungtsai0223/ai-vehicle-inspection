import assert from "node:assert/strict";
import { test } from "node:test";
import { importKeyframes } from "../lib/keyframe-import";
const blob = (name: string, type = "image/jpeg") =>
  Object.assign(new Blob([new Uint8Array([255, 216, 255])], { type }), {
    name,
  });
const row = (i = 0) => ({
  frame_index: i,
  timestamp_seconds: i * 0.125,
  selected: true,
  preprocessed: true,
  original_image: `images_original/frame_${i}.jpg`,
  image: `images/frame_${i}.jpg`,
  quality: { mean_luma: 220, blur_score: 100 },
  original_quality: { mean_luma: 128, blur_score: 80 },
});
const metadata = (rows: unknown[] = [row()]) => ({
  schema_version: 1,
  status: "complete",
  coverage_verified: false,
  keyframes: rows,
});
test("Python source frames bridge to unchanged API metadata, milliseconds, raw exposure and unknown viewpoints", () => {
  const frames = importKeyframes(metadata([row(2), row(1)]), [
    blob("frame_1.jpg"),
    blob("frame_2.jpg"),
  ]);
  assert.deepEqual(
    frames.map((f) => f.timestamp),
    [125, 250],
  );
  assert.equal(frames[0].vehicleView, "unknown");
  assert.equal(frames[0].quality.exposureScore, 128 / 255);
  assert.equal(frames[0].quality.blurScore, undefined);
  assert.equal(frames[0].scan, undefined);
});
test("import is bounded to 16 distinct chronological frames without inventing missing images", () => {
  const rows = Array.from({ length: 40 }, (_, i) => row(i));
  const frames = importKeyframes(
    metadata(rows),
    rows.map((_, i) => blob(`frame_${i}.jpg`)),
  );
  assert.equal(frames.length, 16);
  assert.equal(new Set(frames.map((f) => f.id)).size, 16);
  assert.equal(frames[0].timestamp, 0);
  assert.equal(frames.at(-1)?.timestamp, 4875);
  assert.throws(() => importKeyframes(metadata(rows), [blob("frame_0.jpg")]));
});
test("failed schema, enhanced-only evidence, duplicate names/indexes and invalid source metadata are rejected", () => {
  const valid = row();
  const images = [blob("frame_0.jpg")];
  for (const value of [
    null,
    { ...metadata(), status: "failed" },
    metadata([{ ...valid, original_image: undefined }]),
    metadata([{ ...valid, original_image: "../frame_0.jpg" }]),
    metadata([{ ...valid, timestamp_seconds: NaN }]),
    metadata([
      { ...valid, original_quality: { mean_luma: 256, blur_score: 1 } },
    ]),
    metadata([valid, valid]),
  ])
    assert.throws(() => importKeyframes(value, images));
  assert.throws(() => importKeyframes(metadata(), [...images, ...images]));
  assert.throws(() =>
    importKeyframes(metadata(), [blob("frame_0.jpg", "image/png")]),
  );
});
test("unprocessed metadata may use images and does not require enhanced originals", () => {
  const f = importKeyframes(
    metadata([{ ...row(), preprocessed: false, original_image: undefined }]),
    [blob("frame_0.jpg")],
  );
  assert.equal(f.length, 1);
});
