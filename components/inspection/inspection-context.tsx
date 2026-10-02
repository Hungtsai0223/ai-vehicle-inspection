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
  clearInspectionSession,
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
  const generation = useRef(0);
  const activeTransfer = useRef<AbortController | null>(null);
  const [resetVersion, setResetVersion] = useState(0);
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
    "idle" | "preparing" | "uploading" | "uploaded" | "failed"
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
        if (saved.uploadComplete) setTransferStage("uploaded");
        if (saved.status === "completed") {
          setProcessingProgress(100);
          setProcessingStage("completed");
        }
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
  useEffect(
    () => () => {
      activeTransfer.current?.abort();
      frameStore.clear();
    },
    [frameStore],
  );
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
  const resetInspection = useCallback(() => {
    generation.current++;
    activeTransfer.current?.abort();
    inspectionService.forgetInspection(current.current.inspectionId);
    releaseUploadedFrames();
    clearInspectionSession();
    patch(initialSession());
    setResult(null);
    setApiError("");
    setProgress(0);
    setRecaptured(false);
    setScenario(mockConfig.defaultScenario);
    setPoorNetwork(false);
    setProcessingProgress(0);
    setProcessingStage("image_validation");
    setTransferStage("idle");
    setResetVersion((value) => value + 1);
  }, [patch, releaseUploadedFrames]);
  const begin = useCallback(
    async (signal?: AbortSignal) => {
      const token = ++generation.current;
      activeTransfer.current?.abort();
      inspectionService.forgetInspection(current.current.inspectionId);
      clearInspectionSession();
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
      if (signal?.aborted || token !== generation.current)
        throw new InspectionApiError("ABORTED");
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
      activeTransfer.current?.abort();
      const transfer = new AbortController();
      activeTransfer.current = transfer;
      const abort = () => transfer.abort();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) transfer.abort();
      if (!id) {
        signal?.removeEventListener("abort", abort);
        throw new InspectionApiError("INVALID_FRAMES");
      }
      const check = () => {
        if (transfer.signal.aborted || current.current.inspectionId !== id)
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
            if (
              transfer.signal.aborted ||
              current.current.inspectionId !== id
            ) {
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
          await inspectionService.uploadInspectionFrames(id, selected, {
            signal: transfer.signal,
          });
          check();
          patch({ uploadComplete: true });
          // Backend has the bytes; previews and blobs are no longer needed for analysis.
          releaseUploadedFrames();
        }
        check();
        setTransferStage("uploaded");
        const response = await inspectionService.completeInspection(id, {
          signal: transfer.signal,
        });
        check();
        patch({ status: response.status });
        setProcessingProgress(0);
        setProcessingStage("image_validation");
        return id;
      } catch (error) {
        if (!transfer.signal.aborted && current.current.inspectionId === id) {
          setApiError(inspectionErrorMessage(error));
          patch({ status: "failed" });
          setTransferStage(
            current.current.uploadComplete ? "uploaded" : "failed",
          );
        }
        throw error;
      } finally {
        signal?.removeEventListener("abort", abort);
        if (activeTransfer.current === transfer) activeTransfer.current = null;
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
      setTransferStage("uploaded");
      setProcessingProgress(100);
      setProcessingStage("completed");
    },
    [patch, releaseUploadedFrames],
  );
  return {
    acceptCompletedResult,
    resetInspection,
    resetVersion,
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
