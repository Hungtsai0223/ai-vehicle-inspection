import { notFound } from "next/navigation";
import { IntegrationPanel } from "@/components/dev/integration-panel";
export const dynamic = "force-dynamic";
export default function IntegrationPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <IntegrationPanel />;
}
