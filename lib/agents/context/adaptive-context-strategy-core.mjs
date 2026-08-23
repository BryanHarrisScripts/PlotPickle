export const CONTEXT_STRATEGIES = [
  "general",
  "continuity",
  "scene-rewrite",
  "structure-review",
  "visual-continuity",
];

const ALWAYS_KEEP = new Set([
  "writer-instruction",
  "ppf-canon",
  "task-schema",
]);

const STRATEGY_PREFERENCES = {
  general: ["ppf-canon", "story-knowledge-graph", "curriculum-current", "project-memory", "recent-conversation", "task-reference"],
  continuity: ["ppf-canon", "story-knowledge-graph", "project-memory", "task-reference", "recent-conversation", "agent-observation"],
  "scene-rewrite": ["ppf-canon", "story-knowledge-graph", "writer-instruction", "recent-conversation", "project-memory", "curriculum-current", "task-reference"],
  "structure-review": ["ppf-canon", "story-knowledge-graph", "curriculum-current", "project-memory", "task-reference", "recent-conversation"],
  "visual-continuity": ["ppf-canon", "story-knowledge-graph", "project-memory", "task-reference", "agent-observation", "recent-conversation"],
};

function preferredRank(strategyId, sourceType) {
  const preferences = STRATEGY_PREFERENCES[strategyId] || STRATEGY_PREFERENCES.general;
  const index = preferences.indexOf(sourceType);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function candidateCap(budgetCharacters) {
  return Math.max(8, Math.min(48, Math.ceil(Math.max(2_000, Number(budgetCharacters) || 0) / 1_500)));
}

export function selectAdaptiveContextCandidates({ strategyId = "general", budgetCharacters, items = [] }) {
  const cap = candidateCap(budgetCharacters);
  const required = items.filter((item) => item?.required || ALWAYS_KEEP.has(item?.sourceType));
  const requiredIds = new Set(required.map((item) => item.id));
  const optional = items
    .filter((item) => !requiredIds.has(item.id))
    .map((item, index) => ({ item, index, rank: preferredRank(strategyId, item.sourceType) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .slice(0, Math.max(0, cap - required.length))
    .map(({ item }) => item);
  return [...required, ...optional];
}

export function contextStrategyForTask(text = "") {
  const value = String(text).toLowerCase();
  if (/\b(?:visual|image|reference image|wardrobe|costume|appearance|storyboard|panel|shot|composition)\b/.test(value)) return "visual-continuity";
  if (/\b(?:rewrite|revise|scene|dialogue|dialog|voice|line edit|prose|screenplay page)\b/.test(value)) return "scene-rewrite";
  if (/\b(?:continuity|canon|character relationship|character history|timeline|contradiction|consistency)\b/.test(value)) return "continuity";
  if (/\b(?:structure|beat|block|act|arc|theme|turning point|24\/96|outline|foundation)\b/.test(value)) return "structure-review";
  return "general";
}
