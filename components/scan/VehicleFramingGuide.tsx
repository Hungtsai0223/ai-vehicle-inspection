import { framingMessages } from "@/lib/vehicle-framing";
import type { FramingState } from "@/types/scan";
export function VehicleFramingGuide({
  state,
  simulated = false,
}: {
  state: FramingState;
  simulated?: boolean;
}) {
  return (
    <div className={`vehicle-framing-guide framing-${state.toLowerCase()}`}>
      <div className="framing-target" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="framing-caption" role="status">
        <span>將完整車身保持在框線內</span>
        <small>
          {framingMessages[state]}
          {simulated
            ? " · Demo"
            : state === "UNKNOWN"
              ? " · 尚未接入辨識模型"
              : ""}
        </small>
      </div>
    </div>
  );
}
