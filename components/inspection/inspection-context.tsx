"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type {
  InspectionResult,
  Scenario,
  InspectionStatus,
} from "@/types/inspection";
import { inspectionApi } from "@/lib/api";
const Context = createContext<ReturnType<typeof useInspectionState> | null>(
  null,
);
function useInspectionState() {
  const [scenario, setScenario] = useState<Scenario>("damage");
  const [inspectionId, setId] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<InspectionStatus["status"]>("scanning");
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [recaptured, setRecaptured] = useState(false);
  const [poorNetwork, setPoorNetwork] = useState(false);
  async function begin() {
    const { inspectionId: id } = await inspectionApi.startInspection(scenario);
    setId(id);
    setProgress(0);
    setResult(null);
    setRecaptured(false);
    setStatus("scanning");
    return id;
  }
  return {
    scenario,
    setScenario,
    inspectionId,
    progress,
    setProgress,
    status,
    setStatus,
    result,
    setResult,
    recaptured,
    setRecaptured,
    poorNetwork,
    setPoorNetwork,
    begin,
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
