"use client";
import { Car, Check } from "lucide-react";
import { SCAN_SECTORS } from "@/lib/scan-coverage";
import type {
  ScanSector,
  VehicleScanCoverage,
  SectorStatus,
} from "@/types/scan";
const statusLabels: Record<SectorStatus, string> = {
  pending: "待拍攝",
  current: "目前角度",
  captured: "已完成",
  needs_retry: "需要重試",
  unavailable: "無法拍攝，Unknown",
};
function point(degrees: number, radius: number) {
  const a = ((degrees - 90) * Math.PI) / 180;
  return { x: 140 + radius * Math.cos(a), y: 140 + radius * Math.sin(a) };
}
export function VehicleCoverageRing({
  coverage,
  onSelect,
  disabled = false,
}: {
  coverage: VehicleScanCoverage;
  onSelect: (sector: ScanSector) => void;
  disabled?: boolean;
}) {
  return (
    <div className="vehicle-coverage" aria-label="掃描角度覆蓋">
      <div className="coverage-ring">
        <svg viewBox="0 0 280 280" aria-hidden="true">
          {coverage.sectors.map((sector, i) => {
            // Counterclockwise guided walk: front → vehicle left → rear → right.
            const center = -i * 30;
            const from = point(center - 11, 108);
            const to = point(center + 11, 108);
            return (
              <path
                key={sector.id}
                className={`sector-arc sector-${sector.status}`}
                d={`M ${from.x} ${from.y} A 108 108 0 0 1 ${to.x} ${to.y}`}
              />
            );
          })}
        </svg>
        <div className="ring-center">
          <Car size={44} strokeWidth={1.5} />
          <strong>
            {coverage.capturedSectorCount}
            <small> / 12</small>
          </strong>
          <span>掃描角度覆蓋</span>
          <small>{Math.round(coverage.completionRatio * 100)}%</small>
        </div>
        {coverage.sectors.map((sector, i) => {
          const pos = point(-i * 30, 108);
          return (
            <button
              type="button"
              className={`sector-hit sector-${sector.status}`}
              key={sector.id}
              style={{ left: `${pos.x / 2.8}%`, top: `${pos.y / 2.8}%` }}
              disabled={disabled || sector.status === "captured"}
              onClick={() => onSelect(sector.id)}
              aria-pressed={sector.id === coverage.currentSector}
              aria-label={`${SCAN_SECTORS[i].label}：${statusLabels[sector.status]}`}
              title={`${SCAN_SECTORS[i].label}：${statusLabels[sector.status]}`}
            >
              {sector.status === "captured" ? (
                <Check size={14} />
              ) : sector.status === "unavailable" ? (
                "?"
              ) : (
                <span className="sr-only">{SCAN_SECTORS[i].label}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="coverage-count" role="status">
        已完成 {coverage.capturedSectorCount} / 12 個角度
      </p>
      <div className="ring-legend">
        <span>
          <i className="legend-done" />
          已完成
        </span>
        <span>
          <i className="legend-current" />
          目前角度
        </span>
        <span>
          <i className="legend-retry" />
          需調整
        </span>
        <span>
          <i className="legend-unknown" />
          Unknown
        </span>
      </div>
    </div>
  );
}
