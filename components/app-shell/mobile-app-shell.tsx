"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ScanLine, LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";
export function MobileAppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const wide = path === "/dashboard";
  return (
    <div className={`app-shell ${wide ? "wide" : ""}`}>
      <header className="topnav">
        <Link href={path === "/" ? "/" : "/return"} aria-label="返回還車頁">
          <ArrowLeft size={20} />
        </Link>
        <Link href="/" className="brand">
          <ScanLine size={22} />
          <span>
            AI <b>Vehicle Inspection</b>
          </span>
        </Link>
        <Link href="/dashboard" aria-label="查看儀表板">
          <LayoutDashboard size={20} />
        </Link>
      </header>
      <main>{children}</main>
      <footer>
        AI Vehicle Inspection <span>2026 Hackathon · Frontend Demo</span>
      </footer>
    </div>
  );
}
