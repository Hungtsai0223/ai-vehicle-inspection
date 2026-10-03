import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MobileAppShell } from "@/components/app-shell/mobile-app-shell";
import { InspectionProvider } from "@/components/inspection/inspection-context";
export const metadata: Metadata = {
  title: "AI Vehicle Inspection | 智慧車況檢查",
  description: "共享汽車智慧車況檢測 · 2026 Hackathon frontend demo",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>
        <InspectionProvider>
          <MobileAppShell>{children}</MobileAppShell>
        </InspectionProvider>
      </body>
    </html>
  );
}
