import { handleStubRequest } from "@/lib/dev-http-stub";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  request: Request,
  context: { params: Promise<{ segments?: string[] }> },
) {
  if (process.env.NODE_ENV !== "development")
    return Response.json({ error: "Not found" }, { status: 404 });
  try {
    return await handleStubRequest(
      request,
      (await context.params).segments ?? [],
    );
  } catch {
    return Response.json(
      { error: "Invalid development request" },
      { status: 400 },
    );
  }
}
export { handle as GET, handle as POST };
