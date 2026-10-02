import type { Ref } from "react";
import type { DamageDetection } from "@/types/inspection";
import { partLabels, damageLabels } from "@/lib/inspection-labels";
import { ImageComparison } from "./image-comparison";
export function DamageCard({
  damage,
  selected = false,
  isDemo = true,
  ref,
}: {
  damage: DamageDetection;
  selected?: boolean;
  isDemo?: boolean;
  ref?: Ref<HTMLElement>;
}) {
  const part = partLabels[damage.part];
  const type = damageLabels[damage.damageType];
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label={`${part.zh}疑似異常詳情`}
      className={`card damage-card ${selected ? "selected-damage" : ""}`}
    >
      <div className="row">
        <h3>
          {damage.isPotentialNewDamage
            ? "Potential New Damage"
            : "Potential Damage"}
        </h3>
        <span className="alert-label">待人工確認</span>
      </div>
      <p>
        {damage.isPotentialNewDamage
          ? "疑似新增車損"
          : "疑似車損，新增狀態待確認"}
      </p>
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
        beforeImage={damage.beforeImageUrl}
        afterImage={damage.afterImageUrl}
        maskImage={damage.maskImageUrl}
        location={part.zh}
        boundingBox={damage.boundingBox}
        boxLabel={`${type.en} · ${Math.round(damage.confidence * 100)}%`}
        isDemo={isDemo}
      />
    </section>
  );
}
