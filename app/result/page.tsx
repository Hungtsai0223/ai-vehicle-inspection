"use client";
import { useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { CheckCircle, Check } from "lucide-react";
import { useInspection } from "@/components/inspection/inspection-context";
import { VehicleCard } from "@/components/vehicle/vehicle-illustration";
import { VehicleDamageMap } from "@/components/vehicle/vehicle-damage-map";
import { InspectionSummary } from "@/components/inspection/inspection-summary";
import { partLabels } from "@/lib/inspection-labels";
import { DamageCard } from "@/components/inspection/damage-card";
import {
  Action,
  Button,
  Card,
  Disclaimer,
  DemoLabel,
} from "@/components/ui/primitives";
import { useResultRecovery } from "@/components/inspection/use-result-recovery";
import { DemoReset } from "@/components/inspection/demo-reset";
import { DemoRecovery } from "@/components/inspection/demo-recovery";
export default function Result() {
  const {
    result,
    inspectionId,
    sessionReady,
    recaptured,
    mode,
    usingDevStub,
    cameraMode,
    clearFrames,
    demoResultActive,
  } = useInspection();
  const [finished, setFinished] = useState(false);
  const finishing = useRef(false);
  const [selected, setSelected] = useState<string>();
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const reduced = useReducedMotion();
  const recovery = useResultRecovery();
  if (!result && (recovery.loading || recovery.error))
    return (
      <div className="page">
        <h1>正在恢復檢查結果</h1>
        <p role={recovery.error ? "alert" : "status"}>
          {recovery.error || "正在重新取得分析結果…"}
        </p>
        {recovery.error && (
          <>
            <Button onClick={recovery.retry}>重新取得結果</Button>
            <DemoRecovery />
          </>
        )}
      </div>
    );
  if (!result)
    return (
      <div className="page">
        <h1>尚無檢測資料</h1>
        <p className="lead">完成掃描後即可查看完整檢查結果。</p>
        <Action href={sessionReady && inspectionId ? "/analyzing" : "/return"}>
          {sessionReady && inspectionId ? "重新取得結果" : "開始使用者 Demo"}
        </Action>
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
              ? mode === "MOCK"
                ? "感謝使用，這次模擬行程已結束。"
                : "感謝使用，這次還車流程已結束。"
              : "AI 車況辨識結果已完成"}
          </p>
        </div>
      </div>
      {(mode === "MOCK" || usingDevStub || demoResultActive) && <DemoLabel />}
      {demoResultActive && (
        <p className="notice" role="status">
          Demo Mode · 展示結果，未分析本次拍攝影像。
        </p>
      )}
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
      {Boolean(result.missingAreas?.length) && (
        <p className="notice">
          部分區域未完整掃描 · Unknown
          <small>
            {result.missingAreas?.map((part) => partLabels[part].zh).join("、")}
            。這些區域尚無法判定車況，仍可完成還車並交由人工確認。
          </small>
        </p>
      )}
      {result.damages.map((d) => (
        <DamageCard
          key={d.id}
          damage={d}
          isDemo={
            demoResultActive ||
            mode === "MOCK" ||
            (usingDevStub && cameraMode === "demo")
          }
          selected={selected === d.id}
          ref={(el) => {
            refs.current[d.id] = el;
          }}
        />
      ))}
      {result.detectionStatus === "no_damage" && (
        <Card className="clear-result">
          <CheckCircle size={24} />
          <strong>未偵測到明顯新增車損</strong>
          {Boolean(result.missingAreas?.length) && (
            <small>此結論僅適用於已完整掃描的區域。</small>
          )}
        </Card>
      )}
      {result.detectionStatus === "potential_damage" && (
        <p className="notice">偵測到疑似新增車損，請交由人工確認。</p>
      )}
      {recaptured && (
        <p className="success-text">
          <Check size={16} />
          補拍影像已確認（模擬）
        </p>
      )}
      <Disclaimer />
      <Button
        onClick={() => {
          if (finishing.current) return;
          finishing.current = true;
          clearFrames();
          setFinished(true);
        }}
        disabled={finished}
      >
        <Check size={20} />
        {finished
          ? mode === "MOCK"
            ? "已完成模擬還車"
            : "已完成還車"
          : "完成還車"}
      </Button>
      <Action href="/dashboard" secondary>
        查看完整檢測報告
      </Action>
      <DemoReset />
      {finished && (
        <Action href="/" secondary>
          返回 Demo 首頁
        </Action>
      )}
    </div>
  );
}
