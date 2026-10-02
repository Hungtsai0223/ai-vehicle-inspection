import { handleStubHealth } from "@/lib/dev-http-stub";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function GET(request: Request) {
  return handleStubHealth(request);
}
