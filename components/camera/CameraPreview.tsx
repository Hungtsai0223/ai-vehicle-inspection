"use client";
import { useEffect, useEffectEvent } from "react";
import type { CaptureMetadata } from "@/types/scan";
import type { CapturedFrame } from "@/types/frame";
import type { ScanState } from "@/types/inspection";
import type { CameraMode, CameraPermissionState } from "@/types/camera";
import { createMockFrame } from "@/lib/mock-frames";
import { MockCameraPreview } from "./mock-camera-preview";
import { RealCameraPreview } from "./RealCameraPreview";
export interface CameraPreviewProps {
  onFrameCapture?: (frame: CapturedFrame) => void;
  scanActive: boolean;
  state?: ScanState;
  mode?: CameraMode;
  cameraRequested?: boolean;
  cameraRequestId?: number;
  onCameraReady?: () => void;
  onCameraStateChange?: (state: CameraPermissionState) => void;
  onCaptureError?: (message: string) => void;
  onUseDemo?: () => void;
  getCaptureMetadata?: () => CaptureMetadata;
}
export function CameraPreview(props: CameraPreviewProps) {
  const {
    onFrameCapture,
    scanActive,
    state = "good",
    mode = "demo",
    cameraRequested = false,
  } = props;
  const demoCapture = useEffectEvent((index: number, timestamp: number) => {
    const metadata = props.getCaptureMetadata?.();
    onFrameCapture?.({
      ...createMockFrame(index, timestamp),
      scan: metadata?.scan,
      timestamp: metadata?.timestamp ?? timestamp,
    });
  });
  useEffect(() => {
    if (mode !== "demo" || !scanActive || !onFrameCapture) return;
    const started = performance.now();
    let index = 0;
    const capture = () => {
      demoCapture(index++, performance.now() - started);
    };
    capture();
    const timer = setInterval(capture, 500);
    return () => clearInterval(timer);
  }, [mode, scanActive, onFrameCapture]);
  if (mode === "real" && cameraRequested)
    return <RealCameraPreview key={props.cameraRequestId} {...props} />;
  return (
    <MockCameraPreview
      state={state}
      showBoundingBox={false}
      aimOnly={mode === "real"}
      label={mode === "real" ? "真實相機 · 按開始後開啟" : undefined}
    />
  );
}
export default CameraPreview;
