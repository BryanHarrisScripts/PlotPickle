/**
 * #2958 / TRUTH-FOUNDATIONS-PROPOSAL-001.
 * A bounded negative-control screen for *known* source constraints; this
 * cannot certify unrestricted semantic faithfulness or any AI provider.
 * Neither this module nor a passing screen is permission to change canon.
 */
const HAN = /\p{Script=Han}/u;
const HOUSEHOLD_ROLES = Object.freeze([
  { name: "mother", pattern: /\bmother(?:'s|s')?\s+(?:household|home)\b/iu },
  { name: "father", pattern: /\bfather(?:'s|s')?\s+(?:household|home)\b/iu },
]);
const ATTRIBUTED_PARENTAL_GUIDANCE = /\b(?:mother|father)(?:'s|s')?\s+(?:guidance|advice|counsel|wisdom|instructions)\b|\b(?:guided|advised|taught|mentored)\s+by\s+(?:(?:her|his|their|the)\s+)?(?:mother|father)\b/iu;

export function assessMindMapProposalFidelity({ topicId, currentValue, proposal, fieldPrompt = "" }) {
  const source = typeof currentValue === "string" ? currentValue : "";
  const text = typeof proposal === "string" ? proposal.trim() : "";
  const issues = [];
  if (!text) issues.push("The Agent returned no reviewable suggestion.");

  // English is the language of the bounded request unless its own Human field
  // explicitly supplies Han writing or asks for Mandarin/Chinese. Other
  // scripts/languages are outside this narrow guard and need Human review.
  const nonEnglishRequested = /\b(?:in|use|write in|translate to)\s+(?:mandarin|chinese)\b/iu.test(source);
  const englishTask = /[A-Za-z]/u.test(fieldPrompt);
  if (text && englishTask && !HAN.test(source) && !nonEnglishRequested && HAN.test(text)) {
    issues.push("Unexpected Chinese-script characters appeared in an English-language Agent suggestion.");
  }

  // The exact parent/household distinction observed in #2958 is a named
  // Human constraint, not a role for the model to combine into 'parents'.
  if (topicId === "foundations" && source.trim()) {
    for (const role of HOUSEHOLD_ROLES) {
      if (role.pattern.test(source) && !role.pattern.test(text)) {
        issues.push(`The suggestion did not preserve the explicitly named ${role.name}'s household/home.`);
      }
    }
    if (ATTRIBUTED_PARENTAL_GUIDANCE.test(text) && !ATTRIBUTED_PARENTAL_GUIDANCE.test(source)) {
      issues.push("The suggestion attributed unsupported parental guidance or instruction.");
    }
  }
  return { ok: issues.length === 0, issues };
}

/** One corrective attempt; only a passing suggestion can flow to proposal storage. */
export async function requestMindMapFidelityProposal({ topicId, currentValue, fieldPrompt, ask }) {
  let feedback = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const proposal = (await ask(feedback)).trim();
    const assessment = assessMindMapProposalFidelity({ topicId, currentValue, fieldPrompt, proposal });
    if (assessment.ok) return { ok: true, proposal, attempts: attempt, issues: [] };
    feedback = assessment.issues.join(" ");
  }
  return { ok: false, proposal: "", attempts: 2, issues: [feedback] };
}
