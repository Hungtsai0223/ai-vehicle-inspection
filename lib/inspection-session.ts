import type { CameraMode } from "../types/camera";
import type { InspectionStatus, Scenario, Vehicle } from "../types/inspection";
export const sessionStorageKey = "vehicle-inspection-session-v1";
export interface SavedInspectionSession {
  version: 1;
  mode: "MOCK" | "API";
  inspectionId: string;
  vehicle: Vehicle;
  createdAt: string;
  scanDuration: number;
  capturedFrameCount: number;
  keyFrameCount: number;
  cameraMode: CameraMode;
  status: InspectionStatus;
  uploadComplete: boolean;
  scenario: Scenario;
}
export function readInspectionSession(
  mode: SavedInspectionSession["mode"],
): SavedInspectionSession | null {
  if (typeof window === "undefined") return null;
  try {
    const s = JSON.parse(
      window.sessionStorage.getItem(sessionStorageKey) ?? "null",
    );
    if (
      !s ||
      s.version !== 1 ||
      s.mode !== mode ||
      typeof s.inspectionId !== "string" ||
      !s.inspectionId ||
      !s.vehicle ||
      ![s.vehicle.id, s.vehicle.model, s.vehicle.plate, s.createdAt].every(
        (v) => typeof v === "string" && v,
      ) ||
      !Number.isFinite(Date.parse(s.createdAt)) ||
      ![s.scanDuration, s.capturedFrameCount, s.keyFrameCount].every(
        (v) => typeof v === "number" && Number.isFinite(v) && v >= 0,
      ) ||
      ![
        "idle",
        "scanning",
        "uploading",
        "processing",
        "completed",
        "failed",
      ].includes(s.status) ||
      !["demo", "real"].includes(s.cameraMode) ||
      !["potential_damage", "no_damage", "incomplete"].includes(s.scenario) ||
      typeof s.uploadComplete !== "boolean"
    )
      return null;
    return {
      version: 1,
      mode,
      inspectionId: s.inspectionId,
      vehicle: {
        id: s.vehicle.id,
        model: s.vehicle.model,
        plate: s.vehicle.plate,
      },
      createdAt: s.createdAt,
      scanDuration: s.scanDuration,
      capturedFrameCount: s.capturedFrameCount,
      keyFrameCount: s.keyFrameCount,
      cameraMode: s.cameraMode,
      status: s.status,
      uploadComplete: s.uploadComplete,
      scenario: s.scenario,
    };
  } catch {
    return null;
  }
}
export function saveInspectionSession(session: SavedInspectionSession) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(session));
  } catch {
    /* Storage may be blocked; in-memory navigation still works. */
  }
}
export function clearInspectionSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(sessionStorageKey);
  } catch {
    /* Optional storage. */
  }
}
