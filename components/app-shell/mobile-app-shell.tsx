"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ApiDebugPanel } from "@/components/dev/ApiDebugPanel";
import { AppHeader } from "./app-header";
export function MobileAppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const camera = path === "/scan";
  const animate = path !== "/return" && path !== "/" && !camera;
  return (
    <div
      className={`app-shell ${path === "/dashboard" ? "wide" : ""} ${camera ? "camera-shell" : ""}`}
    >
      <AppHeader path={path} />
      <main key={path} className={animate ? "page-fade" : ""}>
        {children}
      </main>
      {process.env.NODE_ENV === "development" && <ApiDebugPanel />}
      {!camera && (
        <footer>
          AI Vehicle Inspection <span>2026 Hackathon · Frontend Demo</span>
        </footer>
      )}
    </div>
  );
}
