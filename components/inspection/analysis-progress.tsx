import { Check, LoaderCircle } from "lucide-react";
export function AnalysisProgress({ progress }: { progress: number }) {
  return (
    <ol className="analysis-steps">
      {[
        "影像品質確認",
        "車體區域辨識",
        "關鍵影格擷取",
        "車損辨識",
        "與租車前影像比對",
      ].map((text, i) => {
        const done = progress >= (i + 1) * 20;
        const active = !done && progress >= i * 20;
        return (
          <li key={text} className={done ? "complete" : active ? "active" : ""}>
            {done ? (
              <Check size={20} />
            ) : active ? (
              <LoaderCircle className="spin" size={20} />
            ) : (
              <span className="step-dot" />
            )}
            <span>{text}</span>
            {done && <small>完成</small>}
          </li>
        );
      })}
    </ol>
  );
}
