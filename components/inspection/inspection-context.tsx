"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  InspectionResult,
  InspectionStatus,
  Scenario,
} from "@/types/inspection";
import type { CameraMode } from "@/types/camera";
import { MemoryFrameStore } from "@/lib/frame-store";
import type { CapturedFrame } from "@/types/frame";
import { inspectionService } from "@/services/inspection-service";
import { mockConfig, mockVehicle } from "@/lib/mock-data";
const Context = createContext<ReturnType<typeof useInspectionState> | null>(
  null,
);
function useInspectionState() {
  const [scenario, setScenario] = useState<Scenario>(
    mockConfig.defaultScenario,
  );
  const [inspectionId, setId] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<InspectionStatus>("idle");
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [frameStore] = useState(() => new MemoryFrameStore());
  const [capturedFrameCount, setCapturedFrameCount] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>("demo");
  const clearFrames = useCallback(() => {
    frameStore.clear();
    setFrames([]);
    setCapturedFrameCount(0);
  }, [frameStore]);
  const addFrame = useCallback(
    (frame: CapturedFrame) => {
      const duplicate = frameStore
        .getFrames()
        .some((item) => item.id === frame.id);
      frameStore.addFrame(frame);
      setFrames(frameStore.getFrames());
      if (!duplicate) setCapturedFrameCount((count) => count + 1);
    },
    [frameStore],
  );
  const retainKeyFrames = useCallback(() => {
    const selected = frameStore.retainKeyFrames();
    setFrames(selected);
    return selected;
  }, [frameStore]);
  const getFrames = useCallback(() => frameStore.getFrames(), [frameStore]);
  useEffect(() => () => frameStore.clear(), [frameStore]);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [recaptured, setRecaptured] = useState(false);
  const [poorNetwork, setPoorNetwork] = useState(false);
  const vehicle = result?.vehicle ?? mockVehicle;
  const begin = useCallback(
    async (signal?: AbortSignal) => {
      clearFrames();
      const { inspectionId: id } = await inspectionService.createInspection({
        vehicle: mockVehicle,
        scenario,
      });
      if (signal?.aborted) throw new Error("Inspection start cancelled");
      setId(id);
      setProgress(0);
      setResult(null);
      setRecaptured(false);
      setStatus("scanning");
      return id;
    },
    [scenario, clearFrames],
  );
  return {
    scenario,
    setScenario,
    inspectionId,
    progress,
    setProgress,
    status,
    setStatus,
    frames,
    addFrame,
    clearFrames,
    retainKeyFrames,
    getFrames,
    capturedFrameCount,
    cameraMode,
    setCameraMode,
    result,
    setResult,
    recaptured,
    setRecaptured,
    poorNetwork,
    setPoorNetwork,
    begin,
    vehicle,
    mode: inspectionService.mode,
    coverage: result?.coverage ?? progress / 100,
    detections: result?.damages ?? [],
  };
}
export function InspectionProvider({ children }: { children: ReactNode }) {
  const state = useInspectionState();
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useInspection() {
  const state = useContext(Context);
  if (!state) throw new Error("InspectionProvider required");
  return state;
}
