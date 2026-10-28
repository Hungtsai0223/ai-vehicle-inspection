import assert from "node:assert/strict";
import { test } from "node:test";
import { comparisonRows, illustrativeRay } from "../poc-mapping.mjs";
const row = {
  image_index: 0,
  image_width: 400,
  image_height: 200,
  damage_count: 1,
  damages: [{ pixel_x: 0, pixel_y: 0 }],
};
test("PoC reads nested per-pair damages and preserves zero coordinates without 1920x1080 fallback", () => {
  const rows = comparisonRows({ status: "success", results: [row] });
  assert.equal(rows[0].damages[0].pixel_x, 0);
  assert.deepEqual(illustrativeRay(rows[0], rows[0].damages[0]), {
    origin: [3.5, -0.3, 1.5],
    direction: [-1, 0, 0],
    calibrated: false,
  });
  const scaled = { ...row, image_width: 800, image_height: 400 };
  assert.deepEqual(
    illustrativeRay(row, { pixel_x: 200, pixel_y: 100 }),
    illustrativeRay(scaled, { pixel_x: 400, pixel_y: 200 }),
  );
});
test("PoC handles multiple pairs, no differences, and refuses missing dimensions or invalid coordinates", () => {
  assert.equal(
    comparisonRows({
      status: "success",
      results: [row, { ...row, image_index: 1, damages: [] }],
    }).length,
    2,
  );
  for (const value of [
    { status: "failed" },
    { status: "success", results: [{ ...row, image_width: undefined }] },
    {
      status: "success",
      results: [{ ...row, damages: [{ pixel_x: 401, pixel_y: 0 }] }],
    },
  ])
    assert.throws(() => comparisonRows(value));
});
