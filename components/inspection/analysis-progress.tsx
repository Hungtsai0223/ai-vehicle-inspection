import { Check, LoaderCircle } from "lucide-react";
const steps = [
  "影像品質確認",
  "關鍵影格上傳",
  "車體區域辨識",
  "車損辨識",
  "前後影像比對",
];
export function AnalysisProgress({
  progress,
  stage,
  failed = false,
}: {
  progress: number;
  stage: "uploading" | "processing" | "completed";
  failed?: boolean;
}) {
  // Upload is an actual service operation. Backend progress is coarse: the remaining
  // labels are illustrative phases, not assertions that a particular CV model ran.
  const completedCount =
    stage === "completed"
      ? 5
      : stage === "uploading"
        ? 1
        : progress >= 90
          ? 4
          : progress >= 60
            ? 3
            : 2;
  return (
    <ol className="analysis-steps">
      {steps.map((label, i) => {
        const done = i < completedCount;
        const active = i === completedCount && !failed;
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
            <small>
              {done
                ? "完成"
                : active
                  ? "處理中"
                  : failed && i === completedCount
                    ? "待重試"
                    : "待處理"}
            </small>
          </li>
        );
      })}
    </ol>
  );
}
