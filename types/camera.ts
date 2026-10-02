export type CameraMode = "demo" | "real";
export type CameraPermissionState =
  | "idle"
  | "loading"
  | "permission_granted"
  | "permission_denied"
  | "camera_unavailable"
  | "insecure_context"
  | "paused";
