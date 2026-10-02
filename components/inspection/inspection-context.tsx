"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type {
  InspectionResult,
  InspectionStatus,
  Scenario,
} from "@/types/inspection";
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
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [recaptured, setRecaptured] = useState(false);
  const [poorNetwork, setPoorNetwork] = useState(false);
  const vehicle = result?.vehicle ?? mockVehicle;
  const begin = useCallback(async () => {
    const { inspectionId: id } = await inspectionService.createInspection({
      vehicle: mockVehicle,
      scenario,
    });
    setId(id);
    setProgress(0);
    setFrames([]);
    setResult(null);
    setRecaptured(false);
    setStatus("scanning");
    return id;
  }, [scenario]);
  return {
    scenario,
    setScenario,
    inspectionId,
    progress,
    setProgress,
    status,
    setStatus,
    frames,
    setFrames,
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
