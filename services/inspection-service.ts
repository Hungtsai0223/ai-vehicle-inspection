import { selectKeyFrames } from "../lib/frame-selection";
import { mockVehicle } from "../lib/mock-data";
import type { CapturedFrame } from "../types/frame";
import type {
  ApiRequestOptions,
  CreateInspectionInput,
  InspectionApi,
  InspectionSession,
  UploadReceipt,
} from "./inspection-api";
import { HttpInspectionApi } from "./http-inspection-api";
import { MockInspectionApi } from "./mock-inspection-api";
export {
  InspectionApiError,
  inspectionErrorMessage,
} from "./inspection-errors";
export type InspectionMode = "MOCK" | "API";
export function createInspectionService(
  api: InspectionApi,
  mode: InspectionMode,
) {
  // Share in-flight/successful mutations across Strict Mode mounts and retry.
  // Failed calls are evicted so retries can reuse the retained frame buffer.
  const uploads = new Map<string, Promise<UploadReceipt>>();
  const completions = new Map<string, Promise<InspectionSession>>();
  function once<T>(
    cache: Map<string, Promise<T>>,
    id: string,
    action: () => Promise<T>,
  ) {
    const existing = cache.get(id);
    if (existing) return existing;
    const operation = action().catch((error) => {
      cache.delete(id);
      throw error;
    });
    cache.set(id, operation);
    return operation;
  }
  return {
    mode,
    createInspection: (
      input: CreateInspectionInput = { vehicle: mockVehicle },
      options?: ApiRequestOptions,
    ) => api.createInspection(input, options),
    uploadInspectionFrames: (id: string, frames: CapturedFrame[]) =>
      once(uploads, id, () =>
        api.uploadInspectionFrames(id, selectKeyFrames(frames)),
      ),
    completeInspection: (id: string) =>
      once(completions, id, () => api.completeInspection(id)),
    getInspectionStatus: (id: string, options?: ApiRequestOptions) =>
      api.getInspectionStatus(id, options),
    getInspectionResult: (id: string, options?: ApiRequestOptions) =>
      api.getInspectionResult(id, options),
    restoreMockSession: (
      id: string,
      input: CreateInspectionInput,
      frameCount: number,
      completed: boolean,
    ) => {
      if (api instanceof MockInspectionApi)
        api.restoreSession(id, input, frameCount, completed);
    },
  };
}
const mode: InspectionMode =
  process.env.NEXT_PUBLIC_USE_MOCK_AI === "false" ? "API" : "MOCK";
export const inspectionService = createInspectionService(
  mode === "MOCK" ? new MockInspectionApi() : new HttpInspectionApi(),
  mode,
);
export const {
  createInspection,
  uploadInspectionFrames,
  completeInspection,
  getInspectionStatus,
  getInspectionResult,
} = inspectionService;
