import { Check, LoaderCircle } from "lucide-react";
import { mockConfig } from "@/lib/mock-data";
const steps = [
  { label: "影像品質確認", completedAt: 500 },
  { label: "車體區域辨識", completedAt: 1000 },
  { label: "關鍵影格擷取", completedAt: 1500 },
  { label: "車損辨識", completedAt: 2000 },
  { label: "租車前後影像比對", completedAt: 3000 },
];
export function AnalysisProgress({ progress }: { progress: number }) {
  const elapsed = (progress / 100) * mockConfig.analysisDurationMs;
  return (
    <ol className="analysis-steps">
      {steps.map(({ label, completedAt }, i) => {
        const done = elapsed >= completedAt;
        const active =
          !done && (i === 0 || elapsed >= steps[i - 1].completedAt);
        return (
          <li
            key={label}
            className={done ? "complete" : active ? "active" : ""}
          >
            {done ? (
              <Check size={20} />
            ) : active ? (
              <LoaderCircle className="spin" size={20} />
            ) : (
              <span className="step-dot" />
            )}
            <span>{label}</span>
            {done ? (
              <small>完成</small>
            ) : active ? (
              <small>處理中</small>
            ) : (
              <small>待處理</small>
            )}
          </li>
        );
      })}
    </ol>
  );
}
