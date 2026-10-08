"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useInspection } from "@/components/inspection/inspection-context";
import {
  inspectionErrorMessage,
  InspectionApiError,
} from "@/services/inspection-service";
import { cameraMessages } from "@/lib/camera-access";
import { releaseFramePreview } from "@/lib/frame-store";
import {
  initialCoverage,
  recordSectorFrame,
  frameQualityProblem,
  canCompleteScan,
  armSector,
  markUnavailable,
  chooseSector,
} from "@/lib/scan-coverage";
import {
  framingState,
  pendingVehicleFramingProvider,
} from "@/lib/vehicle-framing";
import {
  guidedVehicleViewClassifier,
  sectorVehicleView,
} from "@/lib/vehicle-view-classifier";
import type { CapturedFrame } from "@/types/frame";
import type { CameraMode, CameraPermissionState } from "@/types/camera";
import type { ScanState } from "@/types/inspection";
import type {
  CaptureMetadata,
  FramingState,
  ScanSector,
  VehicleScanCoverage,
} from "@/types/scan";
export function useVehicleScan(validation: ScanState = "good") {
  const {
    begin,
    setProgress: setSharedProgress,
    setStatus,
    addFrame,
    retainKeyFrames,
    clearFrames,
    setCameraMode,
    setScanUnavailable,
    prepareAnalysis,
    resetVersion,
    mode: inspectionMode,
    poorNetwork,
    uploadComplete,
  } = useInspection();
  const router = useRouter();
  const [coverage, setCoverage] = useState(initialCoverage);
  const coverageRef = useRef(coverage);
  const [framing, setFraming] = useState<FramingState>("UNKNOWN");
  const [qualityMessage, setQualityMessage] = useState("");
  const [phase, setPhase] = useState<
    "idle" | "opening" | "scanning" | "complete" | "upload-error"
  >("idle");
  const [cameraRequested, setCameraRequested] = useState(false);
  const [cameraRequestId, setCameraRequestId] = useState(0);
  const [cameraState, setCameraState] = useState<CameraPermissionState>("idle");
  const [error, setError] = useState("");
  const phaseRef = useRef<typeof phase>("idle");
  const run = useRef(0);
  const mounted = useRef(true);
  const committed = useRef(false);
  const uploadRun = useRef<number | null>(null);
  const started = useRef(0);
  const scanDuration = useRef(0);
  const activeMode = useRef<CameraMode>("demo");
  const controller = useRef<AbortController | undefined>(undefined);
  const updateCoverage = useCallback(
    (value: VehicleScanCoverage) => {
      coverageRef.current = value;
      setCoverage(value);
      setSharedProgress(value.completionRatio * 100);
    },
    [setSharedProgress],
  );
  const updatePhase = useCallback((value: typeof phase) => {
    phaseRef.current = value;
    setPhase(value);
  }, []);
  const cancelRun = useCallback(() => {
    run.current++;
    controller.current?.abort();
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelRun();
      if (!committed.current) clearFrames();
    };
  }, [clearFrames, cancelRun]);
  const reset = useCallback(
    (clearSharedState = true) => {
      cancelRun();
      if (clearSharedState) clearFrames();
      committed.current = false;
      updatePhase("idle");
      coverageRef.current = initialCoverage();
      setCoverage(coverageRef.current);
      if (clearSharedState) {
        setSharedProgress(0);
        setStatus("idle");
      }
      setCameraRequested(false);
      setCameraState("idle");
      setError("");
      setQualityMessage("");
      setFraming("UNKNOWN");
    },
    [clearFrames, updatePhase, setSharedProgress, setStatus, cancelRun],
  );
  const lastReset = useRef(resetVersion);
  useEffect(() => {
    if (lastReset.current !== resetVersion) {
      lastReset.current = resetVersion;
      reset(false);
    }
  }, [resetVersion, reset]);
  const upload = useCallback(async () => {
    const token = run.current;
    if (uploadRun.current === token) return;
    uploadRun.current = token;
    controller.current = new AbortController();
    updatePhase("complete");
    setError("");
    try {
      if (inspectionMode === "MOCK" && poorNetwork && !uploadComplete)
        throw new InspectionApiError("NETWORK_ERROR");
      await prepareAnalysis(scanDuration.current, controller.current.signal);
      if (!mounted.current || token !== run.current) return;
      committed.current = true;
      router.push("/analyzing");
    } catch (error) {
      if (!mounted.current || token !== run.current) return;
      setError(
        error instanceof InspectionApiError &&
          error.code === "NETWORK_ERROR" &&
          !error.httpStatus
          ? "網路連線中斷，目前掃描結果尚未成功送出。"
          : inspectionErrorMessage(error),
      );
      updatePhase("upload-error");
    } finally {
      if (uploadRun.current === token) uploadRun.current = null;
    }
  }, [
    prepareAnalysis,
    router,
    updatePhase,
    inspectionMode,
    poorNetwork,
    uploadComplete,
  ]);
  const finish = useCallback(() => {
    if (
      phaseRef.current !== "scanning" ||
      !canCompleteScan(coverageRef.current)
    )
      return;
    updatePhase("complete");
    // Include all uncaptured directions as local Unknown, including unfinished angles.
    setScanUnavailable(
      coverageRef.current.sectors
        .filter((s) => s.status !== "captured")
        .map((s) => s.id),
    );
    retainKeyFrames();
    scanDuration.current = (performance.now() - started.current) / 1000;
    setCameraRequested(false);
    void upload();
  }, [updatePhase, setScanUnavailable, retainKeyFrames, upload]);
  const receiveFrame = useCallback(
    (frame: CapturedFrame) => {
      if (phaseRef.current !== "scanning" || !mounted.current || !frame.scan) {
        releaseFramePreview(frame);
        return;
      }
      const mode = activeMode.current;
      const frameFraming =
        mode === "demo"
          ? validation === "too_close"
            ? "TOO_CLOSE"
            : validation === "too_far"
              ? "TOO_FAR"
              : "GOOD"
          : framingState(pendingVehicleFramingProvider.inspect(frame));
      setFraming(frameFraming);
      const label = guidedVehicleViewClassifier.classify(
        frame,
        frame.scan,
        mode,
      );
      const labeledFrame = {
        ...frame,
        scan: label,
        vehicleView: sectorVehicleView(label.sector),
      };
      const problem = frameQualityProblem(
        labeledFrame,
        frameFraming,
        mode === "demo" ? validation : undefined,
      );
      const previous = coverageRef.current;
      const outcome = recordSectorFrame(
        previous,
        labeledFrame,
        problem,
        mode === "demo",
      );
      if (previous.armed) setQualityMessage(problem ?? "");
      if (outcome.coverage !== previous) updateCoverage(outcome.coverage);
      if (outcome.accepted) {
        addFrame(labeledFrame);
        if (
          outcome.coverage.capturedSectorCount > previous.capturedSectorCount &&
          typeof navigator.vibrate === "function"
        ) {
          try {
            navigator.vibrate(30);
          } catch {
            /* Optional haptic. */
          }
        }
        if (mode === "demo" && outcome.coverage.capturedSectorCount === 12)
          finish();
      } else releaseFramePreview(frame);
    },
    [validation, updateCoverage, addFrame, finish],
  );
  const receiveFrameRef = useRef(receiveFrame);
  useLayoutEffect(() => {
    receiveFrameRef.current = receiveFrame;
  }, [receiveFrame]);
  // Stable callback: sampling intervals must not restart for each received frame.
  const onFrameCapture = useCallback(
    (frame: CapturedFrame) => receiveFrameRef.current(frame),
    [],
  );
  const getCaptureMetadata = useCallback((): CaptureMetadata => {
    const current = coverageRef.current;
    return {
      timestamp: Math.max(0, performance.now() - started.current),
      prototypeProgress: current.completionRatio * 100,
      scan:
        current.currentSector && current.armed
          ? {
              sector: current.currentSector,
              requestId: current.requestId,
              source:
                activeMode.current === "demo" ? "demo" : "guided-prototype",
            }
          : undefined,
    };
  }, []);
  const startScanning = useCallback(
    async (mode: CameraMode) => {
      const token = run.current;
      controller.current = new AbortController();
      try {
        await begin(controller.current.signal);
        if (!mounted.current || token !== run.current) return;
        activeMode.current = mode;
        started.current = performance.now();
        updateCoverage(initialCoverage(true));
        updatePhase("scanning");
      } catch (error) {
        if (!mounted.current || token !== run.current) return;
        setError(inspectionErrorMessage(error));
        setStatus("failed");
        setCameraRequested(false);
        updatePhase("idle");
      }
    },
    [begin, updateCoverage, updatePhase, setStatus],
  );
  function start(mode: CameraMode) {
    if (phaseRef.current !== "idle") return;
    reset();
    setCameraMode(mode);
    updatePhase("opening");
    activeMode.current = mode;
    if (mode === "real") {
      setCameraState("loading");
      setCameraRequestId((id) => id + 1);
      setCameraRequested(true);
    } else void startScanning("demo");
  }
  const onCameraReady = useCallback(() => {
    if (phaseRef.current === "opening") void startScanning("real");
  }, [startScanning]);
  const onCameraStateChange = useCallback(
    (state: CameraPermissionState) => {
      setCameraState(state);
      if (!["loading", "permission_granted", "idle"].includes(state)) {
        cancelRun();
        clearFrames();
        updatePhase("idle");
        updateCoverage(initialCoverage());
        setStatus("idle");
        setCameraRequested(false);
        setError(cameraMessages[state]);
      }
    },
    [clearFrames, updatePhase, updateCoverage, setStatus, cancelRun],
  );
  const onCaptureError = useCallback(
    (message: string) => setError(message),
    [],
  );
  return {
    coverage,
    framing,
    qualityMessage,
    prototypeProgress: coverage.completionRatio * 100,
    progress: coverage.completionRatio * 100,
    phase,
    error,
    start,
    retryUpload: upload,
    finish,
    reset,
    onFrameCapture,
    getCaptureMetadata,
    cameraRequested,
    cameraRequestId,
    cameraState,
    onCameraReady,
    onCameraStateChange,
    onCaptureError,
    canFinish: canCompleteScan(coverage),
    running: phase !== "idle",
    pauseCurrent: () => {
      if (phaseRef.current === "scanning")
        updateCoverage({
          ...coverageRef.current,
          armed: false,
          requestId: coverageRef.current.requestId + 1,
        });
    },
    armCurrent: () => {
      if (phaseRef.current === "scanning") {
        setQualityMessage("");
        updateCoverage(armSector(coverageRef.current));
      }
    },
    skipCurrent: () => {
      if (phaseRef.current === "scanning") {
        setQualityMessage("");
        updateCoverage(markUnavailable(coverageRef.current));
      }
    },
    selectSector: (sector: ScanSector) => {
      if (phaseRef.current === "scanning") {
        setQualityMessage("");
        updateCoverage(chooseSector(coverageRef.current, sector));
      }
    },
  };
}
