import type { InspectionResult, Scenario } from "../types/inspection";
// MOCK / DEMO DATA — not measured experiment results.
export const mockVehicle = {
  id: "vehicle_001",
  model: "Toyota Yaris Cross",
  plate: "RAC-2026",
};
export const mockConfig = {
  defaultScenario: "potential_damage" as Scenario,
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
  return {
    ...mockResult,
    inspectionId: id,
    coverage: scenario === "incomplete" ? 0.75 : 0.96,
    detectionStatus:
      scenario === "no_damage" ? "no_damage" : "potential_damage",
    missingAreas: scenario === "incomplete" ? ["right_rear_door"] : [],
    damages: scenario === "no_damage" ? [] : mockResult.damages,
  };
}
export const metrics = [
  ["Recognition Accuracy", "94.2%"],
  ["Average AI Detection Time", "2.8 sec"],
  ["Complete Inspection Time", "28.6 sec"],
  ["Scan Coverage", "96%"],
  ["Potential Damage", "1"],
];
export const accuracy = [
  ["Scratch", 96],
  ["Dent", 91],
  ["Paint Damage", 93],
  ["Contamination", 89],
] as const;
export const experiments = [
  {
    id: "#01",
    distance: "1.0 m",
    angle: "0°",
    lighting: "Daylight",
    damage: "Scratch",
    confidence: 96,
    result: "Detected",
  },
  {
    id: "#02",
    distance: "2.0 m",
    angle: "30°",
    lighting: "Daylight",
    damage: "Dent",
    confidence: 91,
    result: "Detected",
  },
  {
    id: "#03",
    distance: "1.5 m",
    angle: "45°",
    lighting: "Low Light",
    damage: "Scratch",
    confidence: 85,
    result: "Detected",
  },
  {
    id: "#04",
    distance: "3.0 m",
    angle: "60°",
    lighting: "Low Light",
    damage: "Scratch",
    confidence: 54,
    result: "Missed",
  },
];
