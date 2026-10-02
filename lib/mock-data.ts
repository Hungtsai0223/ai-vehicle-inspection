import type { InspectionResult, Scenario } from "@/types/inspection";
// MOCK / DEMO DATA — not measured experiment results.
export const mockResult: InspectionResult = {
  inspectionId: "demo_2026",
  vehicleId: "RAC-2026",
  coverage: 0.96,
  scanDuration: 27.4,
  processingTime: 2.84,
  keyFrameCount: 16,
  damages: [
    {
      id: "damage_001",
      part: "left_front_door",
      type: "scratch",
      confidence: 0.91,
      isPotentialNewDamage: true,
      beforeImage: "/mock/before.svg",
      afterImage: "/mock/after.svg",
      maskImage: "/mock/mask.svg",
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
    damages: scenario === "clear" ? [] : mockResult.damages,
  };
}
export const metrics = [
  ["Recognition Accuracy", "94.2%"],
  ["Average AI Detection Time", "2.8 sec"],
  ["Complete Inspection Time", "28.6 sec"],
  ["Scan Coverage", "96%"],
  ["Potential Damage Detected", "1"],
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
