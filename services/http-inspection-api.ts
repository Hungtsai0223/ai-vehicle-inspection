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
export class HttpInspectionApi implements InspectionApi {
  private readonly metadata = new Map<
    string,
    { vehicle: Vehicle; createdAt: string }
  >();
  constructor(
    private readonly baseUrl = process.env.NEXT_PUBLIC_AI_API_URL ??
      "http://localhost:8000",
    private readonly timeoutMs = 15_000,
    private readonly fetcher: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {}
  private url(path: string) {
    const url = new URL(
      this.baseUrl,
      typeof window === "undefined"
        ? "http://localhost"
        : window.location.origin,
    );
    url.pathname = url.pathname.replace(/\/$/, "") + path;
    if (
      process.env.NODE_ENV === "development" &&
      url.pathname.startsWith("/api/dev/") &&
      !url.searchParams.has("result")
    )
      url.searchParams.set(
        "result",
        process.env.NEXT_PUBLIC_DEV_AI_RESULT ?? "potential_damage",
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
    const controller = new AbortController();
    const externalSignal = init.signal;
    const abort = () => controller.abort();
    externalSignal?.addEventListener("abort", abort, { once: true });
    if (externalSignal?.aborted) controller.abort();
    const timeout = setTimeout(abort, this.timeoutMs);
    try {
      const response = await this.fetcher(this.url(path), {
        ...init,
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        // Never read/echo backend error bodies, which may contain private/internal details.
        throw new InspectionApiError(
          response.status === 503 ? "NETWORK_ERROR" : failure,
          { path, status: response.status },
        );
      }
      try {
        return await response.json();
      } catch (error) {
        if (controller.signal.aborted)
          throw new InspectionApiError(
            externalSignal?.aborted ? "ABORTED" : "TIMEOUT",
          );
        throw new InspectionApiError("INVALID_RESPONSE", error);
      }
    } catch (error) {
      if (error instanceof InspectionApiError) throw error;
      throw new InspectionApiError(
        externalSignal?.aborted
          ? "ABORTED"
          : controller.signal.aborted
            ? "TIMEOUT"
            : "NETWORK_ERROR",
        error,
      );
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abort);
    }
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
  async uploadInspectionFrames(id: string, frames: CapturedFrame[]) {
    if (
      !frames.length ||
      frames.some(
        (f) =>
          !f.blob?.size ||
          !["image/jpeg", "image/png"].includes(f.blob.type) ||
          !Number.isFinite(f.timestamp) ||
          f.timestamp < 0,
      )
    ) {
      throw new InspectionApiError(
        "UPLOAD_FAILED",
        "Real image bytes are required; mock metadata cannot be sent to an AI backend",
      );
    }
    const body = new FormData();
    for (const frame of frames) {
      body.append(
        "frames",
        frame.blob!,
        `${frame.id}.${frame.blob!.type === "image/png" ? "png" : "jpg"}`,
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
        { method: "POST", body },
        "UPLOAD_FAILED",
      ),
      frames.length,
    );
  }
  async completeInspection(id: string) {
    const result = parseSession(
      await this.request(this.path(id, "/complete"), { method: "POST" }),
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
