import type { ScanFrameLabel } from "./scan";
export type VehicleView = "front" | "left" | "rear" | "right" | "unknown";
export interface CapturedFrame {
  id: string;
  /** Milliseconds since scan start; sent unchanged in metadata. */
  timestamp: number;
  /** Real JPEG/PNG bytes. Mock frames deliberately omit this field. */
  blob?: Blob;
  previewUrl?: string;
  vehicleView: VehicleView;
  /** Frontend guidance metadata, never sent in the existing HTTP contract. */
  scan?: ScanFrameLabel;
  /** Tiny-frame pixel-change proxy, not physical speed or AI blur detection. */
  motionScore?: number;
  quality: {
    blurScore?: number;
    exposureScore?: number;
    vehicleCoverage?: number;
  };
}
