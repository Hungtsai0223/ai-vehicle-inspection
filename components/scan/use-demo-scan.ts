"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInspection } from "@/components/inspection/inspection-context";
import { inspectionApi } from "@/lib/api";
import { mockConfig } from "@/lib/mock-data";
import type { KeyFrame } from "@/types/inspection";
export function useDemoScan() {
  const { begin, setProgress: setSharedProgress, setStatus } = useInspection();
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "scanning" | "complete">("idle");
  const [error, setError] = useState("");
  const active = useRef(false);
  const mounted = useRef(true);
  const interval = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
    setError("");
    setProgress(0);
    setPhase("scanning");
    const fail = (e: unknown) => {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : "無法完成掃描，請重試。");
      setPhase("idle");
      active.current = false;
    };
    try {
      const id = await begin();
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
        // TODO: replace these explicit mock Blobs with camera-extracted JPEGs.
        const frames: KeyFrame[] = Array.from({ length: 16 }, (_, i) => ({
          id: `mock_${i}`,
          image: new Blob(["mock-frame"], { type: "text/plain" }),
          angle: i * 22.5,
          timestamp: i * (mockConfig.scanDurationMs / 16),
        }));
        // Give the completed state 800 ms of screen time before navigation.
        timeout.current = setTimeout(() => {
          void inspectionApi
            .uploadKeyFrames(id, frames)
            .then(() => {
              if (!mounted.current) return;
              setStatus("analyzing");
              router.push("/analyzing");
            })
            .catch(fail);
        }, mockConfig.scanCompleteDelayMs);
      }, 80);
    } catch (e) {
      fail(e);
    }
  }
  return { progress, phase, error, start, running: phase !== "idle" };
}
