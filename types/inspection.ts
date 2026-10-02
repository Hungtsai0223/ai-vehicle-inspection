export type InspectionStatus =
  "idle" | "scanning" | "uploading" | "processing" | "completed" | "failed";
export type DetectionStatus = "no_damage" | "potential_damage";
export type DamageType =
  "scratch" | "dent" | "paint_damage" | "contamination" | "unknown";
export type VehiclePart =
  | "front_bumper"
  | "rear_bumper"
  | "hood"
  | "trunk"
  | "left_front_door"
  | "left_rear_door"
  | "right_front_door"
  | "right_rear_door"
  | "left_fender"
  | "right_fender"
  | "headlight"
  | "taillight"
  | "wheel"
  | "unknown";
export type ScanState =
  "good" | "too_close" | "too_far" | "blurry" | "too_fast" | "too_dark";
export type Scenario = "potential_damage" | "no_damage" | "incomplete";
export interface Vehicle {
  id: string;
  model: string;
  plate: string;
}
export interface DamageDetection {
  id: string;
  part: VehiclePart;
  damageType: DamageType;
  /** Unrecognized backend values retained only for developer diagnostics. */
  rawPart?: string;
  rawDamageType?: string;
  confidence: number;
  isPotentialNewDamage: boolean;
  /** Normalized image coordinates, each in 0–1. */
  boundingBox?: { x: number; y: number; width: number; height: number };
  beforeImageUrl?: string;
  afterImageUrl?: string;
  maskImageUrl?: string;
}
export interface InspectionResult {
  inspectionId: string;
  vehicle: Vehicle;
  status: InspectionStatus;
  detectionStatus: DetectionStatus;
  coverage: number;
  scanDurationSeconds: number;
  processingTimeSeconds: number;
  keyFrameCount: number;
  /** Unknown coverage is separate from detection in inspected areas. */
  missingAreas?: VehiclePart[];
  damages: DamageDetection[];
  createdAt: string;
}
export type ProcessingStage =
  | "image_validation"
  | "vehicle_part_detection"
  | "damage_detection"
  | "before_after_comparison"
  | "completed";
export interface InspectionProgress {
  inspectionId: string;
  status: InspectionStatus;
  /** Percentage, 0–100. */
  progress: number;
  stage?: ProcessingStage;
}
