import type { InspectionResult, Scenario } from "../types/inspection";
import { getDemoScenario } from "./demo-config";
import { InspectionApiError } from "../services/inspection-errors";
// MOCK / DEMO DATA — not measured experiment results.
export const mockVehicle = {
  id: "vehicle_001",
  model: "Toyota Yaris Cross",
  plate: "RAC-2026",
};
export const mockConfig = {
  defaultScenario: getDemoScenario() as Scenario,
  scanDurationMs: 8_000,
  scanCompleteDelayMs: 800,
  analysisDurationMs: 3_000,
  recaptureTargetMs: 600,
  recaptureCompleteMs: 1_000,
  analysisFrameCount: 18,
  vehiclePartCount: 12,
};
export const mockResult: InspectionResult = {
  inspectionId: "demo_2026",
  vehicle: mockVehicle,
  status: "completed",
  detectionStatus: "potential_damage",
  missingAreas: [],
  createdAt: "2026-10-02T00:00:00.000Z",
  coverage: 0.96,
  scanDurationSeconds: 27.4,
  processingTimeSeconds: 2.84,
  keyFrameCount: 16,
  damages: [
    {
      id: "damage_001",
      part: "left_front_door",
      damageType: "scratch",
      confidence: 0.91,
      isPotentialNewDamage: true,
      beforeImageUrl: "/mock/before.svg",
      afterImageUrl: "/mock/after.svg",
      maskImageUrl: "/mock/mask.svg",
    },
  ],
};
export function resultFor(
  scenario: Scenario,
  id = "demo_2026",
): InspectionResult {
  if (scenario === "backend_error")
    throw new InspectionApiError("PROCESSING_FAILED");
  const unknown = scenario === "incomplete" || scenario === "unknown_area";
  const multiple = scenario === "multiple_damage";
  return {
    ...mockResult,
    inspectionId: id,
    coverage: unknown ? 0.75 : multiple ? 0.94 : 0.96,
    scanDurationSeconds: multiple ? 26.8 : mockResult.scanDurationSeconds,
    processingTimeSeconds: multiple ? 2.7 : mockResult.processingTimeSeconds,
    detectionStatus:
      scenario === "no_damage" ? "no_damage" : "potential_damage",
    missingAreas: unknown ? ["right_rear_door"] : [],
    damages:
      scenario === "no_damage"
        ? []
        : [
            ...mockResult.damages.map((damage) => ({ ...damage })),
            ...(multiple
              ? [
                  {
                    id: "damage_002",
                    part: "rear_bumper" as const,
                    damageType: "dent" as const,
                    confidence: 0.84,
                    isPotentialNewDamage: true,
                    beforeImageUrl: "/mock/before.svg",
                    afterImageUrl: "/mock/after.svg",
                    maskImageUrl: "/mock/mask.svg",
                  },
                ]
              : []),
          ],
  };
}
