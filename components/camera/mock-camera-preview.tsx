import { Camera } from "lucide-react";
import { VehicleIllustration } from "@/components/vehicle/vehicle-illustration";
import type { ScanState } from "@/types/inspection";
interface CameraPreviewProps {
  state: ScanState;
  label?: string;
  aimOnly?: boolean;
  showBoundingBox?: boolean;
}
export function MockCameraPreview({
  state,
  label = "模擬攝影機 · 不存取鏡頭",
  aimOnly = false,
  showBoundingBox = true,
}: CameraPreviewProps) {
  return (
    <div
      className={`camera-preview ${state === "blurry" ? "blurred" : ""} ${state === "too_dark" ? "dim" : ""}`}
    >
      <div className="camera-grid" />
      <span className="camera-label">
        <Camera size={14} />
        {label}
      </span>
      <VehicleIllustration dark />
      {showBoundingBox && <BoundingBox good={!aimOnly && state === "good"} />}
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
