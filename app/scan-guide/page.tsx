import { Smartphone, MoveHorizontal, ArrowRight, ScanLine } from "lucide-react";
import { Action, Card } from "@/components/ui/primitives";
import { VehicleIllustration } from "@/components/vehicle/vehicle-illustration";
const instructions = [
  {
    Icon: Smartphone,
    title: "手機保持直立",
    description: "保持手機穩定，鏡頭朝向車輛",
  },
  {
    Icon: MoveHorizontal,
    title: "保持適當距離",
    description: "建議距離車輛約 1–2 公尺",
  },
  {
    Icon: ArrowRight,
    title: "依箭頭慢慢移動",
    description: "沿車輛外圍緩慢走一圈",
  },
];
export default function Guide() {
  return (
    <div className="page guide-page">
      <p className="english guide-header">AI 智慧車況檢查</p>
      <h1>
        請沿車輛
        <br />
        慢慢走一圈
      </h1>
      <p className="lead">系統會自動擷取清晰影像，不需要手動按快門</p>
      <div className="guide-vehicle">
        <VehicleIllustration />
        <div className="orbit">
          <ArrowRight size={20} />
          360° Guided Scan
        </div>
      </div>
      <ol className="instruction-cards">
        {instructions.map(({ Icon, title, description }, i) => (
          <li key={title}>
            <span className="instruction-number">{i + 1}</span>
            <Icon size={21} />
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
          </li>
        ))}
      </ol>
      <Card className="hint">
        <ScanLine size={24} />
        <p>
          AI 會自動挑選最佳影格，
          <br />
          <strong>不需要一直按快門</strong>
        </p>
      </Card>
      <Action href="/scan">開始掃描</Action>
      <Action href="/return" secondary>
        返回
      </Action>
    </div>
  );
}
