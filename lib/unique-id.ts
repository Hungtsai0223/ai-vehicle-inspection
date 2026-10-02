let sequence = 0;
/** randomUUID is guarded for older mobile Safari; IDs remain local session identifiers. */
export function createUniqueId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${(++sequence).toString(36)}`;
  return `${prefix}_${suffix}`;
}
