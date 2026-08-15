export const SAGE_CONVERSATION_UAT_CASES = Object.freeze([
  { id: "identity-name", question: "what is your name", kind: "identity" },
  { id: "identity-who", question: "Who are you?", kind: "identity" },
  { id: "help", question: "Can you help me?", kind: "help" },
  { id: "greeting", question: "Hello Sage. How are you?", kind: "conversation" },
  { id: "craft", question: "What is theme, and how should I use it in my story?", kind: "craft" },
  { id: "follow-up", question: "Can you give me a shorter version of that?", kind: "conversation" },
]);

const INTERNAL_MARKERS = /(?:QUALITY MODEL ESCALATION|RESPONSE QUALITY RETRY|CONVERSATION MODE:|STARTUP HEALTH(?: QUALITY FALLBACK| RETRY)?|curriculum_context|project_memory|conversation_memory|student_question|LOCAL CURRICULUM BLOCK|Produce one clean final response to the writer now|Follow Sage'?s identity and conversational role)/i;
const PROJECT_MEMORY_KEY = /"(?:id|title|revision|completedLessonCount|activeLessonId)"\s*:/g;

export function sageUatLeaksInternalScaffolding(answer) {
  const text = String(answer || "");
  if (INTERNAL_MARKERS.test(text)) return true;
  return (text.match(PROJECT_MEMORY_KEY)?.length ?? 0) >= 2;
}

function normalized(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function assessSageConversationAnswer(testCase, answer) {
  const text = String(answer || "").trim();
  const norm = normalized(text);
  const failures = [];
  if (!text) failures.push("Sage returned no visible answer.");
  if (sageUatLeaksInternalScaffolding(text)) failures.push("Sage exposed internal PlotPickle prompt/project scaffolding.");
  if (testCase.kind === "identity") {
    if (!/\bsage\b/.test(norm)) failures.push("Identity response did not name Sage.");
    if (!/\bplotpickle\b/.test(norm)) failures.push("Identity response did not identify PlotPickle.");
    if (!/\b(?:guide|mentor|curriculum)\b/.test(norm)) failures.push("Identity response did not explain Sage's guide role.");
  }
  if (testCase.kind === "help" && !/\b(?:yes|i can|can help|help you|happy to help)\b/.test(norm)) {
    failures.push("Help response did not directly say Sage can help.");
  }
  if (norm === normalized(testCase.question)) failures.push("Sage merely echoed the writer's question.");
  if (text.length > 2_200) failures.push("Sage response exceeded the UAT visible-response ceiling.");
  return { passed: failures.length === 0, failures };
}

export function findingFingerprint(message) {
  const text = normalized(message);
  if (text.includes("internal plotpickle prompt project scaffolding") || text.includes("internal plotpickle instructions")) {
    return "sage.internal-scaffolding-leak";
  }
  if (text.includes("identity response")) return "sage.identity-response-invalid";
  if (text.includes("merely echoed")) return "sage.response-echo";
  return `uat.${text.slice(0, 72).replace(/\s+/g, "-") || "unknown-finding"}`;
}

export function buildUatFinding({ message, area = "sage", evidence = {} }) {
  const fingerprint = findingFingerprint(message);
  return {
    schemaVersion: 1,
    fingerprint,
    area,
    severity: "blocker",
    title: fingerprint === "sage.internal-scaffolding-leak"
      ? "Sage exposed internal prompt/project scaffolding"
      : `Focused UAT blocker: ${area}`,
    message,
    evidence,
  };
}
