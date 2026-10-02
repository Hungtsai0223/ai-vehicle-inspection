"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera } from "lucide-react";
import { useInspection } from "@/components/inspection/inspection-context";
import { VehicleDamageMap } from "@/components/vehicle/vehicle-damage-map";
import { ImageComparison } from "@/components/inspection/image-comparison";
import { RecaptureDialog } from "@/components/inspection/recapture-dialog";
import {
  partLabels,
  damageLabels,
  confidenceLevel,
} from "@/lib/inspection-labels";
import {
  Action,
  Button,
  Card,
  Disclaimer,
  DemoLabel,
} from "@/components/ui/primitives";
import { useResultRecovery } from "@/components/inspection/use-result-recovery";
export default function Damage() {
  const {
    result,
    inspectionId,
    sessionReady,
    mode,
    usingDevStub,
    cameraMode,
    setRecaptured,
    setStatus,
  } = useInspection();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [capturing, setCapturing] = useState(false);
  const finishCapture = useCallback(() => {
    setRecaptured(true);
    setStatus("completed");
    router.replace("/result");
  }, [setRecaptured, setStatus, router]);
  const recovery = useResultRecovery();
  if (!result && (recovery.loading || recovery.error))
    return (
      <div className="page">
        <h1>正在恢復檢查結果</h1>
        <p role={recovery.error ? "alert" : "status"}>
          {recovery.error || "正在重新取得分析結果…"}
        </p>
        {recovery.error && (
          <Button onClick={recovery.retry}>重新取得結果</Button>
        )}
      </div>
    );
  if (!result)
    return (
      <div className="page">
        <h1>尚無檢測資料</h1>
        <Action href={sessionReady && inspectionId ? "/analyzing" : "/scan"}>
          {sessionReady && inspectionId ? "重新取得結果" : "開始掃描"}
        </Action>
      </div>
    );
  const damage =
    result.damages.find((item) => item.id === selectedId) ?? result.damages[0];
  if (!damage)
    return (
      <div className="page">
        <h1>未發現疑似異常</h1>
        <Action href="/result">查看檢查結果</Action>
      </div>
    );
  const part = partLabels[damage.part];
  const type = damageLabels[damage.damageType];
  return (
    <div className="page damage-page">
      <div className="warning-icon">
        <AlertCircle size={30} />
      </div>
      <h1>發現疑似異常</h1>
      <p className="lead">
        AI 偵測到{part.zh}存在{type.zh}，請協助確認
      </p>
      <div className="damage-badges">
        <span className="alert-label">
          {damage.isPotentialNewDamage
            ? "Potential New Damage"
            : "Potential Damage"}
        </span>
        {(mode === "MOCK" || usingDevStub) && <DemoLabel />}
      </div>
      {result.damages.length > 1 && (
        <div
          className="damage-detection-selector"
          role="group"
          aria-label="切換疑似異常"
        >
          {result.damages.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === damage.id}
              onClick={() => setSelectedId(item.id)}
            >
              {index + 1}. {partLabels[item.part].zh} ·{" "}
              {damageLabels[item.damageType].zh}
            </button>
          ))}
        </div>
      )}
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
            <dd className="red">
              {Math.round(damage.confidence * 100)}%
              <small>
                AI Confidence · {confidenceLevel(damage.confidence)}
              </small>
            </dd>
          </div>
        </dl>
      </Card>
      <ImageComparison
        beforeImage={damage.beforeImageUrl}
        afterImage={damage.afterImageUrl}
        maskImage={damage.maskImageUrl}
        boundingBox={damage.boundingBox}
        boxLabel={`${type.en} · ${Math.round(damage.confidence * 100)}%`}
        location={part.zh}
        isDemo={mode === "MOCK" || (usingDevStub && cameraMode === "demo")}
      />
      {result.damages.length > 1 && (
        <p className="notice">
          共 {result.damages.length} 處疑似異常，完整清單可在結果頁查看。
        </p>
      )}
      <Action href="/result" secondary>
        查看完整檢測結果
      </Action>
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
          來源：{mode === "MOCK" ? "Mock API（未連接 AI 模型）" : "AI 分析服務"}
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
