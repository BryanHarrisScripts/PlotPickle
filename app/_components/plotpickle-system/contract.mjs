export const PLOTPICKLE_DESIGN_SYSTEM = "bronze-jade-rune";
export const PLOTPICKLE_EXPERIENCE_V2_ISSUE = 1742;
export const SCREEN_MATURITY = Object.freeze(["experimental", "adopting", "approved", "locked"]);
export const WORKFLOW_STATE = Object.freeze(["locked", "available", "incomplete", "ready", "accepted"]);

export function validatePlotPickleScreenRegistry(registry) {
  const failures = [];
  if (registry?.schemaVersion !== 1) failures.push("screen registry schemaVersion must be 1");
  if (registry?.designSystem !== PLOTPICKLE_DESIGN_SYSTEM) failures.push(`designSystem must be ${PLOTPICKLE_DESIGN_SYSTEM}`);
  if (registry?.experienceContractIssue !== PLOTPICKLE_EXPERIENCE_V2_ISSUE) failures.push(`experience contract must be issue ${PLOTPICKLE_EXPERIENCE_V2_ISSUE}`);
  if (JSON.stringify(registry?.workflowStates) !== JSON.stringify(WORKFLOW_STATE)) failures.push(`workflowStates must be ${WORKFLOW_STATE.join(", ")}`);
  if (!Array.isArray(registry?.screens) || registry.screens.length === 0) failures.push("screen registry must contain screens");
  if (!registry?.compatibilityBridge?.ownerIssue || !registry?.compatibilityBridge?.removalCondition) failures.push("compatibility bridge must name its owner issue and removal condition");

  const ids = new Set();
  for (const screen of registry?.screens || []) {
    if (!screen.id || ids.has(screen.id)) failures.push(`screen id is missing or duplicated: ${screen.id || "<missing>"}`);
    ids.add(screen.id);
    if (!screen.label || !screen.entry || !screen.area) failures.push(`${screen.id || "screen"} must define label, entry and area`);
    if (!SCREEN_MATURITY.includes(screen.maturity)) failures.push(`${screen.id || "screen"} has invalid maturity ${screen.maturity}`);
    if (!Number.isInteger(screen.contractVersion) || screen.contractVersion < 1) failures.push(`${screen.id || "screen"} must have a positive contractVersion`);
    if (typeof screen.discoverable !== "boolean" || typeof screen.canonEditable !== "boolean") failures.push(`${screen.id || "screen"} must separate discoverability from canon editability`);
    if (screen.maturity === "locked" && !screen.lockedByIssue) failures.push(`${screen.id || "screen"} is locked without lockedByIssue evidence`);
  }

  return failures;
}
