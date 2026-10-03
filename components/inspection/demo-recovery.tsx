"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInspection } from "./inspection-context";
import { Button } from "@/components/ui/primitives";

export function DemoRecovery() {
  const { showDemoResult, demoResultsAvailable, sessionReady } =
    useInspection();
  const router = useRouter();
  const started = useRef(false);
  const [busy, setBusy] = useState(false);
  if (!demoResultsAvailable) return null;
  return (
    <div className="demo-recovery">
      <p>展示備援會改用明確標示的模擬結果，不代表本次影像已完成 AI 分析。</p>
      <Button
        className="secondary"
        disabled={!sessionReady || busy}
        onClick={() => {
          if (started.current) return;
          started.current = true;
          setBusy(true);
          if (showDemoResult()) router.replace("/result");
        }}
      >
        {busy ? "正在準備 Demo 結果…" : "使用 Demo 結果繼續"}
      </Button>
    </div>
  );
}
