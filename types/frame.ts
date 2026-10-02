export type VehicleView = "front" | "left" | "rear" | "right" | "unknown";
export interface CapturedFrame {
  id: string;
  /** Milliseconds since scan start; converted to seconds on upload. */
  timestamp: number;
  /** Real JPEG/PNG bytes. Mock frames deliberately omit this field. */
  blob?: Blob;
  previewUrl?: string;
  vehicleView: VehicleView;
  quality: {
    blurScore?: number;
    exposureScore?: number;
    vehicleCoverage?: number;
  };
}
