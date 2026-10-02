"use client";
import { useState } from "react";
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
  const [report, setReport] = useState(false);
  if (!result)
    return (
      <div className="page">
        <h1>尚無檢測資料</h1>
        <p className="lead">完成掃描後即可查看完整檢查結果。</p>
        <Action href="/return">開始使用者 Demo</Action>
      </div>
    );
  return (
    <div className="page result-page">
      <div className="success-banner">
        <CheckCircle size={34} />
        <div>
          <h1>{finished ? "Demo 還車已完成" : "車況檢查完成"}</h1>
          <p>
            {finished
              ? "感謝使用，這次模擬行程已結束。"
              : "AI 已完成車輛外觀篩選"}
          </p>
        </div>
      </div>
      <DemoLabel />
      <VehicleCard />
      <VehicleDamageMap
        vehicleParts={["left_front_door"]}
        damageLocations={result.damages}
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
        <DamageCard key={d.id} damage={d} />
      ))}
      {!result.damages.length && (
        <Card className="clear-result">
          <CheckCircle size={24} />
          <strong>本次未發現疑似異常</strong>
        </Card>
      )}
      {recaptured && (
        <p className="success-text">
          <Check size={16} /> 補拍影像已確認（模擬）
        </p>
      )}
      <Disclaimer />
      <Button onClick={() => setFinished(true)} disabled={finished}>
        <Check size={20} />
        {finished ? "已完成模擬還車" : "完成還車"}
      </Button>
      <Button
        className="secondary"
        onClick={() => setReport(!report)}
        aria-expanded={report}
      >
        查看完整檢測報告
      </Button>
      {report && (
        <Card>
          <h3>完整檢測報告 · Mock</h3>
          <p>
            Inspection ID：{result.inspectionId}
            <br />
            處理時間：{result.processingTime} 秒<br />
            資料來源：Mock API
            <br />
            狀態：
            {result.coverage < 0.9
              ? "覆蓋不足，待人工確認"
              : result.damages.length
                ? "疑似異常，待人工確認"
                : "未發現疑似異常"}
          </p>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </Card>
      )}
      {finished && (
        <Action href="/" secondary>
          返回 Demo 首頁
        </Action>
      )}
    </div>
  );
}
