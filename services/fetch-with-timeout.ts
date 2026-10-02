import { REQUEST_TIMEOUT_MS } from "../lib/api-config";
import { InspectionApiError } from "./inspection-errors";
function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new InspectionApiError("ABORTED"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}
/** Includes response-body reading in the timeout. Only GET may retry; POST is never replayed. */
export async function fetchWithTimeout<T>(
  input: string,
  init: RequestInit,
  options: {
    readResponse: (response: Response) => Promise<T>;
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
    fetcher?: typeof fetch;
  },
) {
  const retries =
    (init.method ?? "GET").toUpperCase() === "GET"
      ? Math.min(2, Math.max(0, options.retries ?? 2))
      : 0;
  const external = init.signal ?? undefined;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    external?.addEventListener("abort", abort, { once: true });
    if (external?.aborted) controller.abort();
    const timer = setTimeout(abort, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
    let failure: InspectionApiError;
    try {
      if (external?.aborted) throw new InspectionApiError("ABORTED");
      const response = await (options.fetcher ?? fetch)(input, {
        ...init,
        signal: controller.signal,
        cache: "no-store",
      });
      const result = await options.readResponse(response);
      if (controller.signal.aborted)
        throw new InspectionApiError(external?.aborted ? "ABORTED" : "TIMEOUT");
      return result;
    } catch (error) {
      failure = external?.aborted
        ? new InspectionApiError("ABORTED")
        : controller.signal.aborted
          ? new InspectionApiError("TIMEOUT")
          : error instanceof InspectionApiError
            ? error
            : new InspectionApiError("NETWORK_ERROR");
    } finally {
      clearTimeout(timer);
      external?.removeEventListener("abort", abort);
    }
    const transient =
      failure.httpStatus !== undefined
        ? [408, 429].includes(failure.httpStatus) || failure.httpStatus >= 500
        : ["NETWORK_ERROR", "TIMEOUT"].includes(failure.code);
    if (!transient || attempt >= retries || failure.code === "ABORTED")
      throw failure;
    await wait((options.retryDelayMs ?? 250) * 2 ** attempt, external);
  }
}
