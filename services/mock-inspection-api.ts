import { createUniqueId } from "../lib/unique-id";
import { mockConfig, resultFor } from "../lib/mock-data";
import type { CapturedFrame } from "../types/frame";
import type { InspectionProgress } from "../types/inspection";
import type {
  ApiRequestOptions,
  CreateInspectionInput,
  InspectionApi,
} from "./inspection-api";
import { InspectionApiError } from "./inspection-errors";
const wait = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new InspectionApiError("ABORTED"));
      return;
    }
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new InspectionApiError("ABORTED"));
    };
    const timer = setTimeout(finish, milliseconds);
    signal?.addEventListener("abort", abort, { once: true });
  });
export class MockInspectionApi implements InspectionApi {
  private readonly sessions = new Map<
    string,
    CreateInspectionInput & {
      createdAt: string;
      frameCount: number;
      processingStarted?: number;
    }
  >();
  constructor(
    private readonly timings = {
      create: 300,
      upload: 500,
      request: 120,
      processing: mockConfig.analysisDurationMs,
    },
  ) {}
  forgetSession(id: string) {
    this.sessions.delete(id);
  }
  restoreSession(
    id: string,
    input: CreateInspectionInput,
    frameCount: number,
    completed: boolean,
  ) {
    if (this.sessions.has(id)) return;
    this.sessions.set(id, {
      ...input,
      createdAt: new Date().toISOString(),
      frameCount,
      processingStarted: Date.now() - (completed ? this.timings.processing : 0),
    });
  }
  private session(id: string) {
    const session = this.sessions.get(id);
    if (!session)
      throw new InspectionApiError(
        "PROCESSING_FAILED",
        "Mock session not found",
      );
    return session;
  }
  async createInspection(
    input: CreateInspectionInput,
    options: ApiRequestOptions = {},
  ) {
    await wait(this.timings.create, options.signal);
    const inspectionId = createUniqueId("demo");
    this.sessions.set(inspectionId, {
      ...input,
      createdAt: new Date().toISOString(),
      frameCount: 0,
    });
    return { inspectionId, status: "scanning" as const };
  }
  async uploadInspectionFrames(
    id: string,
    frames: CapturedFrame[],
    options: ApiRequestOptions = {},
  ) {
    await wait(this.timings.upload, options.signal);
    if (!frames.length) throw new InspectionApiError("UPLOAD_FAILED");
    this.session(id).frameCount = frames.length;
    return { accepted: frames.length };
  }
  async completeInspection(id: string, options: ApiRequestOptions = {}) {
    await wait(this.timings.request, options.signal);
    const session = this.session(id);
    if (!session.frameCount) throw new InspectionApiError("UPLOAD_FAILED");
    session.processingStarted ??= Date.now();
    return { inspectionId: id, status: "processing" as const };
  }
  async getInspectionStatus(
    id: string,
    options: ApiRequestOptions = {},
  ): Promise<InspectionProgress> {
    await wait(this.timings.request, options.signal);
    const session = this.session(id);
    if (
      session.scenario === "backend_error" &&
      session.processingStarted !== undefined
    )
      throw new InspectionApiError("PROCESSING_FAILED", "Demo backend failure");
    const progress =
      session.processingStarted === undefined
        ? 0
        : Math.min(
            100,
            ((Date.now() - session.processingStarted) /
              Math.max(1, this.timings.processing)) *
              100,
          );
    return {
      inspectionId: id,
      stage:
        progress >= 100
          ? "completed"
          : progress < 25
            ? "image_validation"
            : progress < 50
              ? "vehicle_part_detection"
              : progress < 75
                ? "damage_detection"
                : "before_after_comparison",
      progress,
      status:
        session.processingStarted === undefined
          ? "scanning"
          : progress < 100
            ? "processing"
            : "completed",
    };
  }
  async getInspectionResult(id: string, options: ApiRequestOptions = {}) {
    const status = await this.getInspectionStatus(id, options);
    if (status.status !== "completed")
      throw new InspectionApiError(
        "PROCESSING_FAILED",
        "Mock processing is not complete",
      );
    const session = this.session(id);
    return {
      ...resultFor(session.scenario ?? mockConfig.defaultScenario, id),
      vehicle: session.vehicle,
      createdAt: session.createdAt,
      keyFrameCount: session.frameCount,
    };
  }
}
