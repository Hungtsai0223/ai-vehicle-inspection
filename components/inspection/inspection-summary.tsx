import type { InspectionResult } from "@/types/inspection";
export function InspectionSummary({ result }: { result: InspectionResult }) {
  const values = [
    ["掃描時間", `${result.scanDurationSeconds} sec`],
    ["有效影格", `${result.keyFrameCount} frames`],
    ["掃描覆蓋率", `${Math.round(result.coverage * 100)}%`],
    ["疑似異常", `${result.damages.length}`],
    [
      "AI 信心度",
      result.damages.length
        ? `${Math.round(result.damages[0].confidence * 100)}%`
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
