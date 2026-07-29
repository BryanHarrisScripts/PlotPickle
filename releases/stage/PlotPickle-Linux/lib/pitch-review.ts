import {
  cloneProject,
  createBlankComicPitchDeck,
  type LoglineCandidate,
  type PitchPackage,
  type PlotPickleProject,
  type ReviewAnchor,
  type ReviewComment,
  type ReviewPriority,
  type ReviewThread,
  type ReviewThreadStatus,
  type RevisionSnapshot,
} from "./project";

export type LoglineWorkshopAnswers = {
  protagonist: string;
  identity: string;
  disruption: string;
  goal: string;
  opposition: string;
  stakes: string;
  distinction: string;
};

export type RevisionReviewComparison = {
  leftId: string;
  rightId: string;
  leftLabel: string;
  rightLabel: string;
  changedSections: string[];
  addedKeys: string[];
  removedKeys: string[];
  summary: string;
};

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function timestamp() {
  return new Date().toISOString();
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "plotpickle-pitch";
}

function defaultPitchPackage(project: PlotPickleProject): PitchPackage {
  return {
    title: project.metadata.title,
    subtitle: project.metadata.subtitle,
    tagline: project.story.hook,
    logline: project.story.logline,
    synopsis: project.development.pitch.shortPitch || project.story.premise,
    creatorStatement: project.story.notes,
    audience: project.development.storySetup.audience,
    comparableTitles: project.development.pitch.comparableTitles,
    visualStatement: project.development.pitch.visualVision || project.world.visualLanguage,
    contactLine: project.rights.projectOwner,
    selectedCharacterIds: project.characters.slice(0, 6).map((character) => character.id),
    selectedLocationIds: project.world.locations.slice(0, 6).map((location) => location.id),
    includeSections: ["cover", "logline", "synopsis", "characters", "world", "visuals", "creator", "rights"],
    comicDeck: createBlankComicPitchDeck(),
    updatedAt: timestamp(),
  };
}

export function createDefaultReviewWorkspace(project: PlotPickleProject) {
  return {
    threads: [] as ReviewThread[],
    loglineCandidates: [] as LoglineCandidate[],
    pitchPackage: defaultPitchPackage(project),
  };
}

export function ensureReviewWorkspace(project: PlotPickleProject): PlotPickleProject {
  if (project.review) return project;
  return { ...project, review: createDefaultReviewWorkspace(project) };
}

export function createReviewThread(
  project: PlotPickleProject,
  input: {
    title: string;
    body: string;
    author: string;
    anchor: ReviewAnchor;
    priority?: ReviewPriority;
  },
): PlotPickleProject {
  const next = cloneProject(ensureReviewWorkspace(project));
  const now = timestamp();
  const comment: ReviewComment = {
    id: makeId("review-comment"),
    author: text(input.author) || "Local reviewer",
    body: text(input.body),
    createdAt: now,
  };
  const thread: ReviewThread = {
    id: makeId("review-thread"),
    title: text(input.title) || "Review note",
    anchor: input.anchor,
    status: "open",
    priority: input.priority || "normal",
    comments: [comment],
    createdAt: now,
    updatedAt: now,
    resolvedAt: "",
  };
  next.review.threads.push(thread);
  next.metadata.updatedAt = now;
  return next;
}

export function addReviewComment(project: PlotPickleProject, threadId: string, author: string, body: string): PlotPickleProject {
  if (!text(body)) return project;
  const next = cloneProject(ensureReviewWorkspace(project));
  const now = timestamp();
  next.review.threads = next.review.threads.map((thread) => thread.id === threadId ? {
    ...thread,
    comments: [...thread.comments, { id: makeId("review-comment"), author: text(author) || "Local reviewer", body: text(body), createdAt: now }],
    updatedAt: now,
  } : thread);
  next.metadata.updatedAt = now;
  return next;
}

export function updateReviewThreadStatus(project: PlotPickleProject, threadId: string, status: ReviewThreadStatus): PlotPickleProject {
  const next = cloneProject(ensureReviewWorkspace(project));
  const now = timestamp();
  next.review.threads = next.review.threads.map((thread) => thread.id === threadId ? {
    ...thread,
    status,
    updatedAt: now,
    resolvedAt: status === "resolved" ? now : "",
  } : thread);
  next.metadata.updatedAt = now;
  return next;
}

export function removeReviewThread(project: PlotPickleProject, threadId: string): PlotPickleProject {
  const next = cloneProject(ensureReviewWorkspace(project));
  next.review.threads = next.review.threads.filter((thread) => thread.id !== threadId);
  next.metadata.updatedAt = timestamp();
  return next;
}

export function buildGuidedLoglineCandidate(project: PlotPickleProject, answers: LoglineWorkshopAnswers): string {
  const protagonist = text(answers.protagonist) || text(project.development.foundations.protagonist) || "A protagonist";
  const identity = text(answers.identity);
  const disruption = text(answers.disruption) || text(project.story.catalyst);
  const goal = text(answers.goal) || text(project.development.foundations.objective);
  const opposition = text(answers.opposition) || text(project.development.foundations.opposition);
  const stakes = text(answers.stakes) || text(project.story.stakes);
  const distinction = text(answers.distinction) || text(project.development.pickle.signatureMove);
  const lead = identity ? `${protagonist}, ${identity},` : protagonist;
  const trigger = disruption ? `after ${disruption}` : "when their world is disrupted";
  const mission = goal ? `must ${goal}` : "must pursue an urgent goal";
  const obstacle = opposition ? `while facing ${opposition}` : "against escalating opposition";
  const consequence = stakes ? `before ${stakes}` : "before the cost becomes irreversible";
  const signature = distinction ? `—in a story distinguished by ${distinction}.` : ".";
  return `${lead} ${trigger}, ${mission} ${obstacle} ${consequence}${signature}`.replace(/\s+/g, " ").trim();
}

export function saveLoglineCandidate(project: PlotPickleProject, textValue: string, source = "Guided workshop"): PlotPickleProject {
  const candidateText = text(textValue);
  if (!candidateText) return project;
  const next = cloneProject(ensureReviewWorkspace(project));
  next.review.loglineCandidates.push({ id: makeId("logline"), text: candidateText, source, selected: false, createdAt: timestamp() });
  return next;
}

export function approveLoglineCandidate(project: PlotPickleProject, candidateId: string): PlotPickleProject {
  const next = cloneProject(ensureReviewWorkspace(project));
  const candidate = next.review.loglineCandidates.find((item) => item.id === candidateId);
  if (!candidate) return project;
  next.review.loglineCandidates = next.review.loglineCandidates.map((item) => ({ ...item, selected: item.id === candidateId }));
  next.story.logline = candidate.text;
  next.development.pitch.oneSentence = candidate.text;
  next.review.pitchPackage.logline = candidate.text;
  next.review.pitchPackage.updatedAt = timestamp();
  next.metadata.updatedAt = timestamp();
  return next;
}

export function updatePitchPackage(project: PlotPickleProject, patch: Partial<PitchPackage>): PlotPickleProject {
  const next = cloneProject(ensureReviewWorkspace(project));
  next.review.pitchPackage = { ...next.review.pitchPackage, ...patch, updatedAt: timestamp() };
  next.metadata.updatedAt = timestamp();
  return next;
}

function flattenObject(value: unknown, prefix = ""): Map<string, string> {
  const output = new Map<string, string>();
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenObject(item, `${prefix}[${index}]`).forEach((entry, key) => output.set(key, entry)));
  } else if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenObject(item, nextPrefix).forEach((entry, itemKey) => output.set(itemKey, entry));
    });
  } else {
    output.set(prefix || "value", JSON.stringify(value));
  }
  return output;
}

export function compareRevisionSnapshotsForReview(left: RevisionSnapshot, right: RevisionSnapshot): RevisionReviewComparison {
  const leftMap = flattenObject(left.payload);
  const rightMap = flattenObject(right.payload);
  const changedKeys = [...rightMap.keys()].filter((key) => leftMap.has(key) && leftMap.get(key) !== rightMap.get(key));
  const addedKeys = [...rightMap.keys()].filter((key) => !leftMap.has(key));
  const removedKeys = [...leftMap.keys()].filter((key) => !rightMap.has(key));
  const changedSections = [...new Set([...changedKeys, ...addedKeys, ...removedKeys].map((key) => key.split(/[.[]/)[0]).filter(Boolean))];
  return {
    leftId: left.id,
    rightId: right.id,
    leftLabel: left.label,
    rightLabel: right.label,
    changedSections,
    addedKeys,
    removedKeys,
    summary: `${changedKeys.length} changed values, ${addedKeys.length} additions and ${removedKeys.length} removals across ${changedSections.length} project sections.`,
  };
}

function selectedCharacters(project: PlotPickleProject) {
  const ids = new Set(project.review?.pitchPackage.selectedCharacterIds ?? []);
  return project.characters.filter((character) => ids.has(character.id));
}

function selectedLocations(project: PlotPickleProject) {
  const ids = new Set(project.review?.pitchPackage.selectedLocationIds ?? []);
  return project.world.locations.filter((location) => ids.has(location.id));
}

export function buildPitchPackageHtml(projectInput: PlotPickleProject): string {
  const project = ensureReviewWorkspace(projectInput);
  const pitch = project.review.pitchPackage;
  const characters = selectedCharacters(project);
  const locations = selectedLocations(project);
  const sections = new Set(pitch.includeSections);
  const characterHtml = characters.map((character) => `<article><h3>${escapeHtml(character.name)}</h3><p><strong>${escapeHtml(character.role)}</strong></p><p>${escapeHtml(character.description || character.want || character.arc)}</p></article>`).join("");
  const locationHtml = locations.map((location) => `<article><h3>${escapeHtml(location.name)}</h3><p>${escapeHtml(location.description)}</p></article>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(pitch.title)} — Pitch Package</title><style>body{font-family:Arial,sans-serif;margin:0;color:#183633;background:#f5fbfa}main{max-width:980px;margin:auto;padding:48px}section{background:#fff;border:1px solid #cfe2df;border-radius:18px;padding:32px;margin:0 0 24px}h1{font-size:54px;margin:0 0 8px}h2{font-size:28px;margin-top:0;color:#17685f}.tagline{font-size:22px;color:#4f706c}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}article{border:1px solid #dceae8;border-radius:14px;padding:18px}footer{color:#58736f;font-size:12px}@media print{body{background:#fff}main{padding:0}section{break-inside:avoid;border:0;border-radius:0;border-bottom:1px solid #ddd}}</style></head><body><main>${sections.has("cover") ? `<section><p>PlotPickle Pitch Package</p><h1>${escapeHtml(pitch.title)}</h1><h2>${escapeHtml(pitch.subtitle)}</h2><p class="tagline">${escapeHtml(pitch.tagline)}</p><p>${escapeHtml(project.metadata.genre)} · ${escapeHtml(project.metadata.format)} · ${project.metadata.targetMinutes} minutes</p></section>` : ""}${sections.has("logline") ? `<section><h2>Logline</h2><p>${escapeHtml(pitch.logline)}</p></section>` : ""}${sections.has("synopsis") ? `<section><h2>Synopsis</h2><p>${escapeHtml(pitch.synopsis)}</p></section>` : ""}${sections.has("characters") ? `<section><h2>Characters</h2><div class="grid">${characterHtml || "<p>No characters selected.</p>"}</div></section>` : ""}${sections.has("world") ? `<section><h2>World</h2><p>${escapeHtml(project.world.ordinaryWorld)}</p><div class="grid">${locationHtml}</div></section>` : ""}${sections.has("visuals") ? `<section><h2>Visual Direction</h2><p>${escapeHtml(pitch.visualStatement)}</p></section>` : ""}${sections.has("creator") ? `<section><h2>Creator Statement</h2><p>${escapeHtml(pitch.creatorStatement)}</p><p><strong>Audience:</strong> ${escapeHtml(pitch.audience)}</p><p><strong>Comparable titles:</strong> ${escapeHtml(pitch.comparableTitles)}</p></section>` : ""}${sections.has("rights") ? `<section><h2>Rights and Contact</h2><p>${escapeHtml(project.rights.rightsStatement)}</p><p>${escapeHtml(project.rights.copyrightNotice)}</p><p>${escapeHtml(pitch.contactLine)}</p></section>` : ""}<footer>Generated locally by PlotPickle. The writer retains the rights they hold in this project.</footer></main></body></html>`;
}

export function buildPresentationMarkdown(projectInput: PlotPickleProject): string {
  const project = ensureReviewWorkspace(projectInput);
  const pitch = project.review.pitchPackage;
  const characters = selectedCharacters(project);
  const locations = selectedLocations(project);
  return [
    `# ${pitch.title}`,
    `## ${pitch.subtitle}`,
    pitch.tagline,
    "---",
    "# Logline",
    pitch.logline,
    "---",
    "# Story Promise",
    pitch.synopsis,
    "---",
    "# Main Characters",
    ...characters.flatMap((character) => [`## ${character.name} — ${character.role}`, character.description || character.want || character.arc]),
    "---",
    "# World and Locations",
    project.world.ordinaryWorld,
    ...locations.flatMap((location) => [`## ${location.name}`, location.description]),
    "---",
    "# Visual Direction",
    pitch.visualStatement,
    "---",
    "# Audience and Positioning",
    `Audience: ${pitch.audience}`,
    `Comparable titles: ${pitch.comparableTitles}`,
    "---",
    "# Creator Statement",
    pitch.creatorStatement,
    "---",
    "# Rights and Contact",
    project.rights.rightsStatement,
    project.rights.copyrightNotice,
    pitch.contactLine,
  ].filter(Boolean).join("\n\n");
}

export function pitchExportFileNames(project: PlotPickleProject) {
  const base = slug(project.review?.pitchPackage.title || project.metadata.title);
  return { html: `${base}-pitch-package.html`, presentation: `${base}-pitch-deck.md` };
}
