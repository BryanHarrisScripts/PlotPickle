import { validateStoryGamePreflight } from "./validator.mjs";
import { storyRuleIsAdmitted } from "./authoring.mjs";

function isReference(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function notAdmittedFinding(ruleId) {
  return Object.freeze({
    code: "STORY_RULE_NOT_ADMITTED",
    severity: "error",
    subjectRefs: Object.freeze([ruleId]),
    message: `Story Rule ${ruleId} is still generated/imported proposal data and has not been explicitly admitted.`,
    evidenceRefs: Object.freeze([ruleId]),
    suggestedRepair: "Review the visible WHEN / IF / COST / DO / THEN mechanics and explicitly admit the rule before launch.",
  });
}

export function validateCreatorGameForLaunch(input = {}) {
  const base = validateStoryGamePreflight(input);
  const referencedRuleIds = new Set(Array.isArray(input.gameDefinition?.ruleIds) ? input.gameDefinition.ruleIds : []);
  const unadmitted = (Array.isArray(input.rules) ? input.rules : [])
    .filter((rule) => isReference(rule?.id) && referencedRuleIds.has(rule.id) && !storyRuleIsAdmitted(rule))
    .map((rule) => rule.id)
    .sort((left, right) => left.localeCompare(right));

  if (unadmitted.length === 0) return base;

  const findings = [
    ...base.findings.filter((finding) => finding.code !== "STORY_PREFLIGHT_PASS"),
    ...unadmitted.map(notAdmittedFinding),
  ];
  return Object.freeze({
    ...base,
    findings: Object.freeze(findings),
    launchAllowed: false,
  });
}
