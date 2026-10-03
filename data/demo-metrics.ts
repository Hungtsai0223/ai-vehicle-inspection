import type { ExperimentResult } from "../types/experiment";
// MOCK / DEMO DATA only. No real measurements or scientific conclusions.
export const demoMetrics = [
  ["Recognition Accuracy", "94.2%"],
  ["Average AI Detection Time", "2.8 sec"],
  ["Complete Inspection Time", "28.6 sec"],
  ["Scan Coverage", "96%"],
  ["Potential Damage", "1"],
] as const;
export const demoAccuracy = [
  ["Scratch", 96],
  ["Dent", 91],
  ["Paint Damage", 93],
  ["Contamination", 89],
] as const;
export const demoEfficiency = { traditionalSeconds: 78, guidedSeconds: 28.6 };
export const demoExperimentResults: ExperimentResult[] = [
  {
    id: "#01",
    distanceMeters: 1,
    angleDegrees: 0,
    lighting: "daylight",
    damageType: "scratch",
    confidence: 0.96,
    detected: true,
    processingTimeSeconds: 2.8,
  },
  {
    id: "#02",
    distanceMeters: 2,
    angleDegrees: 30,
    lighting: "daylight",
    damageType: "dent",
    confidence: 0.91,
    detected: true,
    processingTimeSeconds: 2.8,
  },
  {
    id: "#03",
    distanceMeters: 1.5,
    angleDegrees: 45,
    lighting: "low_light",
    damageType: "scratch",
    confidence: 0.85,
    detected: true,
    processingTimeSeconds: 2.8,
  },
  {
    id: "#04",
    distanceMeters: 3,
    angleDegrees: 60,
    lighting: "low_light",
    damageType: "scratch",
    confidence: 0.54,
    detected: false,
    processingTimeSeconds: 2.8,
  },
];
