import type { BackendHealth } from "@/services/backend-health";
export function BackendStatusIndicator({
  mode,
  health,
}: {
  mode: "MOCK" | "API";
  health: BackendHealth;
}) {
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <span className="backend-status" role="status">
      {mode === "MOCK"
        ? "Mock Mode"
        : health === "reachable"
          ? "Backend Connected"
          : health === "unreachable"
            ? "Backend Unreachable"
            : "Backend Health Unknown"}
    </span>
  );
}
