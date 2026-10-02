"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ScanLine } from "lucide-react";
import { AnalysisProgress } from "@/components/inspection/analysis-progress";
import { useInspection } from "@/components/inspection/inspection-context";
import { inspectionApi } from "@/lib/api";
import { Action, Button, DemoLabel } from "@/components/ui/primitives";
export default function Analyzing() {
  const { inspectionId, setResult, setStatus } = useInspection();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const router = useRouter();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!inspectionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const status = await inspectionApi.getInspectionStatus(inspectionId);
        if (cancelled) return;
        setProgress(status.progress);
        if (status.progress >= 100) {
          const result = await inspectionApi.getInspectionResult(inspectionId);
          if (cancelled) return;
          setResult(result);
          setStatus(result.damages.length ? "potential_damage" : "complete");
          router.replace(result.damages.length ? "/damage" : "/result");
        } else timer = setTimeout(poll, 200);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "分析失敗");
      }
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inspectionId, retry, router, setResult, setStatus]);
  if (!inspectionId)
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
      <p className="lead">正在比對車輛外觀，請稍候</p>
      <DemoLabel />
      <AnalysisProgress progress={progress} />
      <div className="analysis-stats">
        <div>
          <strong>18</strong>
          <span>張關鍵影格候選</span>
        </div>
        <div>
          <strong>12</strong>
          <span>個車體區域</span>
        </div>
      </div>
      <p className="remaining" role="status">
        約剩 {Math.max(0, Math.ceil((100 - progress) / 25))} 秒
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
