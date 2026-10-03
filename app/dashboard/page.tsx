import { ArrowUpRight, Timer, ChartNoAxesCombined } from "lucide-react";
import {
  MetricCard,
  ExperimentTable,
} from "@/components/dashboard/dashboard-components";
import { PerformanceBar } from "@/components/dashboard/performance-bar";
import {
  demoMetrics,
  demoAccuracy,
  demoEfficiency,
  demoExperimentResults,
} from "@/data/demo-metrics";
import { realExperimentResults } from "@/data/experiment-results";
import { Card, Action } from "@/components/ui/primitives";
export default function Dashboard() {
  const real = realExperimentResults.length > 0;
  const reduction = Math.round(
    (1 - demoEfficiency.guidedSeconds / demoEfficiency.traditionalSeconds) *
      100,
  );
  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <h1>
            AI Vehicle Inspection<span>Performance Dashboard</span>
          </h1>
          <p>評審、工程師與營運團隊的檢測成效展示</p>
        </div>
        <span className="demo-label">DEMO / MOCK DATA</span>
      </div>
      <div className="mock-notice">
        績效卡片與圖表皆為 MOCK / DEMO DATA，非實測結果，不代表 AI
        模型效能。實驗表格另標示資料來源。
      </div>
      <h2 className="metrics-heading">Prototype Metrics — Mock Data</h2>
      <div className="metrics">
        {demoMetrics.map(([label, value]) => (
          <MetricCard key={label} label={label} value={value} />
        ))}
      </div>
      <div className="chart-columns">
        <Card>
          <div className="row">
            <h2>Damage Detection Accuracy</h2>
            <ChartNoAxesCombined size={20} />
          </div>
          <p>各車損類型辨識率 · 模擬</p>
          <div className="accuracy-bars">
            {demoAccuracy.map(([name, value]) => (
              <PerformanceBar key={name} label={name} value={value} />
            ))}
          </div>
        </Card>
        <Card>
          <div className="row">
            <h2>Inspection Efficiency</h2>
            <Timer size={20} />
          </div>
          <p>Mock Comparison · 還車檢查時間比較</p>
          <div className="time-chart">
            <div>
              <span>Traditional Photo Process</span>
              <strong>{demoEfficiency.traditionalSeconds} sec</strong>
              <div style={{ width: "100%" }} />
            </div>
            <div>
              <span>AI Guided Scan</span>
              <strong>{demoEfficiency.guidedSeconds} sec</strong>
              <div
                className="ai-bar"
                style={{
                  width: `${(demoEfficiency.guidedSeconds / demoEfficiency.traditionalSeconds) * 100}%`,
                }}
              />
            </div>
          </div>
          <div className="reduction">
            <ArrowUpRight size={25} />
            <strong>{reduction}%</strong>
            <span>
              Time Reduction
              <br />
              <small>根據示範數值計算</small>
            </span>
          </div>
        </Card>
      </div>
      <ExperimentTable
        results={real ? realExperimentResults : demoExperimentResults}
        source={real ? "real" : "demo"}
      />
      {!real && (
        <p className="notice">
          真實實驗資料尚未提供，待 3D 列印車損實驗完成後填入量測結果。
        </p>
      )}
      <div className="dashboard-bottom">
        <p>
          Frontend → Inspection Service → API Adapter → AI Backend
          <br />
          <small>此展示使用模擬資料，實際模型待團隊串接。</small>
        </p>
        <Action href="/return">開啟使用者 Demo</Action>
      </div>
    </div>
  );
}
