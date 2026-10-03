"use client";
import { Action, Button } from "@/components/ui/primitives";
export default function Error() {
  return (
    <div className="page">
      <h1>系統暫時發生問題</h1>
      <p className="lead">請重新整理，或返回展示入口再試一次。</p>
      <Button onClick={() => window.location.reload()}>重新整理</Button>
      <Action href="/demo" secondary>
        返回 Demo 首頁
      </Action>
    </div>
  );
}
