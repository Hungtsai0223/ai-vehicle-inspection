import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { ArrowRight } from "lucide-react";
export function Button({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`button ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Action({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={`button ${secondary ? "secondary" : ""}`} href={href}>
      {children}
      <ArrowRight size={18} />
    </Link>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function Disclaimer() {
  return (
    <p className="disclaimer">
      AI 辨識結果僅供車況篩選與後續人工確認使用，不直接作為責任判定依據。
    </p>
  );
}
export function DemoLabel() {
  return <span className="demo-label">MOCK DATA · 模擬資料</span>;
}
