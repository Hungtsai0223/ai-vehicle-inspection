import type { CapturedFrame } from "../types/frame";
import type {
  InspectionProgress,
  InspectionResult,
  InspectionStatus,
  Scenario,
  Vehicle,
} from "../types/inspection";
export interface CreateInspectionInput {
  vehicle: Vehicle;
  /** Used only by the mock adapter. */ scenario?: Scenario;
}
export interface ApiRequestOptions {
  signal?: AbortSignal;
  /** Lightweight fallback for resumed sessions when backend omits these fields. */
  vehicle?: Vehicle;
  createdAt?: string;
}
export interface InspectionSession {
  inspectionId: string;
  status: InspectionStatus;
}
export interface UploadReceipt {
  accepted: number;
}
/** Both adapters implement this contract. React components call the service instead. */
export interface InspectionApi {
  createInspection(
    input: CreateInspectionInput,
    options?: ApiRequestOptions,
  ): Promise<InspectionSession>;
  uploadInspectionFrames(
    id: string,
    frames: CapturedFrame[],
    options?: ApiRequestOptions,
  ): Promise<UploadReceipt>;
  completeInspection(
    id: string,
    options?: ApiRequestOptions,
  ): Promise<InspectionSession>;
  getInspectionStatus(
    id: string,
    options?: ApiRequestOptions,
  ): Promise<InspectionProgress>;
  getInspectionResult(
    id: string,
    options?: ApiRequestOptions,
  ): Promise<InspectionResult>;
}
