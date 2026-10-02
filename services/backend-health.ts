import {
  getApiBaseUrl,
  resolveApiUrl,
  STATUS_TIMEOUT_MS,
} from "../lib/api-config";
import { fetchWithTimeout } from "./fetch-with-timeout";
import { InspectionApiError } from "./inspection-errors";
export type BackendHealth = "reachable" | "unreachable" | "unknown";
/** A health read never creates an inspection. Missing/malformed health contract is unknown. */
export async function checkBackendHealth(
  baseUrl = getApiBaseUrl(),
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    fetcher?: typeof fetch;
  } = {},
): Promise<BackendHealth> {
  try {
    return await fetchWithTimeout(
      resolveApiUrl(baseUrl, "/health").href,
      { signal: options.signal },
      {
        timeoutMs: options.timeoutMs ?? STATUS_TIMEOUT_MS,
        fetcher: options.fetcher,
        readResponse: async (response) => {
          if (response.status === 404) return "unknown";
          if (!response.ok)
            throw new InspectionApiError(
              "NETWORK_ERROR",
              undefined,
              response.status,
            );
          const body = await response.json().catch(() => null);
          return body?.status === "ok" ? "reachable" : "unknown";
        },
      },
    );
  } catch (error) {
    return error instanceof InspectionApiError && error.code === "ABORTED"
      ? "unknown"
      : "unreachable";
  }
}
