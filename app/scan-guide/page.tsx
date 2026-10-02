import { Smartphone, MoveHorizontal, ArrowRight, ScanLine } from "lucide-react";
import { Action, Card } from "@/components/ui/primitives";
import { VehicleIllustration } from "@/components/vehicle/vehicle-illustration";
export default function Guide() {
  return (
    <div className="page">
      <p className="page-step">還車流程 / 02</p>
      <h1>
        請沿車輛
        <br />
        慢慢走一圈
      </h1>
      <p className="lead">跟著畫面指引，輕鬆完成外觀掃描。</p>
      <div className="guide-vehicle">
        <VehicleIllustration />
        <div className="orbit">
          <ArrowRight size={20} /> 360° Guided Scan
        </div>
      </div>
      <ol className="guide-list">
        {[
          [Smartphone, "手機保持直立"],
          [MoveHorizontal, "與車輛保持約 1–2 公尺"],
          [ArrowRight, "依照畫面箭頭緩慢移動"],
        ].map(([Icon, text], i) => {
          const I = Icon as typeof Smartphone;
          return (
            <li key={text as string}>
              <span>{i + 1}</span>
              <I size={22} />
              <strong>{text as string}</strong>
            </li>
          );
        })}
      </ol>
      <Card className="hint">
        <ScanLine size={24} />
        <p>
          AI 會自動擷取影像，
          <br />
          <strong>不需要按快門</strong>
        </p>
      </Card>
      <Action href="/scan">開始掃描</Action>
    </div>
  );
}
