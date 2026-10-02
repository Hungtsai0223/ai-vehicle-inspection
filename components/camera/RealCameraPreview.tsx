import type { CameraPreviewProps } from "./CameraPreview";
/** Disabled placeholder. TODO: use navigator.mediaDevices.getUserMedia({
 * video: { facingMode: { ideal: "environment" } }, audio: false
 * }). Handle HTTPS, denied permissions, video readiness, timestamped JPEG capture,
 * preview URL revocation, and stop every media track on unmount.
 * Connect only after real camera capture has been explicitly implemented and tested.
 */
export function RealCameraPreview(_props: CameraPreviewProps) {
  void _props;
  return (
    <div className="camera-preview" role="status">
      真實攝影機尚未啟用
    </div>
  );
}
