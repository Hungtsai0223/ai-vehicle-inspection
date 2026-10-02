import type { InspectionResult } from "@/types/inspection";
const duration = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
export function InspectionSummary({ result }: { result: InspectionResult }) {
  const confidence = result.damages.map((d) => Math.round(d.confidence * 100));
  const low = Math.min(...confidence),
    high = Math.max(...confidence);
  const values = [
    ["掃描時間", `${duration.format(result.scanDurationSeconds)} sec`],
    ["分析時間", `${duration.format(result.processingTimeSeconds)} sec`],
    ["有效影格", `${result.keyFrameCount} frames`],
    ["掃描覆蓋率", `${Math.round(result.coverage * 100)}%`],
    ["疑似異常", `${result.damages.length}`],
    [
      "AI 信心度",
      result.damages.length
        ? low === high
          ? `${low}%`
          : `${low}–${high}%`
        : "—",
    ],
  ];
  return (
    <dl className="summary-grid">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
