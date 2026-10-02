import { Clock, Camera, ScanLine } from "lucide-react";
import { Action } from "@/components/ui/primitives";
import {
  VehicleIllustration,
  VehicleCard,
} from "@/components/vehicle/vehicle-illustration";
export default function Return() {
  return (
    <div className="page return-page">
      <p className="page-step">還車流程 / 01</p>
      <h1>
        <span className="red">AI</span> 智慧車況檢查
      </h1>
      <p className="english">AI Vehicle Inspection</p>
      <p className="lead">繞車一圈，約 30 秒完成車況確認</p>
      <div className="vehicle-hero">
        <VehicleIllustration />
      </div>
      <VehicleCard />
      <div className="benefits">
        {[
          [Clock, "約 30 秒"],
          [Camera, "免逐張拍照"],
          [ScanLine, "AI 自動辨識"],
        ].map(([Icon, label]) => {
          const I = Icon as typeof Clock;
          return (
            <div key={label as string}>
              <span>
                <I size={24} />
              </span>
              <strong>{label as string}</strong>
            </div>
          );
        })}
      </div>
      <Action href="/scan-guide">開始車況掃描</Action>
      <p className="disclaimer">AI 僅協助辨識疑似異常，不直接判定車損責任。</p>
    </div>
  );
}
