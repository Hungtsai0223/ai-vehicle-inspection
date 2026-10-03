import type { Scenario } from "../types/inspection";

export const demoScenarios = [
  { value: "potential_damage", label: "疑似車損結果" },
  { value: "no_damage", label: "無車損結果" },
  { value: "multiple_damage", label: "多處車損" },
  { value: "unknown_area", label: "覆蓋不足結果" },
  { value: "backend_error", label: "後端失敗演練" },
] as const;
export type DemoScenario = (typeof demoScenarios)[number]["value"];
export type DemoResultScenario = Exclude<Scenario, "backend_error">;
export function isScenario(value: unknown): value is Scenario {
  return (
    value === "incomplete" || demoScenarios.some((item) => item.value === value)
  );
}
export function getDemoScenario(
  value = process.env.NEXT_PUBLIC_DEMO_RESULT,
): DemoScenario {
  return demoScenarios.some((item) => item.value === value)
    ? (value as DemoScenario)
    : "potential_damage";
}
export function canUseDemoResults() {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_USE_MOCK_AI !== "false" ||
    process.env.NEXT_PUBLIC_ENABLE_DEMO === "true"
  );
}
export function demoStubResult(scenario = getDemoScenario()) {
  return scenario === "unknown_area"
    ? "incomplete"
    : scenario === "backend_error"
      ? "processing_failure"
      : scenario;
}
