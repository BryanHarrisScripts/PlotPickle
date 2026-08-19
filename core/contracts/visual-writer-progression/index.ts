export const VISUAL_WRITER_GROUP_ORDER = [
  "foundations",
  "world",
  "character",
  "theme",
  "structure",
  "visual-storytelling",
  "drafting",
  "dialogue",
  "revision",
  "responsible-ai",
  "industry",
  "collaboration",
] as const;

export type VisualWriterCurriculumGroupId = (typeof VISUAL_WRITER_GROUP_ORDER)[number];

const VISUAL_WRITER_GROUP_RANK = new Map<string, number>(
  VISUAL_WRITER_GROUP_ORDER.map((groupId, index) => [groupId, index]),
);

export function compareVisualWriterCurriculumOrder(
  left: { readonly topic: string; readonly number: number },
  right: { readonly topic: string; readonly number: number },
) {
  const leftGroup = VISUAL_WRITER_GROUP_RANK.get(left.topic) ?? Number.MAX_SAFE_INTEGER;
  const rightGroup = VISUAL_WRITER_GROUP_RANK.get(right.topic) ?? Number.MAX_SAFE_INTEGER;
  return leftGroup - rightGroup || left.number - right.number;
}
