"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ScanLine } from "lucide-react";
import { AnalysisProgress } from "@/components/inspection/analysis-progress";
import { useInspection } from "@/components/inspection/inspection-context";
import { selectKeyFrames } from "@/lib/frame-selection";
import { mockConfig } from "@/lib/mock-data";
import {
  inspectionService,
  InspectionApiError,
  inspectionErrorMessage,
} from "@/services/inspection-service";
import { Action, Button, DemoLabel } from "@/components/ui/primitives";
export default function Analyzing() {
  const { inspectionId, frames, mode, setResult, setStatus } = useInspection();
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<"uploading" | "processing" | "completed">(
    "uploading",
  );
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const router = useRouter();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!inspectionId || !frames.length) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 120_000;
    async function poll() {
      try {
        const status =
          await inspectionService.getInspectionStatus(inspectionId);
        if (cancelled) return;
        setStatus(status.status);
        setProgress(20 + status.progress * 0.8);
        if (status.status === "failed")
          throw new InspectionApiError("PROCESSING_FAILED");
        if (status.status === "completed") {
          const result =
            await inspectionService.getInspectionResult(inspectionId);
          if (cancelled) return;
          setResult(result);
          setStatus("completed");
          setStage("completed");
          setProgress(100);
          router.replace(
            result.detectionStatus === "potential_damage"
              ? "/damage"
              : "/result",
          );
        } else {
          if (Date.now() > deadline) throw new InspectionApiError("TIMEOUT");
          timer = setTimeout(poll, mode === "MOCK" ? 200 : 1000);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("failed");
          setError(inspectionErrorMessage(error));
        }
      }
    }
    async function prepare() {
      try {
        setStage("uploading");
        setStatus("uploading");
        setProgress(5);
        await inspectionService.uploadInspectionFrames(inspectionId, frames);
        if (cancelled) return;
        setProgress(15);
        await inspectionService.completeInspection(inspectionId);
        if (cancelled) return;
        setStatus("processing");
        setStage("processing");
        await poll();
      } catch (error) {
        if (!cancelled) {
          setStatus("failed");
          setError(inspectionErrorMessage(error));
        }
      }
    }
    void prepare();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inspectionId, frames, mode, retry, router, setResult, setStatus]);
  if (!inspectionId || !frames.length)
    return (
      <div className="page">
        <h1>尚未開始檢查</h1>
        <p className="lead">請先完成車輛掃描。</p>
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
      <AnalysisProgress
        progress={progress}
        stage={stage}
        failed={Boolean(error)}
      />
      <div className="analysis-stats">
        <div>
          <strong>{selectKeyFrames(frames).length}</strong>
          <span>張關鍵影格</span>
        </div>
        <div>
          <strong>{mode === "MOCK" ? mockConfig.vehiclePartCount : "—"}</strong>
          <span>個車體區域</span>
        </div>
      </div>
      <p className="remaining" role="status">
        {error
          ? "掃描資料已保留，可重試分析"
          : mode === "MOCK"
            ? `約剩 ${Math.max(0, Math.ceil((100 - progress) / 25))} 秒`
            : "正在等待分析服務回應"}
      </p>
      {error && (
        <>
          <p role="alert">{error}</p>
          <Button
            onClick={() => {
              setError("");
              setRetry(retry + 1);
            }}
          >
            重試分析
          </Button>
        </>
      )}
    </div>
  );
}
