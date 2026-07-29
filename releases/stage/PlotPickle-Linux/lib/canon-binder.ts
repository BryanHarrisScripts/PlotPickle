import type { PlotPickleProject } from "./project";

export const CANON_BINDER_VERSION = "1.0.0" as const;

export type CanonStatus = "draft" | "suggested" | "imported" | "ai-generated" | "reviewed" | "approved" | "locked" | "archived";
export type CanonSection = "story" | "characters" | "world" | "timeline" | "locations" | "research" | "references" | "continuity" | "legal" | "voiceprints" | "visual-style" | "ai-decisions" | "meeting-notes" | "producer-notes" | "director-notes" | "actor-notes";
export type CanonSource = { type: "project" | "pdf-import" | "user" | "ai" | "meeting" | "external"; reference?: string; page?: number; importedAt?: string; confidence?: number };
export type CanonEntry = {
  id: string;
  section: CanonSection;
  kind: string;
  title: string;
  value: unknown;
  status: CanonStatus;
  source: CanonSource;
  tags: string[];
  links: string[];
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  locked?: boolean;
};
export type CanonRelationship = { id: string; from: string; to: string; type: string; confidence: number; status: CanonStatus };
export type CanonConflict = { id: string; severity: "warning" | "critical"; message: string; entryIds: string[]; suggestedAction: string };
export type CanonBinder = {
  version: typeof CANON_BINDER_VERSION;
  generatedAt: string;
  policy: "approved-only";
  sections: Record<CanonSection, string[]>;
  entries: Record<string, CanonEntry>;
  relationships: CanonRelationship[];
  conflicts: CanonConflict[];
  health: { score: number; approved: number; unreviewed: number; locked: number; conflicts: number };
};

const sections: CanonSection[] = ["story", "characters", "world", "timeline", "locations", "research", "references", "continuity", "legal", "voiceprints", "visual-style", "ai-decisions", "meeting-notes", "producer-notes", "director-notes", "actor-notes"];
function slug(value: unknown, fallback: string) { const result = String(value ?? fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80); return result || fallback; }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export function buildCanonBinder(project: PlotPickleProject, generatedAt = project.metadata.updatedAt || new Date().toISOString()): CanonBinder {
  const entries: Record<string, CanonEntry> = {};
  const relationships: CanonRelationship[] = [];
  const sectionIndex = Object.fromEntries(sections.map((section) => [section, []])) as Record<CanonSection, string[]>;
  const add = (section: CanonSection, kind: string, title: string, value: unknown, status: CanonStatus = "approved", source: CanonSource = { type: "project" }, tags: string[] = []) => {
    const id = `canon:${section}:${slug(kind, "entry")}:${slug(title, String(Object.keys(entries).length + 1))}`;
    entries[id] = { id, section, kind, title, value, status, source, tags, links: [], createdAt: project.metadata.createdAt, updatedAt: generatedAt, ...(status === "approved" || status === "locked" ? { approvedAt: generatedAt } : {}), ...(status === "locked" ? { locked: true } : {}) };
    sectionIndex[section].push(id);
    return id;
  };

  add("story", "premise", "Premise", project.story.premise);
  add("story", "logline", "Logline", project.story.logline);
  add("story", "theme", "Theme", project.story.theme);
  add("story", "tone", "Tone", project.metadata.tone);
  add("story", "genre", "Genre", project.metadata.genre);

  for (const character of project.characters) {
    const name = text(character.name) || character.id;
    const characterId = add("characters", "character", name, character);
    const voiceprint = {
      originEnvironment: character.originEnvironment ?? "",
      socialContext: character.socialContext ?? "",
      educationExpertise: character.educationExpertise ?? "",
      worldviewBoundaries: character.worldviewBoundaries ?? "",
      rhythmSentenceShape: character.rhythmSentenceShape ?? "",
      vocabularyMetaphors: character.vocabularyMetaphors ?? "",
      verbalFingerprints: character.verbalFingerprints ?? "",
      emotionalAccess: character.emotionalAccess ?? "",
      statusShift: character.statusShift ?? "",
      persuasionStrategy: character.persuasionStrategy ?? "",
    };
    const voiceId = add("voiceprints", "character-voiceprint", name, voiceprint, "approved", { type: "project" }, [characterId]);
    relationships.push({ id: `rel:${characterId}:voiceprint`, from: characterId, to: voiceId, type: "has-voiceprint", confidence: 1, status: "approved" });
  }

  add("world", "world", "World", project.world);
  for (const location of project.world.locations) add("locations", "location", text(location.name) || location.id, location);
  add("timeline", "period", "Story Period", project.world.period);
  add("timeline", "history", "World History", project.world.history);
  add("continuity", "notes", "Continuity Notes", project.development.notes.continuity);
  add("research", "notes", "Research Notes", project.development.notes.research, "reviewed");
  add("references", "sources", "Reference Sources", project.development.notes.sources, "reviewed");
  add("legal", "rights", "Rights and Ownership", project.rights, "locked");
  add("visual-style", "storyboard-style", "Visual Style", { visualLanguage: project.world.visualLanguage, frames: project.blocks.flatMap((block) => block.visuals) });
  add("ai-decisions", "decision-log", "AI Decisions", project.rights.aiProvenance, project.rights.aiProvenance.length ? "reviewed" : "draft", { type: "ai" });
  add("meeting-notes", "notes", "Meeting Notes", [], "draft", { type: "meeting" });
  add("producer-notes", "notes", "Producer Notes", [], "draft");
  add("director-notes", "notes", "Director Notes", [], "draft");
  add("actor-notes", "notes", "Actor Notes", [], "draft");

  for (const block of project.blocks) {
    for (const scene of block.scenes) {
      for (const characterId of scene.characterIds) {
        const canonical = Object.values(entries).find((entry) => entry.section === "characters" && String((entry.value as { id?: unknown })?.id) === characterId);
        if (canonical) relationships.push({ id: `rel:${canonical.id}:scene:${scene.id}`, from: canonical.id, to: `scene:${scene.id}`, type: "appears-in", confidence: 1, status: "approved" });
      }
      for (const locationId of scene.locationIds) {
        const canonical = Object.values(entries).find((entry) => entry.section === "locations" && String((entry.value as { id?: unknown })?.id) === locationId);
        if (canonical) relationships.push({ id: `rel:${canonical.id}:scene:${scene.id}`, from: canonical.id, to: `scene:${scene.id}`, type: "used-in", confidence: 1, status: "approved" });
      }
    }
  }

  const conflicts: CanonConflict[] = [];
  const characterNames = new Map<string, string[]>();
  for (const entry of Object.values(entries).filter((item) => item.section === "characters")) {
    const key = entry.title.toLowerCase();
    characterNames.set(key, [...(characterNames.get(key) ?? []), entry.id]);
  }
  for (const [name, ids] of characterNames) if (ids.length > 1) conflicts.push({ id: `canon-conflict:duplicate-character:${slug(name, "character")}`, severity: "warning", message: `Multiple canon character entries use the name ${name}.`, entryIds: ids, suggestedAction: "Merge the duplicate entries or assign distinct canonical names." });

  const approved = Object.values(entries).filter((entry) => entry.status === "approved" || entry.status === "locked").length;
  const locked = Object.values(entries).filter((entry) => entry.status === "locked").length;
  const unreviewed = Object.values(entries).length - approved;
  const score = Math.max(0, Math.round(100 - conflicts.length * 10 - unreviewed * 1.5));
  return { version: CANON_BINDER_VERSION, generatedAt, policy: "approved-only", sections: sectionIndex, entries, relationships, conflicts, health: { score, approved, unreviewed, locked, conflicts: conflicts.length } };
}

export function queryCanon(binder: CanonBinder, options: { sections?: CanonSection[]; statuses?: CanonStatus[]; tags?: string[]; text?: string } = {}) {
  const needle = options.text?.trim().toLowerCase();
  return Object.values(binder.entries).filter((entry) => {
    if (options.sections?.length && !options.sections.includes(entry.section)) return false;
    if (options.statuses?.length && !options.statuses.includes(entry.status)) return false;
    if (options.tags?.length && !options.tags.some((tag) => entry.tags.includes(tag))) return false;
    return !needle || `${entry.title} ${entry.kind} ${JSON.stringify(entry.value)}`.toLowerCase().includes(needle);
  });
}

export function canonContextPacket(binder: CanonBinder, entryIds: string[], includeRelated = true) {
  const ids = new Set(entryIds);
  if (includeRelated) for (const relationship of binder.relationships) if (ids.has(relationship.from) || ids.has(relationship.to)) { ids.add(relationship.from); ids.add(relationship.to); }
  const entries = [...ids].map((id) => binder.entries[id]).filter((entry): entry is CanonEntry => Boolean(entry)).filter((entry) => entry.status === "approved" || entry.status === "locked");
  return { binderVersion: binder.version, generatedAt: binder.generatedAt, policy: binder.policy, entries, relationships: binder.relationships.filter((relationship) => ids.has(relationship.from) && ids.has(relationship.to)) };
}
