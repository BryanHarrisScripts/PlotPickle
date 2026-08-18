import { agentProfileById, type AgentProfile } from "./agent-profiles";

export const CONTEXT_SOURCE_TYPES = [
  "agent-profile",
  "agent-skill",
  "writer-instruction",
  "ppf-canon",
  "curriculum-current",
  "curriculum-adapted",
  "curriculum-historical",
  "project-memory",
  "recent-conversation",
  "agent-observation",
  "buzz-peer",
  "external-tool",
  "task-schema",
  "task-reference",
] as const;

export const CONTEXT_ALLOWED_USES = [
  "instruction",
  "procedure",
  "canon",
  "evidence",
  "reference",
  "schema",
  "untrusted-suggestion",
] as const;

export const CONTEXT_TRUST_LEVELS = ["owner-trusted", "trusted", "approved", "unverified", "untrusted"] as const;

export type ContextSourceType = (typeof CONTEXT_SOURCE_TYPES)[number];
export type ContextAllowedUse = (typeof CONTEXT_ALLOWED_USES)[number];
export type ContextTrustLevel = (typeof CONTEXT_TRUST_LEVELS)[number];

export type ContextItemInput = {
  readonly id: string;
  readonly sourceType: ContextSourceType;
  readonly sourceId: string;
  readonly content: string;
  readonly trust: ContextTrustLevel;
  readonly authority: number;
  readonly allowedUse: ContextAllowedUse;
  readonly revision?: string | number;
  readonly createdAt?: string;
  readonly observedAt?: string;
  readonly required?: boolean;
};

export type ContextItem = ContextItemInput & {
  readonly content: string;
  readonly allowedUse: ContextAllowedUse;
  readonly clipped: boolean;
  readonly approximateTokens: number;
};

export type ContextReceiptSource = {
  readonly id: string;
  readonly sourceType: ContextSourceType;
  readonly sourceId: string;
  readonly trust: ContextTrustLevel;
  readonly authority: number;
  readonly allowedUse: ContextAllowedUse;
  readonly revision?: string | number;
  readonly clipped: boolean;
  readonly approximateTokens: number;
};

export type ContextReceipt = {
  readonly version: 1;
  readonly taskId: string;
  readonly profileId: string;
  readonly generatedAt: string;
  readonly budgetCharacters: number;
  readonly usedCharacters: number;
  readonly approximateTokens: number;
  readonly includedCount: number;
  readonly droppedCount: number;
  readonly sourceCounts: Readonly<Record<string, number>>;
  readonly sources: readonly ContextReceiptSource[];
};

export type ContextPacket = {
  readonly version: 1;
  readonly taskId: string;
  readonly goal: string;
  readonly profileId: string;
  readonly expectedOutputSchema: string;
  readonly items: readonly ContextItem[];
  readonly receipt: ContextReceipt;
};

const AUTHORITY = {
  writerInstruction: 100,
  ppfCanon: 95,
  currentCurriculum: 90,
  taskSchema: 88,
  agentProfile: 85,
  agentSkill: 82,
  approvedProjectMemory: 72,
  recentConversation: 65,
  adaptedCurriculum: 60,
  taskReference: 55,
  agentObservation: 40,
  historicalCurriculum: 30,
  externalTool: 20,
  buzzPeer: 10,
} as const;

export const CONTEXT_AUTHORITY = AUTHORITY;

const UNTRUSTED_SOURCE_TYPES = new Set<ContextSourceType>(["agent-observation", "buzz-peer", "external-tool"]);
const NON_CANON_SOURCE_TYPES = new Set<ContextSourceType>([
  "agent-profile",
  "agent-skill",
  "curriculum-current",
  "curriculum-adapted",
  "curriculum-historical",
  "project-memory",
  "recent-conversation",
  "agent-observation",
  "buzz-peer",
  "external-tool",
  "task-schema",
  "task-reference",
]);

function cleanText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r/g, "").trim();
}

function approximateTokens(characters: number) {
  return Math.ceil(Math.max(0, characters) / 4);
}

function safeTimestamp(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function normalizeAllowedUse(item: ContextItemInput): ContextAllowedUse {
  if (UNTRUSTED_SOURCE_TYPES.has(item.sourceType)) return "untrusted-suggestion";
  if (item.sourceType === "project-memory" && item.allowedUse === "canon") return "evidence";
  if (item.sourceType === "curriculum-historical" && item.allowedUse === "instruction") return "reference";
  if (NON_CANON_SOURCE_TYPES.has(item.sourceType) && item.allowedUse === "canon") return "evidence";
  return item.allowedUse;
}

function normalizeTrust(item: ContextItemInput): ContextTrustLevel {
  if (UNTRUSTED_SOURCE_TYPES.has(item.sourceType)) return "untrusted";
  if (item.sourceType === "ppf-canon" && item.trust === "untrusted") return "approved";
  return item.trust;
}

function boundedAuthority(item: ContextItemInput) {
  if (item.sourceType === "writer-instruction") return AUTHORITY.writerInstruction;
  if (item.sourceType === "ppf-canon") return AUTHORITY.ppfCanon;
  if (item.sourceType === "curriculum-current") return AUTHORITY.currentCurriculum;
  if (item.sourceType === "task-schema") return AUTHORITY.taskSchema;
  if (item.sourceType === "agent-profile") return AUTHORITY.agentProfile;
  if (item.sourceType === "agent-skill") return AUTHORITY.agentSkill;
  if (item.sourceType === "project-memory") return Math.min(item.authority, AUTHORITY.approvedProjectMemory);
  if (item.sourceType === "recent-conversation") return Math.min(item.authority, AUTHORITY.recentConversation);
  if (item.sourceType === "curriculum-adapted") return Math.min(item.authority, AUTHORITY.adaptedCurriculum);
  if (item.sourceType === "task-reference") return Math.min(item.authority, AUTHORITY.taskReference);
  if (item.sourceType === "agent-observation") return Math.min(item.authority, AUTHORITY.agentObservation);
  if (item.sourceType === "curriculum-historical") return Math.min(item.authority, AUTHORITY.historicalCurriculum);
  if (item.sourceType === "external-tool") return Math.min(item.authority, AUTHORITY.externalTool);
  if (item.sourceType === "buzz-peer") return Math.min(item.authority, AUTHORITY.buzzPeer);
  return Math.max(0, Math.min(100, item.authority));
}

function profileContext(profile: AgentProfile): ContextItemInput {
  return {
    id: `profile:${profile.id}`,
    sourceType: "agent-profile",
    sourceId: profile.id,
    trust: "trusted",
    authority: AUTHORITY.agentProfile,
    allowedUse: "instruction",
    required: true,
    content: JSON.stringify({
      identity: profile.displayName,
      title: profile.title,
      responsibility: profile.responsibility,
      runtimeRoleId: profile.runtimeRoleId,
      requestedModelRole: profile.requestedModelRole,
      skillUris: profile.skillUris,
      readScopes: profile.readScopes,
      proposalScopes: profile.proposalScopes,
      creativeAuthority: profile.creativeAuthority,
      verificationContract: profile.verificationContract,
    }),
  };
}

function normalizeItem(item: ContextItemInput, generatedAt: string): ContextItemInput {
  const content = cleanText(item.content);
  return {
    ...item,
    content,
    trust: normalizeTrust(item),
    authority: boundedAuthority(item),
    allowedUse: normalizeAllowedUse(item),
    createdAt: item.createdAt ? safeTimestamp(item.createdAt, generatedAt) : undefined,
    observedAt: safeTimestamp(item.observedAt, generatedAt),
  };
}

function priority(left: ContextItemInput, right: ContextItemInput) {
  if (Boolean(left.required) !== Boolean(right.required)) return left.required ? -1 : 1;
  if (left.authority !== right.authority) return right.authority - left.authority;
  const trustRank: Record<ContextTrustLevel, number> = {
    "owner-trusted": 5,
    trusted: 4,
    approved: 3,
    unverified: 2,
    untrusted: 1,
  };
  if (trustRank[left.trust] !== trustRank[right.trust]) return trustRank[right.trust] - trustRank[left.trust];
  return left.id.localeCompare(right.id);
}

function clipContent(content: string, maximum: number) {
  if (content.length <= maximum) return { content, clipped: false };
  if (maximum <= 1) return { content: content.slice(0, maximum), clipped: true };
  const slice = content.slice(0, Math.max(1, maximum - 1)).trimEnd();
  return { content: `${slice}…`, clipped: true };
}

function receiptSummaryCounts(items: readonly ContextItem[]) {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.sourceType] = (counts[item.sourceType] || 0) + 1;
  return counts;
}

export function assembleContextPacket(input: {
  readonly profileId: string;
  readonly taskId: string;
  readonly goal: string;
  readonly budgetCharacters: number;
  readonly expectedOutputSchema?: string;
  readonly items: readonly ContextItemInput[];
}): ContextPacket {
  const profile = agentProfileById(input.profileId);
  if (!profile) throw new Error(`Unknown Agent Profile: ${input.profileId}.`);
  if (!input.taskId.trim()) throw new Error("Context taskId is required.");
  if (!input.goal.trim()) throw new Error("Context goal is required.");
  const budgetCharacters = Math.max(2_000, Math.min(96_000, Math.floor(input.budgetCharacters)));
  const generatedAt = new Date().toISOString();
  const candidates = [profileContext(profile), ...input.items]
    .map((item) => normalizeItem(item, generatedAt))
    .filter((item) => item.content.length > 0)
    .sort(priority);

  const included: ContextItem[] = [];
  let remaining = budgetCharacters;
  let droppedCount = 0;
  const maximumPerItem = Math.max(800, Math.floor(budgetCharacters * 0.45));

  for (const item of candidates) {
    if (remaining <= 0) {
      droppedCount += 1;
      continue;
    }
    const allowance = Math.min(maximumPerItem, remaining);
    if (!item.required && allowance < 160) {
      droppedCount += 1;
      continue;
    }
    const clipped = clipContent(item.content, allowance);
    const normalized: ContextItem = {
      ...item,
      content: clipped.content,
      clipped: clipped.clipped,
      approximateTokens: approximateTokens(clipped.content.length),
    };
    included.push(normalized);
    remaining -= normalized.content.length;
  }

  const usedCharacters = included.reduce((total, item) => total + item.content.length, 0);
  const receipt: ContextReceipt = {
    version: 1,
    taskId: input.taskId,
    profileId: input.profileId,
    generatedAt,
    budgetCharacters,
    usedCharacters,
    approximateTokens: approximateTokens(usedCharacters),
    includedCount: included.length,
    droppedCount,
    sourceCounts: receiptSummaryCounts(included),
    sources: included.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      trust: item.trust,
      authority: item.authority,
      allowedUse: item.allowedUse,
      revision: item.revision,
      clipped: item.clipped,
      approximateTokens: item.approximateTokens,
    })),
  };

  return {
    version: 1,
    taskId: input.taskId,
    goal: cleanText(input.goal),
    profileId: input.profileId,
    expectedOutputSchema: cleanText(input.expectedOutputSchema || ""),
    items: included,
    receipt,
  };
}

export function contextItem(packet: ContextPacket, id: string) {
  return packet.items.find((item) => item.id === id) ?? null;
}

export function contextReceiptSummary(receipt: ContextReceipt, actorLabel = "Agent") {
  const count = (type: ContextSourceType) => receipt.sourceCounts[type] || 0;
  const parts: string[] = [];
  const storyFacts = count("ppf-canon");
  const curriculum = count("curriculum-current") + count("curriculum-adapted") + count("curriculum-historical");
  const projectMemory = count("project-memory");
  const conversation = count("recent-conversation");
  if (storyFacts) parts.push(`${storyFacts} story ${storyFacts === 1 ? "fact" : "facts"}`);
  if (curriculum) parts.push(`${curriculum} curriculum ${curriculum === 1 ? "reference" : "references"}`);
  if (projectMemory) parts.push(`${projectMemory} approved project ${projectMemory === 1 ? "decision" : "decisions"}`);
  if (conversation) parts.push(`${conversation} recent conversation ${conversation === 1 ? "slice" : "slices"}`);
  return `${actorLabel} used ${parts.length ? parts.join(" · ") : `${receipt.includedCount} bounded context sources`}`;
}

export function contextAuthorityPrecedes(left: ContextItemInput, right: ContextItemInput) {
  const generatedAt = new Date(0).toISOString();
  return priority(normalizeItem(left, generatedAt), normalizeItem(right, generatedAt)) < 0;
}

export function contextPacketHasHostInstructionFromUntrustedSource(packet: ContextPacket) {
  return packet.items.some((item) => UNTRUSTED_SOURCE_TYPES.has(item.sourceType) && item.allowedUse === "instruction");
}
