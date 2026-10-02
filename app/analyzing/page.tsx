"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ScanLine } from "lucide-react";
import { AnalysisProgress } from "@/components/inspection/analysis-progress";
import { useInspection } from "@/components/inspection/inspection-context";
import { mockConfig } from "@/lib/mock-data";
import {
  inspectionService,
  InspectionApiError,
  inspectionErrorMessage,
} from "@/services/inspection-service";
import { pollInspection } from "@/services/poll-inspection";
import { Action, Button, DemoLabel } from "@/components/ui/primitives";
export default function Analyzing() {
  const {
    inspectionId,
    sessionReady,
    uploadComplete,
    keyFrameCount,
    mode,
    sessionVehicle: vehicle,
    createdAt,
    processingProgress: progress,
    setProcessingProgress,
    processingStage: stage,
    setProcessingStage,
    apiError: error,
    setApiError,
    setResult,
    setStatus,
  } = useInspection();
  const { id: vehicleId, model: vehicleModel, plate: vehiclePlate } = vehicle;
  const [retry, setRetry] = useState(0);
  const router = useRouter();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!sessionReady || !inspectionId || !uploadComplete) return;
    const controller = new AbortController();
    // Upload preparation already starts analysis. Refresh and retry only read
    // the existing inspection; never replay the complete POST after remount.
    void pollInspection(
      inspectionService,
      inspectionId,
      (status) => {
        setStatus(status.status);
        setProcessingProgress(status.progress);
        if (status.stage) setProcessingStage(status.stage);
      },
      {
        signal: controller.signal,
        intervalMs: mode === "MOCK" ? 200 : 1000,
        timeoutMs: 60_000,
        vehicle: {
          id: vehicleId,
          model: vehicleModel,
          plate: vehiclePlate,
        },
        createdAt,
      },
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setResult(result);
        setStatus("completed");
        setProcessingStage("completed");
        setProcessingProgress(100);
        router.replace(
          result.detectionStatus === "potential_damage" ? "/damage" : "/result",
        );
      })
      .catch((error) => {
        if (
          controller.signal.aborted ||
          (error instanceof InspectionApiError && error.code === "ABORTED")
        )
          return;
        // A waiting timeout is recoverable; preserve the backend session and its state.
        setApiError(inspectionErrorMessage(error));
        if (!(error instanceof InspectionApiError && error.code === "TIMEOUT"))
          setStatus("failed");
      });
    return () => controller.abort();
  }, [
    sessionReady,
    inspectionId,
    uploadComplete,
    retry,
    mode,
    vehicleId,
    vehicleModel,
    vehiclePlate,
    createdAt,
    router,
    setResult,
    setStatus,
    setProcessingProgress,
    setProcessingStage,
    setApiError,
  ]);
  if (!sessionReady)
    return (
      <div className="page">
        <p role="status">正在恢復檢查資料…</p>
      </div>
    );
  if (!inspectionId || !uploadComplete)
    return (
      <div className="page">
        <h1>尚未完成影格上傳</h1>
        <p className="lead">
          請返回掃描頁完成影格上傳。重新整理前尚未上傳的影像不會永久保存。
        </p>
        <Action href="/scan">前往掃描</Action>
      </div>
    );
  return (
    <div className="page analyzing">
      <motion.div
        className="analysis-orb"
        animate={reduced ? {} : { scale: [1, 1.04, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ScanLine size={44} />
        <span>{Math.round(progress)}%</span>
      </motion.div>
      <h1>AI 車況分析中</h1>
      <p className="lead">正在比對本次掃描與租車前車況</p>
      {mode === "MOCK" && <DemoLabel />}
      <div
        className="analysis-progress-bar"
        role="progressbar"
        aria-label="AI 分析進度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div className="progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <AnalysisProgress stage={stage} failed={Boolean(error)} />
      <div className="analysis-stats">
        <div>
          <strong>{keyFrameCount}</strong>
          <span>張關鍵影格</span>
        </div>
        <div>
          <strong>{mode === "MOCK" ? mockConfig.vehiclePartCount : "—"}</strong>
          <span>個車體區域</span>
        </div>
      </div>
      <p className="remaining" role="status">
        {error ? "檢查紀錄已保留，可重新取得結果" : "正在等待分析服務回應"}
      </p>
      {error && (
        <>
          <p role="alert">{error}</p>
          <Button
            onClick={() => {
              setApiError("");
              setRetry((value) => value + 1);
            }}
          >
            重新取得結果
          </Button>
        </>
      )}
    </div>
  );
}
