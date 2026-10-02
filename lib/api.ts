import type {
  InspectionApi,
  Scenario,
  InspectionStatus,
} from "@/types/inspection";
import { mockConfig, resultFor } from "./mock-data";
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 160));
const sessions = new Map<
  string,
  {
    scenario: Scenario;
    started: number;
    uploaded: boolean;
    analysisStarted?: number;
  }
>();
export const mockApi: InspectionApi = {
  async startInspection(scenario = mockConfig.defaultScenario) {
    await wait();
    const inspectionId = `demo_${Date.now()}`;
    sessions.set(inspectionId, {
      scenario,
      started: Date.now(),
      uploaded: false,
    });
    return { inspectionId };
  },
  async uploadKeyFrames(id, frames) {
    await wait();
    const session = sessions.get(id);
    if (!session) throw new Error("找不到檢查紀錄，請重新開始掃描。");
    session.uploaded = true;
    session.started = Date.now();
    return { accepted: frames.length };
  },
  async getInspectionStatus(id) {
    await wait();
    const s = sessions.get(id);
    if (!s) throw new Error("找不到檢查紀錄");
    // Start the mock analysis clock when the analyzing screen first polls.
    // This keeps the 800 ms scan-completion preview separate from processing.
    if (s.uploaded && s.analysisStarted === undefined)
      s.analysisStarted = Date.now();
    const progress = s.uploaded
      ? Math.min(
          100,
          ((Date.now() - s.analysisStarted!) / mockConfig.analysisDurationMs) *
            100,
        )
      : 0;
    return {
      progress,
      status: !s.uploaded
        ? "scanning"
        : progress < 100
          ? "analyzing"
          : s.scenario === "no_damage"
            ? "complete"
            : "potential_damage",
    };
  },
  async getInspectionResult(id) {
    await wait();
    const s = sessions.get(id);
    if (!s) throw new Error("找不到檢查紀錄");
    return resultFor(s.scenario, id);
  },
};
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_AI_API_URL}${path}`,
    init,
  );
  if (!response.ok) throw new Error(`Inspection API: ${response.status}`);
  return response.json() as Promise<T>;
}
// TODO: agree backend authentication, retries, retention and upload schema before live use.
export const restApi: InspectionApi = {
  startInspection: (scenario) =>
    request("/api/inspection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
    }),
  uploadKeyFrames: (id, frames) => {
    const body = new FormData();
    frames.forEach((f) => {
      body.append("frames", f.image, `${f.id}.jpg`);
      body.append(
        "metadata",
        JSON.stringify({ id: f.id, angle: f.angle, timestamp: f.timestamp }),
      );
    });
    return request(`/api/inspection/${encodeURIComponent(id)}/frames`, {
      method: "POST",
      body,
    });
  },
  getInspectionStatus: (id) =>
    request<InspectionStatus>(`/api/inspection/${encodeURIComponent(id)}`),
  getInspectionResult: (id) =>
    request(`/api/inspection/${encodeURIComponent(id)}/result`),
};
export const inspectionApi =
  process.env.NEXT_PUBLIC_INSPECTION_MODE === "rest" ? restApi : mockApi;
export const {
  startInspection,
  uploadKeyFrames,
  getInspectionStatus,
  getInspectionResult,
} = inspectionApi;
