"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, Check } from "lucide-react";
import { useInspection } from "@/components/inspection/inspection-context";
import { VehicleDamageMap } from "@/components/vehicle/vehicle-damage-map";
import {
  Action,
  Button,
  Card,
  Disclaimer,
  DemoLabel,
} from "@/components/ui/primitives";
export default function Damage() {
  const ctx = useInspection();
  const router = useRouter();
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState(false);
  if (!ctx.result)
    return (
      <div className="page">
        <h1>尚無檢測資料</h1>
        <Action href="/scan">開始掃描</Action>
      </div>
    );
  const damage = ctx.result.damages[0];
  if (!damage)
    return (
      <div className="page">
        <h1>未發現疑似異常</h1>
        <Action href="/result">查看檢查結果</Action>
      </div>
    );
  return (
    <div className="page damage-page">
      <div className="warning-icon">
        <AlertCircle size={30} />
      </div>
      <h1>發現疑似異常</h1>
      <p className="lead">AI 偵測到左前車門可能存在新增刮痕。</p>
      <DemoLabel />
      <VehicleDamageMap
        vehicleParts={["left_front_door"]}
        damageLocations={[damage]}
        selectedDamage={damage.id}
      />
      <Card>
        <div className="row">
          <strong>左前車門</strong>
          <b className="red">{Math.round(damage.confidence * 100)}%</b>
        </div>
        <p>
          Left Front Door <span>AI 信心度</span>
        </p>
        <hr />
        <strong>
          疑似刮痕 <small>Scratch</small>
        </strong>
      </Card>
      <p className="recapture-instruction">
        請靠近左前車門，依照畫面標示進行補拍。
      </p>
      {!capturing ? (
        <Button onClick={() => setCapturing(true)}>
          <Camera size={20} />
          前往補拍
        </Button>
      ) : (
        <Card className="recapture">
          <h3>{captured ? "補拍完成" : "補拍左前車門"}</h3>
          <div className="capture-target">
            <VehicleDamageMap
              vehicleParts={["left_front_door"]}
              damageLocations={[damage]}
            />
          </div>
          <p>
            {captured
              ? "模擬影像已加入檢查報告。"
              : "將標示區域置於畫面中央。此為模擬拍攝。"}
          </p>
          {!captured ? (
            <Button
              onClick={() => {
                setCaptured(true);
                ctx.setRecaptured(true);
              }}
            >
              <Camera size={18} />
              模擬拍攝
            </Button>
          ) : (
            <Button
              onClick={() => {
                ctx.setStatus("complete");
                router.push("/result");
              }}
            >
              <Check size={18} />
              確認補拍並查看結果
            </Button>
          )}
        </Card>
      )}
      <details className="info-details">
        <summary>查看辨識資訊</summary>
        <p>
          部位：{damage.part}
          <br />
          類型：{damage.type}
          <br />
          信心度：{damage.confidence}
          <br />
          模型：Mock API（未連接 AI 模型）
          <br />
          結果須由人工確認。
        </p>
      </details>
      <Disclaimer />
    </div>
  );
}
