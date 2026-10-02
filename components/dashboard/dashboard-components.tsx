"use client";
import { useState } from "react";
import { experiments } from "@/lib/mock-data";
export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <small>DEMO DATA</small>
    </section>
  );
}
export function ExperimentTable() {
  const [distance, setDistance] = useState("");
  const [lighting, setLighting] = useState("");
  const [damage, setDamage] = useState("");
  const rows = experiments.filter(
    (r) =>
      (!distance || r.distance === distance) &&
      (!lighting || r.lighting === lighting) &&
      (!damage || r.damage === damage),
  );
  return (
    <section className="card experiment">
      <h2>3D 列印車損辨識實驗</h2>
      <p>透過控制距離、角度、光線與車損類型，評估模型辨識穩定性。</p>
      <p className="experiment-demo-note">
        以下為 UI 展示用模擬數據，待實驗完成後替換。
      </p>
      <div className="filters">
        {[
          [
            "Distance",
            distance,
            setDistance,
            ["1.0 m", "1.5 m", "2.0 m", "3.0 m"],
          ],
          ["Lighting", lighting, setLighting, ["Daylight", "Low Light"]],
          ["Damage Type", damage, setDamage, ["Scratch", "Dent"]],
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
                <option key={o}>{o}</option>
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
                <td>{r.distance}</td>
                <td>{r.angle}</td>
                <td>{r.lighting}</td>
                <td>{r.damage}</td>
                <td>{r.confidence}%</td>
                <td>
                  <span
                    className={
                      r.result === "Detected" ? "success-text" : "warning-text"
                    }
                  >
                    {r.result === "Detected" ? "✓" : "!"} {r.result}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="empty">沒有符合條件的模擬紀錄</p>}
      </div>
    </section>
  );
}
