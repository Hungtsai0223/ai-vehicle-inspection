import { ArrowUpRight, Timer, ChartNoAxesCombined } from "lucide-react";
import {
  MetricCard,
  ExperimentTable,
} from "@/components/dashboard/dashboard-components";
import { PerformanceBar } from "@/components/dashboard/performance-bar";
import { metrics, accuracy } from "@/lib/mock-data";
import { Card, Action } from "@/components/ui/primitives";
export default function Dashboard() {
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
        以下數據皆為 MOCK / DEMO DATA，非實測結果，不代表 AI 模型效能。
      </div>
      <h2 className="metrics-heading">Prototype Metrics — Mock Data</h2>
      <div className="metrics">
        {metrics.map(([label, value]) => (
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
            {accuracy.map(([name, value]) => (
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
              <strong>78 sec</strong>
              <div style={{ width: "100%" }} />
            </div>
            <div>
              <span>AI Guided Scan</span>
              <strong>28.6 sec</strong>
              <div className="ai-bar" style={{ width: "36.7%" }} />
            </div>
          </div>
          <div className="reduction">
            <ArrowUpRight size={25} />
            <strong>63%</strong>
            <span>
              Time Reduction
              <br />
              <small>根據示範數值計算</small>
            </span>
          </div>
        </Card>
      </div>
      <ExperimentTable />
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
