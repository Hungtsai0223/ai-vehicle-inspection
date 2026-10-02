"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInspection } from "@/components/inspection/inspection-context";
import { inspectionErrorMessage } from "@/services/inspection-service";
import { mockConfig } from "@/lib/mock-data";
import { createMockFrame } from "@/lib/mock-frames";
import type { CapturedFrame } from "@/types/frame";
export function useDemoScan() {
  const {
    begin,
    setProgress: setSharedProgress,
    setStatus,
    setFrames,
  } = useInspection();
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "scanning" | "complete">("idle");
  const [error, setError] = useState("");
  const active = useRef(false);
  const mounted = useRef(true);
  const buffer = useRef<CapturedFrame[]>([]);
  const interval = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onFrameCapture = useCallback((frame: CapturedFrame) => {
    buffer.current.push(frame);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearInterval(interval.current);
      clearTimeout(timeout.current);
    };
  }, []);
  async function start() {
    if (active.current) return;
    active.current = true;
    buffer.current = [];
    setError("");
    setProgress(0);
    setPhase("scanning");
    try {
      await begin();
      if (!mounted.current) return;
      const started = performance.now();
      interval.current = setInterval(() => {
        const value = Math.min(
          100,
          ((performance.now() - started) / mockConfig.scanDurationMs) * 100,
        );
        setProgress(value);
        setSharedProgress(value);
        if (value < 100) return;
        clearInterval(interval.current);
        setPhase("complete");
        // Guarantee 16 mock metadata frames even when background-tab timers are throttled.
        // A future real camera must never fill missing captures with fabricated frames.
        const frames = Array.from(
          { length: 16 },
          (_, i) =>
            buffer.current.find((frame) => frame.id === `mock_frame_${i}`) ??
            createMockFrame(i, i * 500),
        );
        setFrames(frames);
        timeout.current = setTimeout(() => {
          if (!mounted.current) return;
          setStatus("uploading");
          router.push("/analyzing");
        }, mockConfig.scanCompleteDelayMs);
      }, 80);
    } catch (error) {
      if (!mounted.current) return;
      setError(inspectionErrorMessage(error));
      setStatus("failed");
      setPhase("idle");
      active.current = false;
    }
  }
  return {
    progress,
    phase,
    error,
    start,
    onFrameCapture,
    running: phase !== "idle",
  };
}
