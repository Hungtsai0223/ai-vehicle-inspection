/** Photo-difference coordinates, not a calibrated camera pose or verified damage. */
export function comparisonRows(payload) {
  if (payload?.status !== "success" || !Array.isArray(payload.results))
    throw new Error("照片比對回應無效");
  return payload.results.map((row) => {
    if (
      !Number.isInteger(row.image_index) ||
      row.image_index < 0 ||
      !Number.isFinite(row.image_width) ||
      !Number.isFinite(row.image_height) ||
      row.image_width <= 0 ||
      row.image_height <= 0 ||
      !Array.isArray(row.damages)
    )
      throw new Error("缺少影像尺寸或差異資料");
    for (const damage of row.damages) {
      if (
        !Number.isFinite(damage.pixel_x) ||
        !Number.isFinite(damage.pixel_y) ||
        damage.pixel_x < 0 ||
        damage.pixel_y < 0 ||
        damage.pixel_x >= row.image_width ||
        damage.pixel_y >= row.image_height
      )
        throw new Error("影像座標超出範圍");
    }
    return row;
  });
}
export function illustrativeRay(row, damage) {
  comparisonRows({
    status: "success",
    results: [{ ...row, damages: [damage] }],
  });
  const x = damage.pixel_x / row.image_width;
  const y = damage.pixel_y / row.image_height;
  // Deliberately approximate left-side placement; NEVER call this solvePnP/calibration.
  const height = (y - 0.5) * 1.2 + 0.3;
  const z = (0.5 - x) * 3;
  return { origin: [3.5, height, z], direction: [-1, 0, 0], calibrated: false };
}
