export type DamageType = "scratch" | "dent" | "paint_damage" | "contamination";
export type VehiclePart =
  | "front_bumper"
  | "rear_bumper"
  | "hood"
  | "trunk"
  | "left_front_door"
  | "left_rear_door"
  | "right_front_door"
  | "right_rear_door"
  | "fender"
  | "headlight"
  | "taillight"
  | "wheel";
export type ValidationState =
  "GOOD" | "TOO_CLOSE" | "TOO_FAR" | "BLURRY" | "TOO_FAST" | "TOO_DARK";
export type Scenario = "damage" | "clear" | "incomplete";
export interface DamageDetection {
  id: string;
  part: VehiclePart;
  type: DamageType;
  confidence: number;
  isPotentialNewDamage: boolean;
  beforeImage?: string;
  afterImage?: string;
  maskImage?: string;
}
export interface InspectionResult {
  inspectionId: string;
  vehicleId: string;
  coverage: number;
  scanDuration: number;
  processingTime: number;
  keyFrameCount: number;
  damages: DamageDetection[];
}
export interface InspectionStatus {
  status: "scanning" | "analyzing" | "potential_damage" | "complete";
  progress: number;
}
export interface KeyFrame {
  id: string;
  image: Blob;
  angle: number;
  timestamp: number;
}
export interface InspectionApi {
  startInspection(scenario?: Scenario): Promise<{ inspectionId: string }>;
  uploadKeyFrames(
    id: string,
    frames: KeyFrame[],
  ): Promise<{ accepted: number }>;
  getInspectionStatus(id: string): Promise<InspectionStatus>;
  getInspectionResult(id: string): Promise<InspectionResult>;
}
