export const API_CONTRACT_VERSION = "1.0";
export const REQUEST_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 30_000;
export const STATUS_TIMEOUT_MS = 10_000;
export const getApiBaseUrl = () =>
  process.env.NEXT_PUBLIC_AI_API_URL ?? "/api/dev";
export function resolveApiUrl(baseUrl: string, path: string) {
  const url = new URL(
    baseUrl,
    typeof window === "undefined" ? "http://localhost" : window.location.origin,
  );
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("Invalid API URL");
  url.pathname = url.pathname.replace(/\/$/, "") + path;
  return url;
}
