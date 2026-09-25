import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeDiscoveryState } from "../core/contracts/discovery/index.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2448 MindMap uses one-word header and one selected Act rail", async () => {
  const [surface, host] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  assert.match(host, /<h1>MINDMAP<\/h1>/u);
  assert.match(host, /aria-label="MindMap"/u);
  assert.match(host, /onSurfaceNameChange\("MINDMAP"\)/u);
  assert.match(surface, /const \[selectedAct, setSelectedAct\] = useState<DiscoveryAct>\(1\)/u);
  assert.match(surface, /aria-label="MindMap acts"/u);
  assert.match(surface, /data-mind-map-act-choice=\{act\}/u);
  assert.match(surface, /aria-current=\{selectedAct === act \? "page" : undefined\}/u);
  assert.match(surface, /onClick=\{\(\) => changeAct\(act\)\}/u);
});

test("#2448 Written Ideas and Inbox are scoped to the selected Act", async () => {
  const [surface, contract] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("core/contracts/discovery/index.ts"),
  ]);

  assert.match(contract, /readonly inboxAct\?: DiscoveryAct \| null/u);
  assert.match(contract, /inboxAct: isDiscoveryAct\(card\.inboxAct\) \? card\.inboxAct : null/u);
  assert.match(surface, /inboxAct: selectedAct/u);
  assert.match(surface, /!card\.placement && \(card\.inboxAct \?\? 1\) === selectedAct/u);
  assert.match(surface, /Add to Act \{selectedAct\} Inbox/u);
  assert.match(surface, /ACT \{selectedAct\} INBOX · UNPINNED WRITTEN IDEAS/u);

  const legacy = normalizeDiscoveryState({
    cards: [{
      id: "legacy",
      kind: "text",
      content: "Legacy idea",
      assetRef: "",
      sourceState: "new-local",
      sourceRef: null,
      createdAt: "2026-09-25T00:00:00.000Z",
      placement: null,
    }],
  });
  assert.equal(legacy.cards[0]?.inboxAct, null);
});

test("#2448 Discovery Mapper cannot move an Act-scoped Inbox card", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /const fixedAct = card\.inboxAct \?\? 1/u);
  assert.match(surface, /requiredAct: fixedAct/u);
  assert.match(surface, /compactProjectContext\(project, fixedAct\)/u);
  assert.match(surface, /if \(mapped\.act !== fixedAct\)/u);
  assert.match(surface, /tried to move this card from Act/u);
  assert.match(surface, /\.\.\.mapped,[\s\S]*act: fixedAct/u);
});

test("#2448 one Develop action drives all six lanes for the selected Act", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /onClick=\{\(\) => void developAct\(selectedAct\)\}/u);
  assert.match(surface, /Develop Act \$\{selectedAct\} Mind Map/u);
  assert.match(surface, /for \(const lane of DISCOVERY_LANES\)/u);
  assert.match(surface, /agentId: "creative-director"/u);
  assert.match(surface, /sourceState: "agent-proposal"/u);
  assert.doesNotMatch(surface, /MIND_MAP_ACTS\.map\(\(act\) => \([\s\S]*Develop Act \$\{act\} Mind Map/u);
});

test("#2448 Story Shape renders six selected-Act lanes in two columns", async () => {
  const [surface, styles, contract] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/discovery-surface.module.css"),
    read("core/contracts/discovery/index.ts"),
  ]);

  assert.match(surface, /className=\{styles\.laneGrid\}/u);
  assert.match(surface, /DISCOVERY_LANES\.map\(\(lane\)/u);
  assert.match(surface, /selectedActBoardCards\.filter\(\(card\) => card\.placement\?\.lane === lane\.id\)/u);
  assert.match(surface, /data-discovery-act=\{selectedAct\}/u);
  assert.doesNotMatch(surface, /className=\{styles\.boardGrid\}/u);
  assert.match(styles, /\.laneGrid \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.laneGrid \{[\s\S]*grid-template-columns: 1fr/u);

  for (const lane of ["story-plot", "character", "scene-dialogue", "world-research", "theme-motif", "visual-mood"]) {
    assert.match(contract, new RegExp(`id: "${lane}"`, "u"));
  }
  assert.match(contract, /export type DiscoveryAct = 1 \| 2 \| 3 \| 4/u);
});
