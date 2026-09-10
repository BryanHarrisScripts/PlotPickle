import {
  DEMO_ALLOWED_CAPABILITIES,
  DEMO_FORBIDDEN_CAPABILITIES,
  assertDemoCapability,
} from "../../../core/demo-onboarding/demo-boundary.mjs";
import {
  assertStoryDemoSyntheticRefs,
  projectStoryDemoKnowledge,
} from "./world.mjs";

export const DEMO_SHOW_ME_VIEWS = Object.freeze([
  "change",
  "knowledge",
  "relationships",
  "authority",
]);

const consequenceLabels = Object.freeze({
  "move-character": "location changed",
  "grant-knowledge": "private knowledge changed",
  "adjust-relationship": "relationship changed",
  "transfer-object": "object custody changed",
  "resolve-thread": "story thread resolved",
  "open-thread": "new story thread opened",
  "adjust-number": "turn advanced",
});

const knownLabels = Object.freeze({
  "demo:knowledge:lantern-flickers-near-truth": "Lantern flickers near truth",
  "demo:knowledge:gate-name": "The gate's name",
  "demo:location:lantern-road": "Lantern road",
  "demo:location:fork": "The fork",
  "demo:location:ridge": "The ridge",
  "demo:location:archive": "The archive",
  "demo:location:archive-door": "Archive door",
  "demo:location:unwritten-door": "The unwritten door",
  "demo:thread:unwritten-door": "The unwritten door",
  "demo:thread:second-journey": "A second journey",
});

function words(value) {
  return String(value || "unknown").replace(/^demo:[^:]+:/u, "").replaceAll("-", " ");
}

function labelRef(value) {
  const ref = String(value || "");
  if (knownLabels[ref]) return knownLabels[ref];
  const text = words(ref);
  return text ? text.replace(/^./u, (letter) => letter.toUpperCase()) : "Unknown";
}

function decisionLabel(world, decisionId) {
  for (const scene of world.scenario.scenes) {
    const decision = scene.decisions.find((item) => item.id === decisionId);
    if (decision) return decision.label;
  }
  return "Prepared decision";
}

function publicKnowledge(world) {
  return projectStoryDemoKnowledge(world, "demo:viewer:audience");
}

function privateKnowledge(world, characterRef) {
  const shared = new Set(publicKnowledge(world));
  return projectStoryDemoKnowledge(world, characterRef).filter((ref) => !shared.has(ref));
}

function stateSnapshot(world) {
  return Object.freeze({
    "Mara location": labelRef(world.state.characterLocations["demo:character:mara"]),
    "Mara and Rowan": String(world.state.relationships["demo:relationship:mara-rowan"] ?? 0),
    "Brass key": labelRef(world.state.objectCustody["demo:object:brass-key"]),
    "Mara private knowledge": privateKnowledge(world, "demo:character:mara").map(labelRef).join(", ") || "none",
    "Rowan private knowledge": privateKnowledge(world, "demo:character:rowan").map(labelRef).join(", ") || "none",
    "Open story threads": [...world.state.openThreads].map(labelRef).join(", ") || "none",
  });
}

function changeProjection(world, previousWorld) {
  const latest = world.decisionHistory.at(-1) || null;
  if (!latest) {
    return Object.freeze({
      kind: "change",
      title: "Nothing has changed yet",
      summary: "Make a story decision and I’ll show the smallest useful before-and-after view of what STORY actually changed.",
      changes: Object.freeze([]),
    });
  }

  const before = stateSnapshot(previousWorld || world);
  const after = stateSnapshot(world);
  const changes = Object.freeze(Object.keys(after)
    .filter((label) => before[label] !== after[label])
    .map((label) => Object.freeze({ label, before: before[label], after: after[label] })));
  const visibleConsequences = latest.consequenceKinds
    .filter((kind) => kind !== "adjust-number")
    .map((kind) => consequenceLabels[kind] || words(kind));

  return Object.freeze({
    kind: "change",
    title: `You chose “${decisionLabel(world, latest.decisionId)}”`,
    summary: changes.length
      ? `STORY resolved ${visibleConsequences.join(" and ") || "the decision"}. Here is the state that actually moved.`
      : "STORY accepted the decision, but none of the visible demo signals changed.",
    changes,
  });
}

function knowledgeProjection(world) {
  const shared = publicKnowledge(world).map(labelRef);
  const mara = privateKnowledge(world, "demo:character:mara").map(labelRef);
  const rowan = privateKnowledge(world, "demo:character:rowan").map(labelRef);
  return Object.freeze({
    kind: "knowledge",
    title: "Who knows what",
    summary: "STORY keeps shared knowledge separate from character-private knowledge, so a secret does not become true for everyone just because the audience can see the story.",
    groups: Object.freeze([
      Object.freeze({ title: "Shared audience knowledge", items: Object.freeze(shared) }),
      Object.freeze({ title: "Mara only", items: Object.freeze(mara) }),
      Object.freeze({ title: "Rowan only", items: Object.freeze(rowan) }),
    ]),
  });
}

function relationshipProjection(world) {
  const relationship = Number(world.state.relationships["demo:relationship:mara-rowan"] || 0);
  const custody = String(world.state.objectCustody["demo:object:brass-key"] || "");
  const custodyRelation = custody.startsWith("demo:character:") ? "is held by" : "rests at";
  return Object.freeze({
    kind: "relationships",
    title: "Current story map",
    summary: "These links are a read-only picture of current STORY state: where the characters are, where the key is, and how Mara and Rowan currently relate.",
    edges: Object.freeze([
      Object.freeze({ from: "Mara", relation: "is at", to: labelRef(world.state.characterLocations["demo:character:mara"]) }),
      Object.freeze({ from: "Rowan", relation: "is at", to: labelRef(world.state.characterLocations["demo:character:rowan"]) }),
      Object.freeze({ from: "Brass key", relation: custodyRelation, to: labelRef(custody) }),
      Object.freeze({ from: "Mara", relation: `relationship ${relationship >= 0 ? "+" : ""}${relationship}`, to: "Rowan" }),
    ]),
  });
}

function includesAll(values, required) {
  return required.every((value) => values.includes(value));
}

function authorityProjection(world) {
  const allowed = world.boundary.allowedCapabilities || DEMO_ALLOWED_CAPABILITIES;
  const forbidden = DEMO_FORBIDDEN_CAPABILITIES;
  const storyAllowed = includesAll(allowed, ["story.synthetic.read", "story.synthetic.propose", "story.synthetic.resolve", "story.synthetic.reset"]);
  const sageReadOnly = allowed.includes("sage.explain.read")
    && !allowed.some((capability) => capability.startsWith("sage.") && capability !== "sage.explain.read");
  const privateBlocked = includesAll(forbidden, ["profile.read", "profile.write", "project.private.read", "project.private.write"]);
  const canonBlocked = includesAll(forbidden, ["ppf.canon.read-private", "ppf.canon.write"]);
  const connectedBlocked = includesAll(forbidden, ["buzz.private.read", "provider.credentials.read", "connector.github", "connector.google"]);
  const agentBlocked = includesAll(forbidden, ["agent.install-skill", "agent.grant-authority"]);

  return Object.freeze({
    kind: "authority",
    title: "What this DEMO is allowed to touch",
    summary: "DEMO can resolve its synthetic STORY world and let me explain it. Human-private state, real canon, connected services and agent authority stay outside this boundary.",
    boundaries: Object.freeze([
      Object.freeze({ area: "Synthetic STORY world", status: storyAllowed ? "allowed" : "blocked", detail: "Read, choose, resolve and reset the prepared demo only." }),
      Object.freeze({ area: "Sage Show Me", status: sageReadOnly ? "read-only" : "blocked", detail: "Explain the current projection without changing it." }),
      Object.freeze({ area: "Human profiles and projects", status: privateBlocked ? "blocked" : "review", detail: "No private Human profile or project access." }),
      Object.freeze({ area: "Real PPF canon", status: canonBlocked ? "blocked" : "review", detail: "No private canon reads and no canon writes." }),
      Object.freeze({ area: "BUZZ, providers and connectors", status: connectedBlocked ? "blocked" : "review", detail: "No private BUZZ context, credentials, GitHub or Google." }),
      Object.freeze({ area: "Agent authority", status: agentBlocked ? "blocked" : "review", detail: "No skill installation or authority grants." }),
    ]),
  });
}

export function createStoryDemoShowMe(world, { view = "change", previousWorld = null } = {}) {
  assertStoryDemoSyntheticRefs(world);
  assertDemoCapability("sage.explain.read");
  if (previousWorld) assertStoryDemoSyntheticRefs(previousWorld);
  if (!DEMO_SHOW_ME_VIEWS.includes(view)) {
    const error = new Error(`Unsupported DEMO Show Me view: ${String(view)}`);
    error.code = "DEMO_SHOW_ME_VIEW_UNSUPPORTED";
    throw error;
  }
  if (view === "knowledge") return knowledgeProjection(world);
  if (view === "relationships") return relationshipProjection(world);
  if (view === "authority") return authorityProjection(world);
  return changeProjection(world, previousWorld);
}
