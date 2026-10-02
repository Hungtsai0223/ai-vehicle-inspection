"use client";
import { Button } from "@/components/ui/primitives";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="page">
      <h1>暫時無法載入</h1>
      <p className="lead">請重新嘗試。</p>
      <Button onClick={reset}>重新載入</Button>
    </div>
  );
}
