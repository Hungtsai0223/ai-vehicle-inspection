"use client";
import { useState } from "react";
import type { ExperimentResult } from "@/types/experiment";
import { damageLabels } from "@/lib/inspection-labels";
const lightingLabels = {
  daylight: "Daylight",
  indoor: "Indoor",
  low_light: "Low Light",
};
export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <small>DEMO DATA</small>
    </section>
  );
}
export function ExperimentTable({
  results,
  source,
}: {
  results: ExperimentResult[];
  source: "demo" | "real";
}) {
  const [distance, setDistance] = useState("");
  const [lighting, setLighting] = useState("");
  const [damage, setDamage] = useState("");
  const rows = results.filter(
    (r) =>
      (!distance || String(r.distanceMeters) === distance) &&
      (!lighting || r.lighting === lighting) &&
      (!damage || r.damageType === damage),
  );
  return (
    <section className="card experiment">
      <h2>3D 列印車損辨識實驗</h2>
      <p>透過控制距離、角度、光線與車損類型，評估模型辨識穩定性。</p>
      <p className="experiment-demo-note">
        {source === "demo"
          ? "MOCK DATA · 以下為 UI 展示用模擬數據，待實驗完成後替換。"
          : "REAL EXPERIMENT DATA · 團隊提供的 3D 列印實驗量測；此表格不推論整體準確率。"}
      </p>
      <div className="filters">
        {[
          [
            "Distance",
            distance,
            setDistance,
            Array.from(
              new Set(results.map((row) => String(row.distanceMeters))),
            ).sort((a, b) => Number(a) - Number(b)),
          ],
          [
            "Lighting",
            lighting,
            setLighting,
            Array.from(new Set(results.map((row) => row.lighting))),
          ],
          [
            "Damage Type",
            damage,
            setDamage,
            Array.from(new Set(results.map((row) => row.damageType))),
          ],
        ].map(([label, value, setter, options]) => (
          <label key={label as string}>
            {label as string}
            <select
              aria-label={label as string}
              value={value as string}
              onChange={(e) => (setter as (s: string) => void)(e.target.value)}
            >
              <option value="">全部</option>
              {(options as string[]).map((o) => (
                <option key={o} value={o}>
                  {label === "Distance"
                    ? `${Number(o).toFixed(1)} m`
                    : label === "Lighting"
                      ? lightingLabels[o as ExperimentResult["lighting"]]
                      : damageLabels[o as ExperimentResult["damageType"]].en}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                "Test",
                "Distance",
                "Angle",
                "Lighting",
                "Damage",
                "Confidence",
                "Result",
              ].map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.distanceMeters.toFixed(1)} m</td>
                <td>{r.angleDegrees}°</td>
                <td>{lightingLabels[r.lighting]}</td>
                <td>{damageLabels[r.damageType].en}</td>
                <td>{Math.round(r.confidence * 100)}%</td>
                <td>
                  <span
                    className={r.detected ? "success-text" : "warning-text"}
                  >
                    {r.detected ? "✓ Detected" : "! Missed"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="empty">
            沒有符合條件的{source === "demo" ? "模擬" : "實驗"}紀錄
          </p>
        )}
      </div>
    </section>
  );
}
