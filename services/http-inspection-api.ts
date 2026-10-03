import type { CapturedFrame } from "../types/frame";
import type { Vehicle } from "../types/inspection";
import type {
  ApiRequestOptions,
  CreateInspectionInput,
  InspectionApi,
} from "./inspection-api";
import {
  InspectionApiError,
  type InspectionApiErrorCode,
} from "./inspection-errors";
import {
  parseProgress,
  parseResult,
  parseSession,
  parseUpload,
} from "./inspection-response";
import {
  getApiBaseUrl,
  resolveApiUrl,
  REQUEST_TIMEOUT_MS,
  UPLOAD_TIMEOUT_MS,
  STATUS_TIMEOUT_MS,
} from "../lib/api-config";
import { fetchWithTimeout } from "./fetch-with-timeout";
import { validateUploadFrames } from "../lib/frame-upload-validation";
import { demoStubResult } from "../lib/demo-config";
export class HttpInspectionApi implements InspectionApi {
  private readonly metadata = new Map<
    string,
    { vehicle: Vehicle; createdAt: string }
  >();
  constructor(
    private readonly baseUrl = getApiBaseUrl(),
    private readonly timeoutMs = REQUEST_TIMEOUT_MS,
    private readonly fetcher: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {}
  private url(path: string) {
    const url = resolveApiUrl(this.baseUrl, path);
    if (
      process.env.NODE_ENV === "development" &&
      url.pathname.startsWith("/api/dev/") &&
      !url.searchParams.has("result")
    )
      url.searchParams.set(
        "result",
        process.env.NEXT_PUBLIC_DEV_AI_RESULT ?? demoStubResult(),
      );
    return url.href;
  }
  private path(id: string, suffix = "") {
    return `/api/v1/inspections/${encodeURIComponent(id)}${suffix}`;
  }
  private async request(
    path: string,
    init: RequestInit = {},
    failure: InspectionApiErrorCode = "PROCESSING_FAILED",
  ): Promise<unknown> {
    return fetchWithTimeout(this.url(path), init, {
      timeoutMs: path.endsWith("/frames")
        ? this.timeoutMs === REQUEST_TIMEOUT_MS
          ? UPLOAD_TIMEOUT_MS
          : this.timeoutMs
        : init.method === "POST"
          ? this.timeoutMs
          : Math.min(this.timeoutMs, STATUS_TIMEOUT_MS),
      fetcher: this.fetcher,
      readResponse: async (response) => {
        if (!response.ok)
          throw new InspectionApiError(
            response.status === 503 ? "NETWORK_ERROR" : failure,
            { path, status: response.status },
            response.status,
          );
        try {
          return await response.json();
        } catch {
          throw new InspectionApiError("INVALID_RESPONSE");
        }
      },
    });
  }
  async createInspection(
    { vehicle }: CreateInspectionInput,
    options: ApiRequestOptions = {},
  ) {
    const result = parseSession(
      await this.request(
        "/api/v1/inspections",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicleId: vehicle.id,
            vehicleModel: vehicle.model,
            plate: vehicle.plate,
          }),
          signal: options.signal,
        },
        "NETWORK_ERROR",
      ),
    );
    if (result.status !== "scanning")
      throw new InspectionApiError("INVALID_RESPONSE");
    this.metadata.set(result.inspectionId, {
      vehicle,
      createdAt: new Date().toISOString(),
    });
    return result;
  }
  async uploadInspectionFrames(
    id: string,
    frames: CapturedFrame[],
    options: ApiRequestOptions = {},
  ) {
    validateUploadFrames(frames);
    const body = new FormData();
    for (const frame of frames) {
      body.append(
        "frames",
        frame.blob!,
        `${frame.id}.${frame.blob!.type === "image/png" ? "png" : frame.blob!.type === "image/webp" ? "webp" : "jpg"}`,
      );
    }
    body.append(
      "metadata",
      JSON.stringify({
        frames: frames.map((frame) => ({
          id: frame.id,
          timestamp: frame.timestamp,
          vehicleView: frame.vehicleView,
          quality: frame.quality,
        })),
      }),
    );
    // Browser sets multipart boundary; do not set Content-Type manually.
    return parseUpload(
      await this.request(
        this.path(id, "/frames"),
        { method: "POST", body, signal: options.signal },
        "UPLOAD_FAILED",
      ),
      frames.length,
    );
  }
  async completeInspection(id: string, options: ApiRequestOptions = {}) {
    const result = parseSession(
      await this.request(this.path(id, "/complete"), {
        method: "POST",
        signal: options.signal,
      }),
      id,
    );
    if (!["processing", "completed"].includes(result.status))
      throw new InspectionApiError("INVALID_RESPONSE");
    return result;
  }
  async getInspectionStatus(id: string, options: ApiRequestOptions = {}) {
    return parseProgress(
      await this.request(this.path(id), { signal: options.signal }),
      id,
    );
  }
  async getInspectionResult(id: string, options: ApiRequestOptions = {}) {
    const result = parseResult(
      await this.request(this.path(id, "/result"), { signal: options.signal }),
      id,
      this.metadata.get(id) ??
        (options.vehicle
          ? {
              vehicle: options.vehicle,
              createdAt: options.createdAt ?? new Date().toISOString(),
            }
          : undefined),
    );
    // Root-relative backend image URLs belong to the API origin, not the frontend origin.
    const base = new URL(
      this.baseUrl,
      typeof window === "undefined"
        ? "http://localhost"
        : window.location.origin,
    );
    return {
      ...result,
      damages: result.damages.map((damage) => ({
        ...damage,
        beforeImageUrl: damage.beforeImageUrl
          ? new URL(damage.beforeImageUrl, base).href
          : undefined,
        afterImageUrl: damage.afterImageUrl
          ? new URL(damage.afterImageUrl, base).href
          : undefined,
        maskImageUrl: damage.maskImageUrl
          ? new URL(damage.maskImageUrl, base).href
          : undefined,
      })),
    };
  }
}
