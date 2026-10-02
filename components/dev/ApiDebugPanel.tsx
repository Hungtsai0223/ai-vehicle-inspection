"use client";
import Image from "next/image";
import { useInspection } from "@/components/inspection/inspection-context";
export function ApiDebugPanel() {
  const ctx = useInspection();
  if (process.env.NODE_ENV !== "development") return null;
  const values = [
    ["Inspection ID", ctx.inspectionId || "—"],
    ["Mode", ctx.mode],
    ["Camera", ctx.cameraMode === "real" ? "REAL" : "DEMO"],
    ["Captured total", String(ctx.capturedFrameCount)],
    ["Inspection Status", ctx.status],
    ["Frame buffer", String(ctx.frames.length)],
    ["Key frames", String(ctx.keyFrameCount)],
    ["Uploaded", String(ctx.uploadComplete)],
    ["Upload state", ctx.transferStage],
    ["Backend stage", ctx.processingStage],
    ["Backend progress", `${Math.round(ctx.processingProgress)}%`],
    [
      "Coverage",
      ctx.result
        ? `${Math.round(ctx.result.coverage * 100)}%`
        : "Awaiting result",
    ],
    [
      "Prototype progress",
      `${Math.round(ctx.progress)}% (${ctx.cameraMode === "real" ? "time guide" : "demo"})`,
    ],
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
        {ctx.progress >= 100 && ctx.frames.length > 0 && (
          <details className="key-frame-preview">
            <summary>Key Frames · {ctx.frames.length}</summary>
            <div className="key-frame-grid">
              {ctx.frames.map((frame) => (
                <figure key={frame.id}>
                  {frame.previewUrl && (
                    <Image
                      src={frame.previewUrl}
                      unoptimized
                      width={120}
                      height={80}
                      alt={`關鍵影格 ${frame.vehicleView} ${Math.round(frame.timestamp / 1000)} 秒`}
                    />
                  )}
                  <figcaption>
                    {frame.vehicleView} · {(frame.timestamp / 1000).toFixed(1)}s
                  </figcaption>
                </figure>
              ))}
            </div>
            <small>
              方位依 Prototype 進度估計；
              {ctx.cameraMode === "demo"
                ? "Demo Image，非實拍影像。"
                : "影格只暫存在本機記憶體。"}
            </small>
          </details>
        )}
        <strong>Raw result JSON</strong>
        <pre>{JSON.stringify(ctx.result, null, 2)}</pre>
        <small>
          僅開發環境顯示。拍攝進度與方位是 Prototype 引導，不代表模型覆蓋率。
        </small>
      </details>
    </aside>
  );
}
