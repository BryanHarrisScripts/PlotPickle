export const LEARN_TOPIC_SPINE = [
  { id: "foundations", label: "Foundations", learnTopicId: "foundations" },
  { id: "industry", label: "Industry", learnTopicId: "industry" },
  { id: "theme", label: "Theme", learnTopicId: "theme" },
  { id: "character", label: "Character", learnTopicId: "character" },
  { id: "world", label: "World", learnTopicId: "world" },
  { id: "structure", label: "Structure", learnTopicId: "structure" },
  { id: "dialogue", label: "Dialogue", learnTopicId: "dialogue" },
  { id: "previs", label: "PREVIS", learnTopicId: "visual-storytelling" },
  { id: "drafting", label: "Drafting", learnTopicId: "drafting" },
  { id: "revision", label: "Revision", learnTopicId: "revision" },
  { id: "responsible-ai", label: "Responsible AI", learnTopicId: "responsible-ai" },
  { id: "collaboration", label: "Collaboration", learnTopicId: "collaboration" },
] as const;

export type LearnTopicSpineId = (typeof LEARN_TOPIC_SPINE)[number]["id"];

export function learnTopicSpineEntry(id: LearnTopicSpineId) {
  return LEARN_TOPIC_SPINE.find((topic) => topic.id === id) ?? LEARN_TOPIC_SPINE[0];
}

export function learnTopicHref(id: LearnTopicSpineId) {
  const topic = learnTopicSpineEntry(id);
  return `/?workspace=learn&topic=${encodeURIComponent(topic.learnTopicId)}`;
}
