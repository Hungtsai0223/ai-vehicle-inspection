export type ScanSector =
  | "front"
  | "front_left"
  | "left_front"
  | "left"
  | "left_rear"
  | "rear_left"
  | "rear"
  | "rear_right"
  | "right_rear"
  | "right"
  | "right_front"
  | "front_right";
export type SectorStatus =
  "pending" | "current" | "captured" | "needs_retry" | "unavailable";
export interface ScanSectorState {
  id: ScanSector;
  status: SectorStatus;
  validFrameCount: number;
  bestFrameId?: string;
}
export interface VehicleScanCoverage {
  sectors: ScanSectorState[];
  capturedSectorCount: number;
  totalSectorCount: number;
  completionRatio: number;
  validFrameCount: number;
  currentSector?: ScanSector;
  armed: boolean;
  requestId: number;
  acceptedFrameIds: string[];
}
export type FramingState =
  "GOOD" | "TOO_CLOSE" | "TOO_FAR" | "PARTIAL" | "UNKNOWN";
export interface VehicleFramingResult {
  detected: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number };
  coverageRatio?: number;
  confidence?: number;
}
export interface ScanFrameLabel {
  sector: ScanSector;
  requestId: number;
  source: "demo" | "guided-prototype" | "ai";
}
export interface CaptureMetadata {
  timestamp: number;
  prototypeProgress: number;
  scan?: ScanFrameLabel;
}
