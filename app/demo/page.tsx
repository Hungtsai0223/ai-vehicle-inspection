"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInspection } from "@/components/inspection/inspection-context";
import { DemoReset } from "@/components/inspection/demo-reset";
import { Action, Button, DemoLabel } from "@/components/ui/primitives";
import {
  demoScenarios,
  getDemoScenario,
  type DemoResultScenario,
} from "@/lib/demo-config";
export default function DemoLauncher() {
  const ctx = useInspection();
  const router = useRouter();
  const started = useRef(false);
  const [busy, setBusy] = useState("");
  function launch(
    label: string,
    path: string,
    scenario?: DemoResultScenario | "backend_error",
  ) {
    if (started.current || !ctx.sessionReady) return;
    started.current = true;
    setBusy(label);
    if (scenario && scenario !== "backend_error") ctx.showDemoResult(scenario);
    else {
      ctx.resetInspection();
      ctx.setScenario(scenario ?? getDemoScenario());
    }
    router.push(path);
  }
  return (
    <div className="page demo-launcher">
      <p className="page-step">Hackathon Demo</p>
      <h1>AI 車況檢查展示</h1>
      <p className="lead">從完整流程開始，或直接查看展示結果。</p>
      <DemoLabel />
      <p className="notice">
        結果捷徑使用模擬資料，不呼叫 AI 模型；完整流程保留相機、影格與分析步驟。
      </p>
      <div className="demo-launch-actions" aria-busy={Boolean(busy)}>
        <Button
          disabled={Boolean(busy) || !ctx.sessionReady}
          onClick={() => launch("完整使用者流程", "/return")}
        >
          完整使用者流程
        </Button>
        <Button
          className="secondary"
          disabled={Boolean(busy) || !ctx.sessionReady}
          onClick={() => launch("直接測試掃描", "/scan")}
        >
          直接測試掃描
        </Button>
        {demoScenarios.map(({ value, label }) => (
          <Button
            className="secondary"
            key={value}
            disabled={
              Boolean(busy) ||
              !ctx.sessionReady ||
              !ctx.demoResultsAvailable ||
              (value === "backend_error" && ctx.mode !== "MOCK")
            }
            onClick={() =>
              launch(
                label,
                value === "backend_error"
                  ? "/return"
                  : value === "no_damage" || value === "unknown_area"
                    ? "/result"
                    : "/damage",
                value,
              )
            }
          >
            {label}
          </Button>
        ))}
        <Action href="/dashboard" secondary>
          AI Dashboard
        </Action>
        {process.env.NODE_ENV === "development" ? (
          <Action href="/dev/integration" secondary>
            Integration Debug
          </Action>
        ) : (
          <Button className="secondary" disabled>
            Integration Debug · 正式版未提供
          </Button>
        )}
      </div>
      {busy && <p role="status">正在開啟{busy}…</p>}
      {!ctx.demoResultsAvailable && (
        <p className="notice">此環境未啟用模擬結果捷徑。</p>
      )}
      <DemoReset />
    </div>
  );
}
