import Link from "next/link";
import { ArrowLeft, ScanLine, LayoutDashboard, X } from "lucide-react";
export function AppHeader({ path }: { path: string }) {
  if (path === "/scan")
    return (
      <header className="topnav camera-topnav">
        <Link href="/scan-guide" aria-label="關閉掃描並返回指引">
          <X size={22} />
        </Link>
        <h1>
          <span>AI</span> 車況掃描
        </h1>
        <span className="nav-spacer" aria-hidden="true" />
      </header>
    );
  return (
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
  );
}
