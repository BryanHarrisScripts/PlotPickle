import type { PlotPickleProject } from "./project";
import { buildStoryDependencies, type StoryConflict, type StoryEdge, type StoryNode } from "./story-dependencies";
import { createMiniBlockWallModel, type MiniBlockWallCard } from "./mini-block-wall";

export const STORYWORLD_MAP_LAYOUT_EXTENSION = "plotpickle.storyworld-map-layout" as const;
export const STORYWORLD_MAP_LAYOUT_VERSION = 1 as const;

export type StoryworldMapMode = "wall" | "map" | "table";
export type StoryworldMapGranularity = "movie" | "act" | "sequence" | "block" | "scene" | "mini-block" | "production-shot";
export type StoryworldMapOverlay =
  | "causality"
  | "hooks-turns"
  | "characters"
  | "threads"
  | "setup-payoff"
  | "location-time"
  | "visual-continuity"
  | "render-readiness"
  | "warnings";

export type StoryworldMapConnection = {
  id: string;
  fromMiniBlockId: string;
  toMiniBlockId: string;
  overlay: StoryworldMapOverlay;
  label: string;
  evidence: string;
  sourceNodeIds: string[];
  source: "explicit" | "derived";
  severity: "info" | "warning" | "critical";
};

export type StoryworldMapMarker = {
  id: string;
  miniBlockId: string;
  overlay: StoryworldMapOverlay;
  label: string;
  evidence: string;
  nodeIds: string[];
  severity: "info" | "warning" | "critical";
};

export type StoryworldMapSharedLayout = {
  version: typeof STORYWORLD_MAP_LAYOUT_VERSION;
  mode: Exclude<StoryworldMapMode, "table">;
  granularity: StoryworldMapGranularity;
  overlays: StoryworldMapOverlay[];
  emphasizedNodeIds: string[];
  updatedAt: string;
};

export type StoryworldMapModel = {
  cards: MiniBlockWallCard[];
  connections: StoryworldMapConnection[];
  markers: StoryworldMapMarker[];
  nodes: StoryNode[];
  edges: StoryEdge[];
  conflicts: StoryConflict[];
  sharedLayout: StoryworldMapSharedLayout | null;
  summary: {
    connections: number;
    warnings: number;
    critical: number;
    renderReady: number;
    hooksAndTurns: number;
  };
};

export const DEFAULT_STORYWORLD_MAP_OVERLAYS: StoryworldMapOverlay[] = ["causality", "hooks-turns", "setup-payoff", "warnings"];
export const STORYWORLD_MAP_OVERLAYS: Array<{
  id: StoryworldMapOverlay;
  label: string;
  symbol: string;
}> = [
  { id: "causality", label: "Causality", symbol: "→" },
  { id: "hooks-turns", label: "Hooks and turns", symbol: "◆" },
  { id: "characters", label: "Character arcs", symbol: "●" },
  { id: "threads", label: "Story threads", symbol: "≋" },
  { id: "setup-payoff", label: "Setup and payoff", symbol: "↔" },
  { id: "location-time", label: "Location and time", symbol: "⌖" },
  { id: "visual-continuity", label: "Visual continuity", symbol: "◇" },
  { id: "render-readiness", label: "Render readiness", symbol: "▣" },
  { id: "warnings", label: "Warnings", symbol: "!" },
];
const ALL_OVERLAYS: StoryworldMapOverlay[] = [
  "causality",
  "hooks-turns",
  "characters",
  "threads",
  "setup-payoff",
  "location-time",
  "visual-continuity",
  "render-readiness",
  "warnings",
];

export type StoryworldMapItem = {
  id: string;
  canonicalId: string;
  kind: StoryworldMapGranularity;
  label: string;
  context: string;
  act: number;
  blockNumber: number;
  miniBlockIds: string[];
  shotId: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function strings(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))] : [];
}

function clean(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function addConnection(connections: StoryworldMapConnection[], value: StoryworldMapConnection) {
  if (!value.fromMiniBlockId || !value.toMiniBlockId || value.fromMiniBlockId === value.toMiniBlockId) return;
  if (!connections.some((item) => item.id === value.id)) connections.push(value);
}

function addSeriesConnections(
  connections: StoryworldMapConnection[],
  cards: MiniBlockWallCard[],
  overlay: StoryworldMapOverlay,
  label: string,
  evidence: (left: MiniBlockWallCard, right: MiniBlockWallCard) => string,
) {
  const ordered = [...cards].sort((left, right) => left.globalNumber - right.globalNumber);
  for (let index = 1; index < ordered.length; index += 1) {
    const left = ordered[index - 1];
    const right = ordered[index];
    addConnection(connections, {
      id: `${overlay}:${left.id}:${right.id}`,
      fromMiniBlockId: left.id,
      toMiniBlockId: right.id,
      overlay,
      label,
      evidence: evidence(left, right),
      sourceNodeIds: [left.id, right.id],
      source: "derived",
      severity: "info",
    });
  }
}

function cardByGraphNode(cards: MiniBlockWallCard[], nodes: StoryNode[]) {
  const result = new Map<string, MiniBlockWallCard>();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const cardById = new Map(cards.map((card) => [card.id, card]));
  for (const card of cards) {
    result.set(card.id, card);
    result.set(card.sceneId, card);
    result.set(card.blockId, card);
    card.screenplayElementIds.forEach((id) => result.set(id, card));
    card.shotIds.forEach((id) => result.set(id, card));
    if (card.frame?.id) result.set(card.frame.id, card);
  }
  for (const node of nodes) {
    const ownerId = typeof node.metadata?.ownerId === "string" ? node.metadata.ownerId : "";
    if (ownerId && result.has(ownerId)) result.set(node.id, result.get(ownerId)!);
    if (node.kind === "production-shot") {
      const blockNumber = Number(node.metadata?.blockNumber);
      const miniBlockNumber = Number(node.metadata?.miniBlockNumber);
      const card = cards.find((candidate) => candidate.blockNumber === blockNumber && candidate.number === miniBlockNumber);
      if (card) result.set(node.id, card);
    }
    if (node.kind === "arc-checkpoint") {
      const blockNumber = Number(node.metadata?.blockNumber);
      const card = cards.find((candidate) => candidate.blockNumber === blockNumber);
      if (card) result.set(node.id, card);
    }
    if (!result.has(node.id) && ownerId && nodeById.has(ownerId) && cardById.has(ownerId)) result.set(node.id, cardById.get(ownerId)!);
  }
  return result;
}

function warningMarkers(cards: MiniBlockWallCard[], conflicts: StoryConflict[], nodeCards: Map<string, MiniBlockWallCard>) {
  const markers: StoryworldMapMarker[] = [];
  for (const conflict of conflicts) {
    const card = conflict.nodeIds.map((id) => nodeCards.get(id)).find(Boolean);
    if (!card) continue;
    markers.push({
      id: conflict.id,
      miniBlockId: card.id,
      overlay: "warnings",
      label: conflict.type.replaceAll("-", " "),
      evidence: `${conflict.message} ${conflict.suggestedAction}`.trim(),
      nodeIds: conflict.nodeIds,
      severity: conflict.severity,
    });
  }
  for (const card of cards) {
    if (card.turn || card.revelation) markers.push({
      id: `turn:${card.id}`,
      miniBlockId: card.id,
      overlay: "hooks-turns",
      label: "Turn",
      evidence: card.turn || card.revelation,
      nodeIds: [card.id],
      severity: "info",
    });
    if (card.globalNumber === 1 && (card.purpose || card.function)) markers.push({
      id: `hook:${card.id}`,
      miniBlockId: card.id,
      overlay: "hooks-turns",
      label: "Opening hook",
      evidence: card.purpose || card.function,
      nodeIds: [card.id],
      severity: "info",
    });
    if (card.frame?.src || card.shotIds.length) markers.push({
      id: `render:${card.id}`,
      miniBlockId: card.id,
      overlay: "render-readiness",
      label: card.frame?.src && card.shotIds.length ? "Render context ready" : "Render context partial",
      evidence: `${card.frame?.src ? "Storyboard frame linked." : "Storyboard frame missing."} ${card.shotIds.length} production shot(s).`,
      nodeIds: [card.id, ...(card.frame?.id ? [card.frame.id] : []), ...card.shotIds],
      severity: card.frame?.src && card.shotIds.length ? "info" : "warning",
    });
    if (card.frame?.continuity) markers.push({
      id: `continuity:${card.id}`,
      miniBlockId: card.id,
      overlay: "visual-continuity",
      label: "Continuity lock",
      evidence: card.frame.continuity,
      nodeIds: [card.id, card.frame.id],
      severity: "info",
    });
  }
  return markers;
}

export function readStoryworldMapSharedLayout(project: PlotPickleProject): StoryworldMapSharedLayout | null {
  const extensions = record(project.extensions);
  const candidate = record(extensions[STORYWORLD_MAP_LAYOUT_EXTENSION]);
  if (candidate.version !== STORYWORLD_MAP_LAYOUT_VERSION) return null;
  const mode = candidate.mode === "map" ? "map" : "wall";
  const granularities: StoryworldMapGranularity[] = ["movie", "act", "sequence", "block", "scene", "mini-block", "production-shot"];
  const granularity = granularities.includes(candidate.granularity as StoryworldMapGranularity)
    ? candidate.granularity as StoryworldMapGranularity
    : "mini-block";
  const overlays = strings(candidate.overlays).filter((item): item is StoryworldMapOverlay => ALL_OVERLAYS.includes(item as StoryworldMapOverlay));
  return {
    version: STORYWORLD_MAP_LAYOUT_VERSION,
    mode,
    granularity,
    overlays: overlays.length ? overlays : DEFAULT_STORYWORLD_MAP_OVERLAYS,
    emphasizedNodeIds: strings(candidate.emphasizedNodeIds),
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
  };
}

export function saveStoryworldMapSharedLayout(
  project: PlotPickleProject,
  layout: Omit<StoryworldMapSharedLayout, "version" | "updatedAt">,
): PlotPickleProject {
  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: new Date().toISOString() },
    extensions: {
      ...record(project.extensions),
      [STORYWORLD_MAP_LAYOUT_EXTENSION]: {
        version: STORYWORLD_MAP_LAYOUT_VERSION,
        mode: layout.mode,
        granularity: layout.granularity,
        overlays: [...new Set(layout.overlays)],
        emphasizedNodeIds: [...new Set(layout.emphasizedNodeIds)],
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

export function createStoryworldMapModel(project: PlotPickleProject): StoryworldMapModel {
  const wall = createMiniBlockWallModel(project);
  const index = buildStoryDependencies(project);
  const cards = wall.cards;
  const nodeCards = cardByGraphNode(cards, index.graph.nodes);
  const connections: StoryworldMapConnection[] = [];

  addSeriesConnections(connections, cards, "causality", "Story movement", (left, right) => {
    const cause = left.turn || left.action || left.purpose || `Mini-block ${left.globalNumber}`;
    const effect = right.objective || right.action || right.purpose || `Mini-block ${right.globalNumber}`;
    return `${cause} leads into ${effect}`;
  });

  project.characters.forEach((character) => addSeriesConnections(
    connections,
    cards.filter((card) => card.characterId === character.id),
    "characters",
    `${character.name || "Character"} arc`,
    (left, right) => `${character.name || "Character"} moves from ${left.turn || left.action || left.purpose || `mini-block ${left.globalNumber}`} to ${right.objective || right.action || right.purpose || `mini-block ${right.globalNumber}`}.`,
  ));
  project.storyThreads.forEach((thread) => addSeriesConnections(
    connections,
    cards.filter((card) => card.storylineIds.includes(thread.id)),
    "threads",
    thread.name,
    (left, right) => `${thread.name} continues from mini-block ${left.globalNumber} to ${right.globalNumber}.`,
  ));
  project.world.locations.forEach((location) => addSeriesConnections(
    connections,
    cards.filter((card) => card.locationIds.includes(location.id)),
    "location-time",
    location.name,
    (left, right) => `${location.name} recurs from mini-block ${left.globalNumber} to ${right.globalNumber} in presentation order.`,
  ));

  const setups = new Map<string, MiniBlockWallCard[]>();
  const payoffs = new Map<string, MiniBlockWallCard[]>();
  cards.forEach((card) => {
    if (clean(card.setup)) setups.set(clean(card.setup), [...(setups.get(clean(card.setup)) ?? []), card]);
    if (clean(card.payoff)) payoffs.set(clean(card.payoff), [...(payoffs.get(clean(card.payoff)) ?? []), card]);
  });
  setups.forEach((setupCards, key) => {
    const payoffCards = payoffs.get(key) ?? [];
    setupCards.forEach((setup) => payoffCards.forEach((payoff) => addConnection(connections, {
      id: `setup-payoff:${setup.id}:${payoff.id}`,
      fromMiniBlockId: setup.id,
      toMiniBlockId: payoff.id,
      overlay: "setup-payoff",
      label: "Setup → payoff",
      evidence: `${setup.setup} → ${payoff.payoff}`,
      sourceNodeIds: [setup.id, payoff.id],
      source: "explicit",
      severity: "info",
    })));
  });

  for (const edge of index.graph.edges) {
    if (!["covered-by", "visualized-by", "realized-as", "uses-asset", "uses-asset-variation"].includes(edge.type)) continue;
    const left = nodeCards.get(edge.from);
    const right = nodeCards.get(edge.to);
    if (!left || !right || left.id === right.id) continue;
    addConnection(connections, {
      id: `visual:${edge.id}`,
      fromMiniBlockId: left.id,
      toMiniBlockId: right.id,
      overlay: "visual-continuity",
      label: edge.type.replaceAll("-", " "),
      evidence: `The PPF relationship index links ${edge.from} to ${edge.to} as ${edge.type}.`,
      sourceNodeIds: [edge.from, edge.to],
      source: edge.source,
      severity: "info",
    });
  }

  const markers = warningMarkers(cards, index.conflicts, nodeCards);
  return {
    cards,
    connections: connections.sort((left, right) => left.id.localeCompare(right.id)),
    markers: markers.sort((left, right) => left.id.localeCompare(right.id)),
    nodes: index.graph.nodes,
    edges: index.graph.edges,
    conflicts: index.conflicts,
    sharedLayout: readStoryworldMapSharedLayout(project),
    summary: {
      connections: connections.length,
      warnings: markers.filter((item) => item.severity === "warning").length,
      critical: markers.filter((item) => item.severity === "critical").length,
      renderReady: markers.filter((item) => item.overlay === "render-readiness" && item.severity === "info").length,
      hooksAndTurns: markers.filter((item) => item.overlay === "hooks-turns").length,
    },
  };
}

function itemFromCards(
  id: string,
  canonicalId: string,
  kind: StoryworldMapGranularity,
  label: string,
  context: string,
  cards: MiniBlockWallCard[],
  shotId = "",
): StoryworldMapItem {
  const first = cards[0];
  return {
    id,
    canonicalId,
    kind,
    label,
    context,
    act: first?.act ?? 0,
    blockNumber: first?.blockNumber ?? 0,
    miniBlockIds: cards.map((card) => card.id),
    shotId,
  };
}

export function createStoryworldMapItems(
  project: PlotPickleProject,
  model: StoryworldMapModel,
  granularity: StoryworldMapGranularity,
  visibleMiniBlockIds?: Iterable<string>,
) {
  const visible = visibleMiniBlockIds ? new Set(visibleMiniBlockIds) : null;
  const cards = visible ? model.cards.filter((card) => visible.has(card.id)) : model.cards;
  if (granularity === "movie") {
    return [itemFromCards(
      `movie:${project.id}`,
      project.id,
      granularity,
      project.metadata.title || "Untitled story",
      `${cards.length} visible mini-blocks across the whole movie`,
      cards,
    )];
  }

  const groups = new Map<string, MiniBlockWallCard[]>();
  const labels = new Map<string, { canonicalId: string; label: string; context: string }>();
  for (const card of cards) {
    let key = card.id;
    let canonicalId = card.id;
    let label = card.label || `Mini-block ${card.globalNumber}`;
    let context = `Block ${card.blockNumber}.${card.number} · ${card.sceneTitle}`;
    if (granularity === "act") {
      key = `act:${card.act}`;
      canonicalId = `act-${card.act}`;
      label = `Act ${card.act} · ${["Setup", "Confrontation", "Complication", "Resolution"][card.act - 1]}`;
      context = "Canonical story act";
    } else if (granularity === "sequence") {
      key = `sequence:${card.sequenceNumber}`;
      const sequence = project.structure.sequences.find((item) => item.number === card.sequenceNumber);
      canonicalId = sequence?.id ?? key;
      label = `Sequence ${card.sequenceNumber} · ${sequence?.title || "Untitled sequence"}`;
      context = `Act ${card.act}`;
    } else if (granularity === "block") {
      key = `block:${card.blockId}`;
      canonicalId = card.blockId;
      label = `Block ${card.blockNumber} · ${card.blockTitle}`;
      context = `Sequence ${card.sequenceNumber}`;
    } else if (granularity === "scene") {
      key = `scene:${card.sceneId}`;
      canonicalId = card.sceneId;
      label = card.sceneTitle || "Untitled scene";
      context = `Block ${card.blockNumber} · Scene containing mini-block ${card.number}`;
    }
    groups.set(key, [...(groups.get(key) ?? []), card]);
    labels.set(key, { canonicalId, label, context });
  }

  if (granularity === "production-shot") {
    return cards.flatMap((card) => card.shotIds.map((shotId, index) => {
      const shot = project.production.shots.find((candidate) => candidate.id === shotId);
      return itemFromCards(
        `production-shot:${shotId}`,
        shotId,
        granularity,
        shot ? `Shot ${shot.shotNumber} · ${shot.shotSize}` : `Shot ${index + 1}`,
        `Block ${card.blockNumber}.${card.number} · ${card.sceneTitle}`,
        [card],
        shotId,
      );
    }));
  }

  return [...groups.entries()].map(([key, itemCards]) => {
    const details = labels.get(key)!;
    return itemFromCards(key, details.canonicalId, granularity, details.label, details.context, itemCards);
  });
}

export function storyworldConnectionsForItem(
  model: StoryworldMapModel,
  item: StoryworldMapItem,
  overlays: StoryworldMapOverlay[],
) {
  const members = new Set(item.miniBlockIds);
  return model.connections.filter((connection) =>
    overlays.includes(connection.overlay)
    && (members.has(connection.fromMiniBlockId) || members.has(connection.toMiniBlockId)));
}

export function storyworldMarkersForItem(
  model: StoryworldMapModel,
  item: StoryworldMapItem,
  overlays: StoryworldMapOverlay[],
) {
  const members = new Set(item.miniBlockIds);
  return model.markers.filter((marker) => members.has(marker.miniBlockId) && overlays.includes(marker.overlay));
}

export function storyworldConnectionsFor(
  model: StoryworldMapModel,
  miniBlockId: string,
  overlays: StoryworldMapOverlay[],
) {
  return model.connections.filter((connection) =>
    overlays.includes(connection.overlay)
    && (connection.fromMiniBlockId === miniBlockId || connection.toMiniBlockId === miniBlockId));
}

export function storyworldMarkersFor(
  model: StoryworldMapModel,
  miniBlockId: string,
  overlays: StoryworldMapOverlay[],
) {
  return model.markers.filter((marker) => marker.miniBlockId === miniBlockId && overlays.includes(marker.overlay));
}

function xml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildStoryworldMapSvg(
  project: PlotPickleProject,
  model = createStoryworldMapModel(project),
  overlays: StoryworldMapOverlay[] = ALL_OVERLAYS,
) {
  const cardPosition = new Map(model.cards.map((card) => {
    const blockWithinAct = (card.blockNumber - 1) % 6;
    const x = 110 + blockWithinAct * 280 + (card.number - 1) * 62;
    const y = 110 + (card.act - 1) * 170;
    return [card.id, { x, y }] as const;
  }));
  const connections = model.connections.filter((item) => overlays.includes(item.overlay));
  const lines = connections.flatMap((connection) => {
    const from = cardPosition.get(connection.fromMiniBlockId);
    const to = cardPosition.get(connection.toMiniBlockId);
    if (!from || !to) return [];
    return [`<path d="M ${from.x + 22} ${from.y + 22} C ${from.x + 70} ${from.y + 22}, ${to.x - 30} ${to.y + 22}, ${to.x + 22} ${to.y + 22}" class="edge ${xml(connection.overlay)}"><title>${xml(connection.label)}: ${xml(connection.evidence)}</title></path>`];
  }).join("");
  const nodes = model.cards.map((card) => {
    const position = cardPosition.get(card.id)!;
    const markers = storyworldMarkersFor(model, card.id, overlays);
    return `<g id="${xml(card.id)}" transform="translate(${position.x} ${position.y})"><rect width="48" height="48" rx="10" class="node act-${card.act}"/><text x="24" y="21" text-anchor="middle">${card.globalNumber}</text><text x="24" y="36" text-anchor="middle" class="mini">B${card.blockNumber}.${card.number}</text>${markers.length ? `<circle cx="43" cy="5" r="6" class="marker"><title>${xml(markers.map((item) => item.label).join(", "))}</title></circle>` : ""}<title>${xml(card.label || `Mini-block ${card.globalNumber}`)} — ${xml(card.turn || card.purpose || card.function)}</title></g>`;
  }).join("");
  const acts = [1, 2, 3, 4].map((act) => `<text x="28" y="${142 + (act - 1) * 170}" class="act-label">ACT ${act}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="780" viewBox="0 0 1800 780" role="img" aria-labelledby="title description"><title id="title">${xml(project.metadata.title)} Storyworld Map</title><desc id="description">Static PlotPickle Storyworld Map generated from the canonical PPF relationship index.</desc><style>svg{background:#f5fbf9;font-family:Inter,Arial,sans-serif}.edge{fill:none;stroke:#8daaa4;stroke-width:1.5;opacity:.5}.edge.setup-payoff{stroke:#b46a34;stroke-width:2.5}.edge.characters{stroke:#4d7eb6}.edge.threads{stroke:#7b5aa8}.edge.causality{stroke:#2b7568}.node{stroke:#376b65;stroke-width:1.5;fill:#e3f3ee}.act-2{fill:#e8f0fa}.act-3{fill:#f5ede0}.act-4{fill:#efe8f6}text{font-size:12px;font-weight:800;fill:#173c38}.mini{font-size:8px;font-weight:600}.marker{fill:#c16052;stroke:#fff;stroke-width:2}.act-label{font-size:14px;letter-spacing:2px;fill:#557873}</style>${acts}${lines}${nodes}</svg>`;
}

export function buildStoryworldMapHtml(project: PlotPickleProject, model = createStoryworldMapModel(project)) {
  const svg = buildStoryworldMapSvg(project, model);
  const rows = model.cards.map((card) => `<tr><th>${card.globalNumber}</th><td>Block ${card.blockNumber}.${card.number}</td><td>${xml(card.label)}</td><td>${xml(card.characterName)}</td><td>${xml(card.turn || card.purpose)}</td><td>${model.connections.filter((item) => item.fromMiniBlockId === card.id || item.toMiniBlockId === card.id).length}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${xml(project.metadata.title)} Storyworld Map</title><style>body{font:14px/1.45 Inter,Arial,sans-serif;margin:32px;color:#173c38}svg{max-width:100%;height:auto}table{width:100%;border-collapse:collapse;margin-top:28px}th,td{padding:8px;border:1px solid #bfd4cf;text-align:left}@media print{body{margin:0}table{page-break-before:always}}</style><h1>${xml(project.metadata.title)} Storyworld Map</h1><p>Derived from the canonical PlotPickle PPF relationship index. The static map preserves labels, connection evidence and stable source identities.</p>${svg}<table><caption>Accessible Storyworld Map index</caption><thead><tr><th>Mini</th><th>Position</th><th>Label</th><th>Character</th><th>Story movement</th><th>Connections</th></tr></thead><tbody>${rows}</tbody></table></html>`;
}

export function storyworldMapFileName(project: PlotPickleProject, extension: "svg" | "html") {
  const base = (project.metadata.title || "plotpickle").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "plotpickle"}-storyworld-map.${extension}`;
}
