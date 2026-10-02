"use client";
import type { ScanState, Scenario } from "@/types/inspection";
import { DemoLabel } from "@/components/ui/primitives";
const controls = [
  ["Normal", "good"],
  ["Too Close", "too_close"],
  ["Too Far", "too_far"],
  ["Blur", "blurry"],
  ["Too Fast", "too_fast"],
  ["Dark", "too_dark"],
] as const;
export function DemoControls({
  state,
  onStateChange,
  scenario,
  onScenarioChange,
  poorNetwork,
  onNetworkChange,
  disabled,
}: {
  state: ScanState;
  onStateChange: (value: ScanState) => void;
  scenario: Scenario;
  onScenarioChange: (value: Scenario) => void;
  poorNetwork: boolean;
  onNetworkChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <details className="demo-controls">
      <summary>Demo Controls</summary>
      <DemoLabel />
      <div className="control-grid">
        {controls.map(([label, value]) => (
          <button
            type="button"
            aria-pressed={state === value}
            onClick={() => onStateChange(value)}
            key={value}
          >
            {label}
          </button>
        ))}
      </div>
      <label>
        辨識結果
        <select
          aria-label="辨識結果"
          value={scenario}
          disabled={disabled}
          onChange={(e) => onScenarioChange(e.target.value as Scenario)}
        >
          <option value="potential_damage">Potential Damage</option>
          <option value="no_damage">No Damage · 無異常</option>
          <option value="incomplete">覆蓋不足 · Unknown</option>
        </select>
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={poorNetwork}
          onChange={(e) => onNetworkChange(e.target.checked)}
        />
        Poor Network · 網路不佳
      </label>
    </details>
  );
}
