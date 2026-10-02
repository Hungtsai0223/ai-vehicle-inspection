"use client";
import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import {
  ScanOverlay,
  ScanProgress,
  CoverageIndicator,
} from "@/components/scan/scan-components";
import { DemoControls } from "@/components/scan/demo-controls";
import { useDemoScan } from "@/components/scan/use-demo-scan";
import { useInspection } from "@/components/inspection/inspection-context";
import { mockVehicle } from "@/lib/mock-data";
import type { ScanState } from "@/types/inspection";
export default function Scan() {
  const ctx = useInspection();
  const [validation, setValidation] = useState<ScanState>("good");
  const scan = useDemoScan();
  return (
    <div className="scan-page">
      <p className="scan-vehicle-name">{mockVehicle.name}</p>
      <ScanOverlay state={validation} progress={scan.progress} />
      <div className="scan-bottom">
        {scan.phase === "complete" && (
          <p className="scan-complete" role="status">
            <CheckCircle size={18} />
            車輛掃描完成
          </p>
        )}
        <ScanProgress progress={scan.progress} />
        <CoverageIndicator
          progress={scan.progress}
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
            <small>仍可完成檢查，交由後續人工確認。</small>
          </p>
        )}
        {scan.error && (
          <p role="alert" className="notice">
            {scan.error}
          </p>
        )}
        <Button onClick={scan.start} disabled={scan.running}>
          {scan.phase === "complete"
            ? "掃描完成，準備分析…"
            : scan.running
              ? "正在擷取影像…"
              : "開始模擬掃描"}
        </Button>
        <DemoControls
          state={validation}
          onStateChange={setValidation}
          scenario={ctx.scenario}
          onScenarioChange={ctx.setScenario}
          poorNetwork={ctx.poorNetwork}
          onNetworkChange={ctx.setPoorNetwork}
          disabled={scan.running}
        />
      </div>
    </div>
  );
}
