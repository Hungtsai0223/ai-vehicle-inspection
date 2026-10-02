"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  InspectionResult,
  InspectionStatus,
  ProcessingStage,
  Scenario,
} from "@/types/inspection";
import type { CameraMode } from "@/types/camera";
import { MemoryFrameStore, releaseFramePreview } from "@/lib/frame-store";
import {
  isDevelopmentStub,
  materializeDemoFrames,
} from "@/lib/dev-demo-frames";
import {
  readInspectionSession,
  saveInspectionSession,
  type SavedInspectionSession,
} from "@/lib/inspection-session";
import type { CapturedFrame } from "@/types/frame";
import {
  inspectionService,
  InspectionApiError,
  inspectionErrorMessage,
} from "@/services/inspection-service";
import { mockConfig, mockVehicle } from "@/lib/mock-data";
const Context = createContext<ReturnType<typeof useInspectionState> | null>(
  null,
);
const initialSession = (): SavedInspectionSession => ({
  version: 1,
  mode: inspectionService.mode,
  inspectionId: "",
  vehicle: mockVehicle,
  createdAt: new Date().toISOString(),
  scanDuration: 0,
  capturedFrameCount: 0,
  keyFrameCount: 0,
  cameraMode: "demo",
  status: "idle",
  uploadComplete: false,
  scenario: mockConfig.defaultScenario,
});
function useInspectionState() {
  const [session, setSession] = useState(initialSession);
  const current = useRef(session);
  const [sessionReady, setSessionReady] = useState(false);
  const [scenario, setScenario] = useState<Scenario>(
    mockConfig.defaultScenario,
  );
  const [progress, setProgress] = useState(0);
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [frameStore] = useState(() => new MemoryFrameStore());
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [recaptured, setRecaptured] = useState(false);
  const [poorNetwork, setPoorNetwork] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] =
    useState<ProcessingStage>("image_validation");
  const [apiError, setApiError] = useState("");
  const [transferStage, setTransferStage] = useState<
    "idle" | "preparing" | "uploading" | "starting"
  >("idle");
  const patch = useCallback((value: Partial<SavedInspectionSession>) => {
    current.current = { ...current.current, ...value };
    setSession(current.current);
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const saved = readInspectionSession(inspectionService.mode);
      if (saved) {
        patch(saved);
        setScenario(saved.scenario);
        if (saved.uploadComplete)
          inspectionService.restoreMockSession(
            saved.inspectionId,
            { vehicle: saved.vehicle, scenario: saved.scenario },
            saved.keyFrameCount,
            saved.status === "completed",
          );
      }
      setSessionReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [patch]);
  useEffect(() => {
    if (sessionReady && session.inspectionId) saveInspectionSession(session);
  }, [session, sessionReady]);
  useEffect(() => () => frameStore.clear(), [frameStore]);
  const releaseUploadedFrames = useCallback(() => {
    frameStore.clear();
    setFrames([]);
  }, [frameStore]);
  const clearFrames = useCallback(() => {
    releaseUploadedFrames();
    patch({ capturedFrameCount: 0 });
  }, [releaseUploadedFrames, patch]);
  const addFrame = useCallback(
    (frame: CapturedFrame) => {
      const duplicate = frameStore
        .getFrames()
        .some((item) => item.id === frame.id);
      frameStore.addFrame(frame);
      setFrames(frameStore.getFrames());
      if (!duplicate)
        patch({ capturedFrameCount: current.current.capturedFrameCount + 1 });
    },
    [frameStore, patch],
  );
  const retainKeyFrames = useCallback(() => {
    const selected = frameStore.retainKeyFrames();
    setFrames(selected);
    patch({ keyFrameCount: selected.length });
    return selected;
  }, [frameStore, patch]);
  const getFrames = useCallback(() => frameStore.getFrames(), [frameStore]);
  const setStatus = useCallback(
    (status: InspectionStatus) => patch({ status }),
    [patch],
  );
  const setCameraMode = useCallback(
    (cameraMode: CameraMode) => patch({ cameraMode }),
    [patch],
  );
  const begin = useCallback(
    async (signal?: AbortSignal) => {
      clearFrames();
      setResult(null);
      setApiError("");
      setProgress(0);
      setRecaptured(false);
      const vehicle = current.current.vehicle;
      patch({
        inspectionId: "",
        status: "idle",
        uploadComplete: false,
        keyFrameCount: 0,
      });
      const { inspectionId } = await inspectionService.createInspection(
        { vehicle, scenario },
        { signal },
      );
      if (signal?.aborted) throw new InspectionApiError("ABORTED");
      patch({
        inspectionId,
        status: "scanning",
        vehicle,
        createdAt: new Date().toISOString(),
        scanDuration: 0,
        keyFrameCount: 0,
        uploadComplete: false,
        scenario,
      });
      return inspectionId;
    },
    [scenario, clearFrames, patch],
  );
  const prepareAnalysis = useCallback(
    async (scanDuration: number, signal?: AbortSignal) => {
      const id = current.current.inspectionId;
      if (!id) throw new InspectionApiError("UPLOAD_FAILED");
      const check = () => {
        if (signal?.aborted || current.current.inspectionId !== id)
          throw new InspectionApiError("ABORTED");
      };
      setApiError("");
      setTransferStage("preparing");
      patch({ scanDuration, status: "uploading" });
      try {
        check();
        if (!current.current.uploadComplete) {
          let selected = frameStore.getKeyFrames();
          if (
            current.current.cameraMode === "demo" &&
            inspectionService.mode === "API" &&
            selected.some((f) => !f.blob)
          ) {
            const generated = await materializeDemoFrames(selected);
            if (signal?.aborted) {
              generated.forEach(releaseFramePreview);
              check();
            }
            generated.forEach((frame) => frameStore.addFrame(frame));
            selected = frameStore.retainKeyFrames();
            setFrames(selected);
          }
          check();
          setTransferStage("uploading");
          patch({ keyFrameCount: selected.length });
          await inspectionService.uploadInspectionFrames(id, selected);
          check();
          patch({ uploadComplete: true });
          // Backend has the bytes; previews and blobs are no longer needed for analysis.
          releaseUploadedFrames();
        }
        check();
        setTransferStage("starting");
        const response = await inspectionService.completeInspection(id);
        check();
        patch({ status: response.status });
        setProcessingProgress(0);
        setProcessingStage("image_validation");
        setTransferStage("idle");
        return id;
      } catch (error) {
        if (!signal?.aborted && current.current.inspectionId === id) {
          setApiError(inspectionErrorMessage(error));
          patch({ status: "failed" });
          setTransferStage("idle");
        }
        throw error;
      }
    },
    [frameStore, patch, releaseUploadedFrames],
  );
  const acceptCompletedResult = useCallback(
    (result: InspectionResult) => {
      releaseUploadedFrames();
      setResult(result);
      setApiError("");
      patch({
        inspectionId: result.inspectionId,
        vehicle: result.vehicle,
        createdAt: result.createdAt,
        scanDuration: result.scanDurationSeconds,
        keyFrameCount: result.keyFrameCount,
        capturedFrameCount: result.keyFrameCount,
        uploadComplete: true,
        status: "completed",
        cameraMode: "demo",
      });
      setProcessingProgress(100);
      setProcessingStage("completed");
    },
    [patch, releaseUploadedFrames],
  );
  return {
    acceptCompletedResult,
    scenario,
    setScenario,
    inspectionId: session.inspectionId,
    vehicle: result?.vehicle ?? session.vehicle,
    sessionVehicle: session.vehicle,
    usingDevStub: isDevelopmentStub(),
    createdAt: session.createdAt,
    sessionReady,
    progress,
    setProgress,
    status: session.status,
    setStatus,
    frames,
    addFrame,
    clearFrames,
    retainKeyFrames,
    getFrames,
    capturedFrameCount: session.capturedFrameCount,
    keyFrameCount: session.keyFrameCount,
    cameraMode: session.cameraMode,
    setCameraMode,
    scanDuration: session.scanDuration,
    uploadComplete: session.uploadComplete,
    prepareAnalysis,
    processingProgress,
    setProcessingProgress,
    processingStage,
    setProcessingStage,
    apiError,
    setApiError,
    transferStage,
    result,
    setResult,
    recaptured,
    setRecaptured,
    poorNetwork,
    setPoorNetwork,
    begin,
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
