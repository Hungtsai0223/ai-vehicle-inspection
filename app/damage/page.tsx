"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera } from "lucide-react";
import { useInspection } from "@/components/inspection/inspection-context";
import { VehicleDamageMap } from "@/components/vehicle/vehicle-damage-map";
import { RecaptureDialog } from "@/components/inspection/recapture-dialog";
import { partLabels, damageLabels } from "@/lib/inspection-labels";
import {
  Action,
  Button,
  Card,
  Disclaimer,
  DemoLabel,
} from "@/components/ui/primitives";
export default function Damage() {
  const { result, setRecaptured, setStatus } = useInspection();
  const router = useRouter();
  const [capturing, setCapturing] = useState(false);
  const finishCapture = useCallback(() => {
    setRecaptured(true);
    setStatus("complete");
    router.replace("/result");
  }, [setRecaptured, setStatus, router]);
  if (!result)
    return (
      <div className="page">
        <h1>尚無檢測資料</h1>
        <Action href="/scan">開始掃描</Action>
      </div>
    );
  const damage = result.damages[0];
  if (!damage)
    return (
      <div className="page">
        <h1>未發現疑似異常</h1>
        <Action href="/result">查看檢查結果</Action>
      </div>
    );
  const part = partLabels[damage.part];
  const type = damageLabels[damage.type];
  return (
    <div className="page damage-page">
      <div className="warning-icon">
        <AlertCircle size={30} />
      </div>
      <h1>發現疑似異常</h1>
      <p className="lead">AI 偵測到{part.zh}可能存在新增刮痕</p>
      <div className="damage-badges">
        <span className="alert-label">Potential New Damage</span>
        <DemoLabel />
      </div>
      <VehicleDamageMap
        vehicleParts={[damage.part]}
        damageLocations={[damage]}
        selectedDamage={damage.id}
      />
      <Card>
        <dl className="damage-details">
          <div>
            <dt>位置</dt>
            <dd>
              {part.zh}
              <small>{part.en}</small>
            </dd>
          </div>
          <div>
            <dt>類型</dt>
            <dd>
              {type.zh}
              <small>{type.en}</small>
            </dd>
          </div>
          <div>
            <dt>AI 信心度</dt>
            <dd className="red">{Math.round(damage.confidence * 100)}%</dd>
          </div>
        </dl>
      </Card>
      <p className="recapture-instruction">
        為提高辨識準確度，請靠近標示區域補拍一張清晰影像。
      </p>
      <Button onClick={() => setCapturing(true)}>
        <Camera size={20} />
        前往補拍
      </Button>
      <details className="info-details">
        <summary>查看辨識資訊</summary>
        <p>
          Part: {part.en}
          <br />
          Damage: {type.en}
          <br />
          Confidence: {damage.confidence}
          <br />
          模型：Mock API（未連接 AI 模型）
          <br />
          結果須由人工確認。
        </p>
      </details>
      <Disclaimer />
      {capturing && (
        <RecaptureDialog
          damage={damage}
          onComplete={finishCapture}
          onDismiss={() => setCapturing(false)}
        />
      )}
    </div>
  );
}
