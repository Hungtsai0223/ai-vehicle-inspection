export type InspectionApiErrorCode =
  | "NETWORK_ERROR"
  | "UPLOAD_FAILED"
  | "PROCESSING_FAILED"
  | "INVALID_RESPONSE"
  | "TIMEOUT";
const messages: Record<InspectionApiErrorCode, string> = {
  NETWORK_ERROR: "目前無法連線至 AI 分析服務，請稍後再試。",
  UPLOAD_FAILED: "影像上傳失敗，系統將保留已完成的掃描資料。",
  PROCESSING_FAILED: "AI 分析暫時無法完成，請由人工協助確認車況。",
  INVALID_RESPONSE: "分析服務回傳的資料不完整，請稍後重試。",
  TIMEOUT: "AI 分析服務回應逾時，請稍後再試。",
};
export class InspectionApiError extends Error {
  constructor(
    public readonly code: InspectionApiErrorCode,
    details?: unknown,
  ) {
    super(messages[code]);
    this.name = "InspectionApiError";
    if (process.env.NODE_ENV === "development" && details !== undefined) {
      console.error(`[Inspection API: ${code}]`, details);
    }
  }
}
export function inspectionErrorMessage(error: unknown): string {
  return error instanceof InspectionApiError
    ? error.message
    : messages.PROCESSING_FAILED;
}
