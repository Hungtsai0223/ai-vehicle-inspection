import type { CameraMode, CameraPermissionState } from "../types/camera";
export const cameraMessages: Record<CameraPermissionState, string> = {
  idle: "按下開始真實掃描後，才會請求相機權限。",
  loading: "正在開啟相機，請依瀏覽器提示允許存取。",
  permission_granted: "相機已就緒",
  permission_denied: "無法存取相機。請開啟相機權限，或改用 Demo 模式。",
  camera_unavailable: "目前裝置沒有可使用的相機，或相機正被其他程式使用。",
  insecure_context: "瀏覽器僅允許在 HTTPS 或 localhost 使用相機功能。",
  paused: "相機已停止，請重新開啟相機。",
};
export class CameraAccessError extends Error {
  constructor(public readonly state: CameraPermissionState) {
    super(cameraMessages[state]);
    this.name = "CameraAccessError";
  }
}
export function cameraErrorState(error: unknown): CameraPermissionState {
  if (error instanceof CameraAccessError) return error.state;
  const name =
    error && typeof error === "object" && "name" in error ? error.name : "";
  return name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError"
    ? "permission_denied"
    : "camera_unavailable";
}
export const environmentCameraConstraints: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
};
export function getPreferredCameraMode(): CameraMode {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return "demo";
  const mobile =
    navigator.maxTouchPoints > 0 &&
    window.matchMedia("(pointer: coarse)").matches;
  return mobile &&
    window.isSecureContext &&
    Boolean(navigator.mediaDevices?.getUserMedia)
    ? "real"
    : "demo";
}
export async function requestEnvironmentCamera(): Promise<MediaStream> {
  if (typeof window === "undefined" || !window.isSecureContext)
    throw new CameraAccessError("insecure_context");
  if (!navigator.mediaDevices?.getUserMedia)
    throw new CameraAccessError("camera_unavailable");
  return navigator.mediaDevices.getUserMedia(environmentCameraConstraints);
}
export function stopCameraStream(stream?: MediaStream) {
  stream?.getTracks().forEach((track) => track.stop());
}
/** Owns the stream and shares a pending permission request across Strict Mode effects.
 * close() also disposes streams that arrive after the component has gone away.
 */
export class CameraSession {
  private wanted = false;
  private stream?: MediaStream;
  private pending?: Promise<MediaStream>;
  constructor(private readonly request = requestEnvironmentCamera) {}
  open(): Promise<MediaStream> {
    this.wanted = true;
    if (this.stream) return Promise.resolve(this.stream);
    if (!this.pending) {
      this.pending = this.request()
        .then((stream) => {
          if (!this.wanted) {
            stopCameraStream(stream);
            throw new CameraAccessError("paused");
          }
          this.stream = stream;
          return stream;
        })
        .finally(() => {
          this.pending = undefined;
        });
    }
    return this.pending;
  }
  close() {
    this.wanted = false;
    stopCameraStream(this.stream);
    this.stream = undefined;
  }
}
