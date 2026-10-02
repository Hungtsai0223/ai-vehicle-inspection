"use client";
import { useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { CheckCircle, Check } from "lucide-react";
import { useInspection } from "@/components/inspection/inspection-context";
import { VehicleCard } from "@/components/vehicle/vehicle-illustration";
import { VehicleDamageMap } from "@/components/vehicle/vehicle-damage-map";
import { InspectionSummary } from "@/components/inspection/inspection-summary";
import { DamageCard } from "@/components/inspection/damage-card";
import {
  Action,
  Button,
  Card,
  Disclaimer,
  DemoLabel,
} from "@/components/ui/primitives";
export default function Result() {
  const { result, recaptured } = useInspection();
  const [finished, setFinished] = useState(false);
  const [selected, setSelected] = useState<string>();
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const reduced = useReducedMotion();
  if (!result)
    return (
      <div className="page">
        <h1>尚無檢測資料</h1>
        <p className="lead">完成掃描後即可查看完整檢查結果。</p>
        <Action href="/return">開始使用者 Demo</Action>
      </div>
    );
  function selectDamage(id: string) {
    setSelected(id);
    refs.current[id]?.focus({ preventScroll: true });
    refs.current[id]?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
  }
  return (
    <div className="page result-page">
      <div className="success-banner" role="status">
        <CheckCircle size={34} />
        <div>
          <h1>{finished ? "還車流程完成" : "車況檢查完成"}</h1>
          <p>
            {finished
              ? "感謝使用，這次模擬行程已結束。"
              : "AI 車況辨識結果已完成"}
          </p>
        </div>
      </div>
      <DemoLabel />
      <VehicleCard />
      <VehicleDamageMap
        vehicleParts={result.damages.map((d) => d.part)}
        damageLocations={result.damages}
        selectedDamage={selected}
        onSelectDamage={selectDamage}
      />
      <Card>
        <h2>檢查摘要</h2>
        <InspectionSummary result={result} />
      </Card>
      {result.coverage < 0.9 && (
        <p className="notice">
          右側車身未完整掃描 · Unknown。已記錄覆蓋不足，仍可完成還車。
        </p>
      )}
      {result.damages.map((d) => (
        <DamageCard
          key={d.id}
          damage={d}
          selected={selected === d.id}
          ref={(el) => {
            refs.current[d.id] = el;
          }}
        />
      ))}
      {!result.damages.length && (
        <Card className="clear-result">
          <CheckCircle size={24} />
          <strong>本次未發現疑似異常</strong>
        </Card>
      )}
      {recaptured && (
        <p className="success-text">
          <Check size={16} />
          補拍影像已確認（模擬）
        </p>
      )}
      <Disclaimer />
      <Button onClick={() => setFinished(true)} disabled={finished}>
        <Check size={20} />
        {finished ? "已完成模擬還車" : "完成還車"}
      </Button>
      <Action href="/dashboard" secondary>
        查看完整檢測報告
      </Action>
      {finished && (
        <Action href="/" secondary>
          返回 Demo 首頁
        </Action>
      )}
    </div>
  );
}
