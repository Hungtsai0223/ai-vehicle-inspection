"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useInspection } from "./inspection-context";
import {
  inspectionService,
  inspectionErrorMessage,
} from "@/services/inspection-service";
/** Refresh a completed session on the result route itself; no camera blobs are required. */
export function useResultRecovery() {
  const {
    sessionReady,
    inspectionId,
    uploadComplete,
    result,
    status,
    sessionVehicle,
    createdAt,
    setResult,
    setStatus,
  } = useInspection();
  const { id, model, plate } = sessionVehicle;
  const router = useRouter();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!sessionReady || !inspectionId || !uploadComplete || result) return;
    if (status !== "completed") {
      router.replace("/analyzing");
      return;
    }
    const controller = new AbortController();
    void inspectionService
      .getInspectionResult(inspectionId, {
        signal: controller.signal,
        vehicle: { id, model, plate },
        createdAt,
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setResult(value);
          setStatus("completed");
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(inspectionErrorMessage(reason));
      });
    return () => controller.abort();
  }, [
    sessionReady,
    inspectionId,
    uploadComplete,
    result,
    status,
    id,
    model,
    plate,
    createdAt,
    router,
    setResult,
    setStatus,
    attempt,
  ]);
  return {
    loading:
      !sessionReady ||
      Boolean(inspectionId && uploadComplete && !result && !error),
    error,
    retry: () => {
      setError("");
      setAttempt((value) => value + 1);
    },
  };
}
