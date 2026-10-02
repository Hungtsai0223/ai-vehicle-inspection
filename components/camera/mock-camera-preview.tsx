import { Camera } from "lucide-react";
import { VehicleIllustration } from "@/components/vehicle/vehicle-illustration";
import type { ScanState } from "@/types/inspection";
interface CameraPreviewProps {
  state: ScanState;
}
export function MockCameraPreview({ state }: CameraPreviewProps) {
  return (
    <div
      className={`camera-preview ${state === "blurry" ? "blurred" : ""} ${state === "too_dark" ? "dim" : ""}`}
    >
      <div className="camera-grid" />
      <span className="camera-label">
        <Camera size={14} />
        模擬攝影機 · 不存取鏡頭
      </span>
      <VehicleIllustration dark />
      <BoundingBox good={state === "good"} />
    </div>
  );
}
export function BoundingBox({ good }: { good: boolean }) {
  return (
    <div aria-hidden="true" className={`bounding-box ${good ? "valid" : ""}`}>
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}
