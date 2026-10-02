// Compatibility entry point; UI should import services/inspection-service directly.
export {
  inspectionService,
  createInspection,
  uploadInspectionFrames,
  completeInspection,
  getInspectionStatus,
  getInspectionResult,
} from "../services/inspection-service";
