import type { DamageType } from "./inspection";
export interface ExperimentResult {
  id: string;
  distanceMeters: number;
  angleDegrees: number;
  lighting: "daylight" | "indoor" | "low_light";
  damageType: DamageType;
  damageSize?: string;
  /** 0–1, consistent with the inspection API. */
  confidence: number;
  detected: boolean;
  processingTimeSeconds: number;
}
