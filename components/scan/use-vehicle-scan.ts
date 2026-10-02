"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInspection } from "@/components/inspection/inspection-context";
import {
  inspectionErrorMessage,
  InspectionApiError,
} from "@/services/inspection-service";
import { cameraMessages } from "@/lib/camera-access";
import { prototypeScanDurationMs } from "@/lib/camera-frame-capture";
import { releaseFramePreview } from "@/lib/frame-store";
import { mockConfig } from "@/lib/mock-data";
import { createMockFrame } from "@/lib/mock-frames";
import type { CapturedFrame } from "@/types/frame";
import type { CameraMode, CameraPermissionState } from "@/types/camera";
const requiredViews = ["front", "left", "rear", "right"] as const;
function enoughFrames(frames: CapturedFrame[]) {
  return (
    frames.length >= 12 &&
    requiredViews.every((view) =>
      frames.some((frame) => frame.vehicleView === view),
    )
  );
}
export function useVehicleScan() {
  const {
    begin,
    setProgress: setSharedProgress,
    setStatus,
    addFrame,
    getFrames,
    retainKeyFrames,
    clearFrames,
    frames,
    setCameraMode,
    prepareAnalysis,
    resetVersion,
  } = useInspection();
  const router = useRouter();
  const [prototypeProgress, setPrototypeProgress] = useState(0);
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
  const started = useRef(0);
  const scanDuration = useRef(0);
  const activeMode = useRef<CameraMode>("demo");
  const controller = useRef<AbortController | undefined>(undefined);
  const interval = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearTimers = useCallback(() => {
    clearInterval(interval.current);
    clearTimeout(timeout.current);
  }, []);
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
      clearTimers();
      if (!committed.current) clearFrames();
    };
  }, [clearTimers, clearFrames, cancelRun]);
  const reset = useCallback(() => {
    cancelRun();
    clearTimers();
    clearFrames();
    committed.current = false;
    updatePhase("idle");
    setPrototypeProgress(0);
    setSharedProgress(0);
    setStatus("idle");
    setCameraRequested(false);
    setCameraState("idle");
    setError("");
  }, [
    clearTimers,
    clearFrames,
    updatePhase,
    setSharedProgress,
    setStatus,
    cancelRun,
  ]);
  const lastReset = useRef(resetVersion);
  useEffect(() => {
    if (lastReset.current !== resetVersion) {
      lastReset.current = resetVersion;
      reset();
    }
  }, [resetVersion, reset]);
  const onFrameCapture = useCallback(
    (frame: CapturedFrame) => {
      if (phaseRef.current !== "scanning" || !mounted.current) {
        releaseFramePreview(frame);
        return;
      }
      addFrame(frame);
    },
    [addFrame],
  );
  const getCaptureMetadata = useCallback(() => {
    const timestamp = Math.max(0, performance.now() - started.current);
    return {
      timestamp,
      prototypeProgress: Math.min(
        95,
        (timestamp / prototypeScanDurationMs) * 100,
      ),
    };
  }, []);
  const upload = useCallback(async () => {
    const token = run.current;
    controller.current = new AbortController();
    updatePhase("complete");
    setError("");
    try {
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
    }
  }, [prepareAnalysis, router, updatePhase]);
  const finish = useCallback(() => {
    if (phaseRef.current !== "scanning") return;
    if (activeMode.current === "real" && !enoughFrames(getFrames())) return;
    clearTimers();
    updatePhase("complete");
    setPrototypeProgress(100);
    setSharedProgress(100);
    if (activeMode.current === "demo") {
      // Only the explicit demo may fill simulated metadata for throttled timers.
      const existing = getFrames();
      for (let i = 0; i < 16; i++)
        if (!existing.some((frame) => frame.id === `mock_frame_${i}`))
          addFrame(createMockFrame(i, i * 500));
    }
    retainKeyFrames();
    scanDuration.current = (performance.now() - started.current) / 1000;
    setCameraRequested(false); // Unmounts real preview, stopping every track.
    void upload();
  }, [
    clearTimers,
    updatePhase,
    setSharedProgress,
    getFrames,
    addFrame,
    retainKeyFrames,
    upload,
  ]);
  const startScanning = useCallback(
    async (mode: CameraMode) => {
      const token = run.current;
      controller.current = new AbortController();
      try {
        await begin(controller.current.signal);
        if (!mounted.current || token !== run.current) return;
        activeMode.current = mode;
        started.current = performance.now();
        updatePhase("scanning");
        interval.current = setInterval(() => {
          const elapsed = performance.now() - started.current;
          const value = Math.min(
            mode === "real" ? 95 : 100,
            (elapsed /
              (mode === "real"
                ? prototypeScanDurationMs
                : mockConfig.scanDurationMs)) *
              100,
          );
          setPrototypeProgress(value);
          setSharedProgress(value);
          if (mode === "demo" && value >= 100) finish();
        }, 100);
      } catch (error) {
        if (!mounted.current || token !== run.current) return;
        setError(inspectionErrorMessage(error));
        setStatus("failed");
        setCameraRequested(false);
        updatePhase("idle");
      }
    },
    [begin, updatePhase, setSharedProgress, finish, setStatus],
  );
  function start(mode: CameraMode) {
    if (phaseRef.current !== "idle") return;
    reset();
    setCameraMode(mode);
    updatePhase("opening");
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
        clearTimers();
        clearFrames();
        updatePhase("idle");
        setPrototypeProgress(0);
        setSharedProgress(0);
        setStatus("idle");
        setCameraRequested(false);
        setError(cameraMessages[state]);
      }
    },
    [
      clearTimers,
      clearFrames,
      updatePhase,
      setStatus,
      setSharedProgress,
      cancelRun,
    ],
  );
  const onCaptureError = useCallback(
    (message: string) => setError(message),
    [],
  );
  return {
    prototypeProgress,
    progress: prototypeProgress,
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
    canFinish: enoughFrames(frames),
    running: phase !== "idle",
  };
}
