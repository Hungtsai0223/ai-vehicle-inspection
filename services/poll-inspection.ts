import type { ApiRequestOptions, InspectionApi } from "./inspection-api";
import type { InspectionProgress } from "../types/inspection";
import { InspectionApiError } from "./inspection-errors";
export async function pollInspection(
  api: Pick<InspectionApi, "getInspectionStatus" | "getInspectionResult">,
  id: string,
  onProgress: (progress: InspectionProgress) => void,
  options: ApiRequestOptions & { intervalMs?: number; timeoutMs?: number } = {},
) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    abort();
  }, options.timeoutMs ?? 60_000);
  const check = () => {
    if (controller.signal.aborted)
      throw new InspectionApiError(timedOut ? "TIMEOUT" : "ABORTED");
  };
  const requestOptions = { ...options, signal: controller.signal };
  try {
    while (true) {
      check();
      const status = await api.getInspectionStatus(id, requestOptions);
      check();
      onProgress(status);
      if (status.status === "failed")
        throw new InspectionApiError("PROCESSING_FAILED");
      if (status.status === "completed") {
        const result = await api.getInspectionResult(id, requestOptions);
        check();
        return result;
      }
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(waitTimer);
          controller.signal.removeEventListener("abort", finish);
          resolve();
        };
        const waitTimer = setTimeout(finish, options.intervalMs ?? 1000);
        controller.signal.addEventListener("abort", finish, { once: true });
        if (controller.signal.aborted) finish();
      });
    }
  } catch (error) {
    check();
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
