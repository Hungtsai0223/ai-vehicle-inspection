import type { CapturedFrame } from "../types/frame";
import type { Vehicle } from "../types/inspection";
import type { CreateInspectionInput, InspectionApi } from "./inspection-api";
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
const viewAngles = { front: 0, left: 90, rear: 180, right: 270 };
export class HttpInspectionApi implements InspectionApi {
  private readonly metadata = new Map<
    string,
    { vehicle: Vehicle; createdAt: string }
  >();
  constructor(
    private readonly baseUrl = process.env.NEXT_PUBLIC_AI_API_URL ??
      "http://localhost:8000",
    private readonly timeoutMs = 15_000,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  private path(id: string, suffix = "") {
    return `/api/v1/inspections/${encodeURIComponent(id)}${suffix}`;
  }
  private async request(
    path: string,
    init: RequestInit = {},
    failure: InspectionApiErrorCode = "PROCESSING_FAILED",
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(
        `${this.baseUrl.replace(/\/$/, "")}${path}`,
        { ...init, signal: controller.signal, cache: "no-store" },
      );
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
        if (controller.signal.aborted) throw new InspectionApiError("TIMEOUT");
        throw new InspectionApiError("INVALID_RESPONSE", error);
      }
    } catch (error) {
      if (error instanceof InspectionApiError) throw error;
      throw new InspectionApiError(
        controller.signal.aborted ? "TIMEOUT" : "NETWORK_ERROR",
        error,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  async createInspection({ vehicle }: CreateInspectionInput) {
    const result = parseSession(
      await this.request(
        "/api/v1/inspections",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vehicle }),
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
    const allViewsKnown = frames.every(
      (frame) => frame.vehicleView !== "unknown",
    );
    for (const frame of frames) {
      body.append(
        "frames[]",
        frame.blob!,
        `${frame.id}.${frame.blob!.type === "image/png" ? "png" : "jpg"}`,
      );
      body.append("timestamps[]", String(frame.timestamp / 1000));
      if (allViewsKnown && frame.vehicleView !== "unknown")
        body.append("viewAngles[]", String(viewAngles[frame.vehicleView]));
    }
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
  async getInspectionStatus(id: string) {
    return parseProgress(await this.request(this.path(id)), id);
  }
  async getInspectionResult(id: string) {
    return parseResult(
      await this.request(this.path(id, "/result")),
      id,
      this.metadata.get(id),
    );
  }
}
