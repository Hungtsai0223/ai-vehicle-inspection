"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DemoLabel } from "@/components/ui/primitives";
import {
  ScanOverlay,
  ScanProgress,
  CoverageIndicator,
  ScanStatusBadge,
} from "@/components/scan/scan-components";
import { useInspection } from "@/components/inspection/inspection-context";
import { inspectionApi } from "@/lib/api";
import type { ValidationState, Scenario, KeyFrame } from "@/types/inspection";
export default function Scan() {
  const router = useRouter();
  const ctx = useInspection();
  const [validation, setValidation] = useState<ValidationState>("GOOD");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  async function start() {
    if (running) return;
    setRunning(true);
    setError("");
    try {
      const id = await ctx.begin();
      const start = performance.now();
      timer.current = setInterval(() => {
        const p = Math.min(100, (performance.now() - start) / 90);
        ctx.setProgress(p);
        if (p >= 100) {
          if (timer.current) clearInterval(timer.current);
          const frames: KeyFrame[] = Array.from({ length: 16 }, (_, i) => ({
            id: `mock_${i}`,
            image: new Blob(["mock-frame"], { type: "text/plain" }),
            angle: i * 22.5,
            timestamp: i * 560,
          }));
          inspectionApi
            .uploadKeyFrames(id, frames)
            .then(() => {
              ctx.setStatus("analyzing");
              router.push("/analyzing");
            })
            .catch((e) => {
              setError(e instanceof Error ? e.message : "上傳失敗");
              setRunning(false);
            });
        }
      }, 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法開始掃描");
      setRunning(false);
    }
  }
  return (
    <div className="scan-page">
      <div className="scan-heading">
        <h1>
          <span>AI</span> 車況掃描
        </h1>
        <p>請依照提示，環繞車輛掃描</p>
      </div>
      <ScanOverlay state={validation} />
      <div className="scan-bottom">
        <ScanStatusBadge state={validation} />
        <ScanProgress progress={ctx.progress} />
        <CoverageIndicator
          progress={ctx.progress}
          incomplete={ctx.scenario === "incomplete"}
        />
        {ctx.poorNetwork && (
          <p role="status" className="notice">
            網路狀況不佳，影像已暫存於裝置，恢復連線後將自動上傳。
            <small>Demo：僅模擬提示，尚未實作離線暫存。</small>
          </p>
        )}
        {ctx.scenario === "incomplete" && (
          <p className="notice">
            右側車身未完整掃描 · Unknown
            <br />
            <small>仍可完成檢查，交由後續人工確認。</small>
          </p>
        )}
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        <Button onClick={start} disabled={running}>
          {running ? "正在擷取影像…" : "開始模擬掃描"}
        </Button>
        <details className="demo-controls">
          <summary>Demo Controls · 模擬情境</summary>
          <DemoLabel />
          <div className="control-grid">
            {(
              [
                ["Good", "GOOD"],
                ["Too Close", "TOO_CLOSE"],
                ["Too Far", "TOO_FAR"],
                ["Blur", "BLURRY"],
                ["Too Fast", "TOO_FAST"],
                ["Dark", "TOO_DARK"],
              ] as const
            ).map(([label, value]) => (
              <button
                aria-pressed={validation === value}
                onClick={() => setValidation(value)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            辨識結果
            <select
              aria-label="辨識結果"
              value={ctx.scenario}
              disabled={running}
              onChange={(e) => ctx.setScenario(e.target.value as Scenario)}
            >
              <option value="damage">Potential Damage</option>
              <option value="clear">無異常</option>
              <option value="incomplete">覆蓋不足 · Unknown</option>
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={ctx.poorNetwork}
              onChange={(e) => ctx.setPoorNetwork(e.target.checked)}
            />
            模擬網路不佳提示
          </label>
        </details>
      </div>
    </div>
  );
}
