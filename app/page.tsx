import { ScanLine, ArrowDown } from "lucide-react";
import { Action, DemoLabel } from "@/components/ui/primitives";
import { VehicleIllustration } from "@/components/vehicle/vehicle-illustration";
export default function Home() {
  return (
    <div className="page landing">
      <div className="hero-icon">
        <ScanLine size={30} />
      </div>
      <h1>
        AI Vehicle
        <br />
        Inspection<span>共享汽車智慧車況檢測系統</span>
      </h1>
      <p className="lead">繞車一圈，讓還車更簡單。</p>
      <VehicleIllustration />
      <Action href="/return">開始使用者 Demo</Action>
      <Action href="/dashboard" secondary>
        查看 AI Dashboard
      </Action>
      <div className="flow">
        {[
          "還車",
          "AI Guided Scan",
          "AI Analysis",
          "Potential Damage Check",
          "Inspection Result",
        ].map((s, i) => (
          <div key={s}>
            {i > 0 && <ArrowDown size={14} />}
            <span>{s}</span>
          </div>
        ))}
      </div>
      <DemoLabel />
    </div>
  );
}
