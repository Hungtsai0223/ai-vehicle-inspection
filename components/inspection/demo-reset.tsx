"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInspection } from "./inspection-context";
import { Button } from "@/components/ui/primitives";
export function DemoReset() {
  const { resetInspection, demoResultsAvailable } = useInspection();
  const router = useRouter();
  const started = useRef(false);
  const [busy, setBusy] = useState(false);
  if (!demoResultsAvailable) return null;
  return (
    <Button
      className="secondary"
      disabled={busy}
      onClick={() => {
        if (started.current) return;
        started.current = true;
        setBusy(true);
        resetInspection();
        router.replace("/return");
      }}
    >
      {busy ? "正在重新開始…" : "重新開始 Demo"}
    </Button>
  );
}
