import { PLOTPICKLE_REPOSITORY_URL } from "./product-direction";

export const PLOTPICKLE_VERSION = "1.0.0-rc.3" as const;

export type ProductFeedbackKind = "feature" | "bug" | "usability";

export type ProductFeedbackInput = {
  kind: ProductFeedbackKind;
  title: string;
  description: string;
  reproduction?: string;
  expected?: string;
  actual?: string;
  safeDiagnostics?: string;
  privacyConfirmed?: boolean;
};

export type ProductFeedbackIssue = {
  title: string;
  body: string;
  labels: string[];
  url: string;
};

export const PRODUCT_FEEDBACK_KINDS = [
  {
    id: "feature",
    label: "Feature request",
    prefix: "[Feature]",
    labels: ["enhancement", "triage"],
    description: "Propose a focused improvement or new capability.",
  },
  {
    id: "bug",
    label: "Bug report",
    prefix: "[Bug]",
    labels: ["bug", "triage"],
    description: "Report repeatable behavior that is broken or incorrect.",
  },
  {
    id: "usability",
    label: "Usability or design flaw",
    prefix: "[Usability]",
    labels: ["enhancement", "triage"],
    description: "Report confusing language, navigation, layout or workflow friction.",
  },
] as const satisfies ReadonlyArray<{
  id: ProductFeedbackKind;
  label: string;
  prefix: string;
  labels: readonly string[];
  description: string;
}>;

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bgh[pousr]_[A-Za-z0-9_]+\b/g, "[GitHub credential redacted]"],
  [/\bgithub_pat_[A-Za-z0-9_]+\b/g, "[GitHub credential redacted]"],
  [/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[API credential redacted]"],
  [/\bya29\.[A-Za-z0-9._-]+\b/g, "[Google credential redacted]"],
  [/\b1\/\/[A-Za-z0-9._-]+\b/g, "[Google credential redacted]"],
  [/\bnsec1[a-z0-9]+\b/gi, "[Buzz credential redacted]"],
  [/\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi, "Bearer [credential redacted]"],
  [/\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[token redacted]"],
  [/(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|token|client[_ -]?secret|secret|password|private[_ -]?key|pin|invitation(?:[_ -]?code)?)\s*[:=]\s*[^\s,;]+/gi, "$1=[credential redacted]"],
  [/https?:\/\/github\.com\/(?!BryanHarrisScripts\/PlotPickle\b)[^\s/]+\/[^\s#?]+/gi, "[private repository path redacted]"],
];

const LOCAL_PATH_PATTERNS: Array<[RegExp, string]> = [
  [/[A-Za-z]:\\Users\\[^\r\n"'<>|]+/g, "[local path redacted]"],
  [/[A-Za-z]:\\(?:ProgramData|Windows|Temp|AppData)\\[^\r\n"'<>|]+/gi, "[local path redacted]"],
  [/\/(?:Users|home|private\/var|tmp)\/[^\r\n"'<>|]+/g, "[local path redacted]"],
  [/%(?:APPDATA|LOCALAPPDATA|USERPROFILE|TEMP)%\\[^\r\n"'<>|]+/gi, "[local path redacted]"],
];

function clamp(value: string, maximum: number) {
  return value.length <= maximum ? value : `${value.slice(0, Math.max(0, maximum - 16)).trimEnd()}\n[content trimmed]`;
}

export function redactProductFeedbackText(value: string, maximum = 8_000) {
  let safe = value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n");
  for (const [pattern, replacement] of SECRET_PATTERNS) safe = safe.replace(pattern, replacement);
  for (const [pattern, replacement] of LOCAL_PATH_PATTERNS) safe = safe.replace(pattern, replacement);
  return clamp(safe.trim(), maximum);
}

export function safeProductDiagnostics(input: {
  userAgent?: string;
  platform?: string;
  language?: string;
  timestamp?: string;
}) {
  const rows = [
    `PlotPickle version: ${PLOTPICKLE_VERSION}`,
    `Runtime: browser in local PlotPickle server`,
    `Platform: ${redactProductFeedbackText(input.platform || "Not reported", 160)}`,
    `Browser: ${redactProductFeedbackText(input.userAgent || "Not reported", 300)}`,
    `Language: ${redactProductFeedbackText(input.language || "Not reported", 80)}`,
    `Recorded: ${redactProductFeedbackText(input.timestamp || new Date().toISOString(), 80)}`,
    "Story/project data: not collected",
    "Credentials and local paths: redacted",
  ];
  return rows.join("\n");
}

function section(title: string, value: string, fallback = "Not provided") {
  return `## ${title}\n\n${value || fallback}`;
}

export function buildProductFeedbackIssue(input: ProductFeedbackInput): ProductFeedbackIssue {
  const kind = PRODUCT_FEEDBACK_KINDS.find((entry) => entry.id === input.kind) ?? PRODUCT_FEEDBACK_KINDS[0];
  const titleText = redactProductFeedbackText(input.title, 180) || "Untitled PlotPickle feedback";
  const description = redactProductFeedbackText(input.description, 1_800);
  const reproduction = redactProductFeedbackText(input.reproduction || "", 1_200);
  const expected = redactProductFeedbackText(input.expected || "", 800);
  const actual = redactProductFeedbackText(input.actual || "", 800);
  const diagnostics = redactProductFeedbackText(input.safeDiagnostics || "", 700);

  const content = [
    `> Submitted from PlotPickle's Suggest / Report workspace. Bryan reviews each item and may accept, defer or close it. Submitting an issue does not authorize automatic coding, merging or changes to story canon.`,
    section("Request type", kind.label),
    section("Summary", description),
    input.kind === "bug" ? section("Reproduction steps", reproduction, "No reliable reproduction steps were provided.") : reproduction ? section("Steps or workflow", reproduction) : "",
    section(input.kind === "feature" ? "Desired outcome" : "Expected behavior", expected),
    section(input.kind === "feature" ? "Current limitation" : "Actual behavior", actual),
    diagnostics ? section("Safe technical context", `\`\`\`text\n${diagnostics}\n\`\`\``) : "",
  ].filter(Boolean).join("\n\n");
  const privacy = `## Privacy confirmation\n\n- No current PlotPickle story or project data was attached automatically.\n- [${input.privacyConfirmed ? "x" : " "}] The reporter confirmed that private story material, credentials and confidential repository information were removed.`;
  const safeBody = `${clamp(content, 5_500)}\n\n${privacy}`;

  const title = `${kind.prefix}: ${titleText}`;
  const parameters = new URLSearchParams({
    title,
    body: safeBody,
    labels: kind.labels.join(","),
  });

  return {
    title,
    body: safeBody,
    labels: [...kind.labels],
    url: `${PLOTPICKLE_REPOSITORY_URL}/issues/new?${parameters.toString()}`,
  };
}
