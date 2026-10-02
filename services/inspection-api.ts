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
export interface InspectionSession {
  inspectionId: string;
  status: InspectionStatus;
}
export interface UploadReceipt {
  accepted: number;
}
/** Both adapters implement this contract. React components call the service instead. */
export interface InspectionApi {
  createInspection(input: CreateInspectionInput): Promise<InspectionSession>;
  uploadInspectionFrames(
    id: string,
    frames: CapturedFrame[],
  ): Promise<UploadReceipt>;
  completeInspection(id: string): Promise<InspectionSession>;
  getInspectionStatus(id: string): Promise<InspectionProgress>;
  getInspectionResult(id: string): Promise<InspectionResult>;
}
