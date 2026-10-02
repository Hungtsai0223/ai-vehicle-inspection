import { Check, LoaderCircle } from "lucide-react";
import type { ProcessingStage } from "@/types/inspection";
export const processingStages: { stage: ProcessingStage; label: string }[] = [
  { stage: "image_validation", label: "影像品質確認" },
  { stage: "vehicle_part_detection", label: "車體區域辨識" },
  { stage: "damage_detection", label: "車損辨識" },
  { stage: "before_after_comparison", label: "租車前後影像比對" },
  { stage: "completed", label: "分析完成" },
];
export function AnalysisProgress({
  stage,
  failed = false,
}: {
  stage: ProcessingStage;
  failed?: boolean;
}) {
  const index = processingStages.findIndex((step) => step.stage === stage);
  return (
    <ol className="analysis-steps">
      {processingStages.map((step, i) => {
        const done = i < index || stage === "completed";
        const active = i === index && !failed;
        return (
          <li
            key={step.stage}
            className={done ? "complete" : active ? "active" : ""}
          >
            {done ? (
              <Check size={20} />
            ) : active ? (
              <LoaderCircle className="spin" size={20} />
            ) : (
              <span className="step-dot" />
            )}
            <span>{step.label}</span>
            <small>
              {done
                ? "完成"
                : active
                  ? "處理中"
                  : failed && i === index
                    ? "待重試"
                    : "待處理"}
            </small>
          </li>
        );
      })}
    </ol>
  );
}
