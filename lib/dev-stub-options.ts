export const stubResults = [
  "potential_damage",
  "no_damage",
  "processing_failure",
  "result_timeout",
  "incomplete",
  "missing_images",
  "multiple_damage",
  "unknown_values",
] as const;
export const stubFailures = ["none", "500", "503", "upload_failure"] as const;
