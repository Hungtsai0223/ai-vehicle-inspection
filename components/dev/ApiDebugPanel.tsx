"use client";
import { useInspection } from "@/components/inspection/inspection-context";
export function ApiDebugPanel() {
  const ctx = useInspection();
  if (process.env.NODE_ENV !== "development") return null;
  const values = [
    ["Inspection ID", ctx.inspectionId || "—"],
    ["Mode", ctx.mode],
    ["Inspection Status", ctx.status],
    ["Frame count", String(ctx.frames.length)],
    ["Coverage", `${Math.round(ctx.coverage * 100)}%`],
    [
      "Processing status",
      ctx.status === "processing"
        ? "Running"
        : ctx.status === "completed"
          ? "Finished"
          : ctx.status === "failed"
            ? "Failed / retry available"
            : "Waiting",
    ],
  ];
  return (
    <aside className="api-debug-panel" aria-label="Development API debug">
      <details>
        <summary>API Debug · {ctx.mode}</summary>
        <dl>
          {values.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <strong>Raw result JSON</strong>
        <pre>{JSON.stringify(ctx.result, null, 2)}</pre>
        <small>僅開發環境顯示。模擬掃描預覽覆蓋率不代表模型測量。</small>
      </details>
    </aside>
  );
}
