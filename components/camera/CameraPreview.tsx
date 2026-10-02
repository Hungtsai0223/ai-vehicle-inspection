"use client";
import { useEffect } from "react";
import type { CapturedFrame } from "@/types/frame";
import type { ScanState } from "@/types/inspection";
import { createMockFrame } from "@/lib/mock-frames";
import { MockCameraPreview } from "./mock-camera-preview";
export interface CameraPreviewProps {
  onFrameCapture?: (frame: CapturedFrame) => void;
  scanActive: boolean;
  state?: ScanState;
}
/** The default camera stays simulated; no media permissions are requested. */
export function CameraPreview({
  onFrameCapture,
  scanActive,
  state = "good",
}: CameraPreviewProps) {
  useEffect(() => {
    if (!scanActive || !onFrameCapture) return;
    const started = performance.now();
    let index = 0;
    const capture = () => {
      if (index < 16)
        onFrameCapture(createMockFrame(index++, performance.now() - started));
    };
    capture();
    const timer = setInterval(capture, 500);
    return () => clearInterval(timer);
  }, [scanActive, onFrameCapture]);
  return <MockCameraPreview state={state} />;
}
export default CameraPreview;
