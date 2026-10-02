import type { Ref } from "react";
import type { DamageDetection } from "@/types/inspection";
import { partLabels, damageLabels } from "@/lib/inspection-labels";
import { ImageComparison } from "./image-comparison";
export function DamageCard({
  damage,
  selected = false,
  ref,
}: {
  damage: DamageDetection;
  selected?: boolean;
  ref?: Ref<HTMLElement>;
}) {
  const part = partLabels[damage.part];
  const type = damageLabels[damage.type];
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label={`${part.zh}疑似異常詳情`}
      className={`card damage-card ${selected ? "selected-damage" : ""}`}
    >
      <div className="row">
        <h3>Potential New Damage</h3>
        <span className="alert-label">待人工確認</span>
      </div>
      <p>疑似新增車損</p>
      <div className="damage-meta">
        <strong>
          {part.zh}
          <small>{part.en}</small>
        </strong>
        <span>
          {type.zh} · {type.en}
        </span>
        <b>
          {Math.round(damage.confidence * 100)}%<small> AI 信心度</small>
        </b>
      </div>
      <ImageComparison
        beforeImage={damage.beforeImage}
        afterImage={damage.afterImage}
        maskImage={damage.maskImage}
        location={part.zh}
      />
    </section>
  );
}
