import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  WEBMCP_DASHBOARD_DESTINATION_COVERAGE,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "../lib/verification/webmcp-surface-capture-registry.mjs";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2287 exposes the approved Development and Pre-Production hierarchy", async () => {
  const menu = await read("app/skin-v1/dashboard-menu-registry.ts");
  const ordered = ["learn", "community", "library", "discovery", "story-bible", "plan", "storyboard", "previs", "timeline", "production"];
  let cursor = -1;
  for (const id of ordered) {
    const next = menu.indexOf(`id: "${id}"`);
    assert.ok(next > cursor, "Dashboard hierarchy drifted at " + id);
    cursor = next;
  }
  assert.match(menu, /id: "discovery", shortcut: "M", label: "MindMap"/u);
  assert.match(menu, /id: "story-bible", shortcut: "W", label: "WorldMap"/u);
  assert.doesNotMatch(menu, /id: "story-bible"[\s\S]{0,120}label: "Pre-Production"/u);
  assert.match(menu, /"discovery"[\s\S]*"library"/u);
});

test("#2287 stores Discovery metadata in the existing Library project envelope", async () => {
  const library = await read("core/storage/library-project.ts");
  const contract = await read("core/contracts/discovery/index.ts");
  assert.match(library, /readonly discovery: DiscoveryState/u);
  assert.match(library, /normalizeDiscoveryState\(source\.discovery\)/u);
  assert.match(library, /createEmptyDiscoveryState\(\)/u);
  for (const lane of ["story", "plot", "character", "scene", "dialogue", "world", "research", "theme", "motif", "visual", "image"]) {
    assert.match(contract, new RegExp('id: "' + lane + '"', "u"));
  }
  assert.match(contract, /export function discoveryActForBlock/u);
});

test("#2287 derives existing project pins from canonical Block addresses instead of model guesses", async () => {
  const projection = await read("core/project/discovery/index.ts");
  assert.match(projection, /placement:[\s\S]*act: block\.actNumber/u);
  assert.match(projection, /lane: "story"/u);
  assert.match(projection, /classifierId: "deterministic-ppf-address"/u);
  assert.match(projection, /Derived deterministically from canonical PPF Block/u);
  assert.doesNotMatch(projection, /fetch\(|askPlotPickleAgent|\/api\/writing-assistant/u);
});

test("#2287/#2632 keeps the Discovery Mapper as backward-compatible infrastructure but removes it from canonical Mind Map", async () => {
  const [surface, runtime, registry, skill, trust] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("build/mastra-agent-runtime.ts"),
    readJson("config/agent-skills.json"),
    read(".agents/skills/discovery-mapper/SKILL.md"),
    readJson("config/agent-skill-trust.json"),
  ]);

  assert.doesNotMatch(surface, /agentId: "discovery-mapper"|normalizeDiscoveryMapperResult|globalThis\.crypto\.randomUUID/u);
  assert.match(runtime, /"discovery-mapper": "Classify one unplaced Human-authored Discovery item/u);
  assert.match(runtime, /schema: discoveryMapperSchema\(\)/u);
  assert.ok(registry.skills.some((item) => item.id === "discovery-mapper" && item.primaryWorker === "mastra"));
  assert.ok(trust.records.some((item) => item.uri === "skill://plotpickle/discovery-mapper" && item.evalStatus === "covered"));
  assert.match(skill, /This skill classifies; it does not write/u);
});

test("#2287/#2442/#2632 preserves historical discovery source states without rendering the retired board", async () => {
  const [surface, css, contract] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/discovery-surface.module.css"),
    read("core/contracts/discovery/index.ts"),
  ]);
  assert.match(contract, /export type DiscoverySourceState = "project" \| "new-local" \| "agent-proposal"/u);
  assert.match(contract, /sourceState: DiscoverySourceState/u);
  assert.doesNotMatch(surface, /data-source-state=|Save Human Idea|Living MindMap|Assign Lane/u);
  assert.doesNotMatch(css, /data-source-state="new-local"|data-source-state="agent-proposal"/u);
});

test("#2287 registers Discovery as census-only Skin V1/WebMCP coverage without expanding the standard 30", async () => {
  const registry = await readJson("config/skin-v1-surface-registry.json");
  const discovery = registry.surfaces.find((surface) => surface.id === "discovery");
  assert.equal(discovery?.label, "Mind Map");
  assert.equal(discovery?.capturePolicy, "census-only");
  assert.equal(discovery?.runtimeSelector, "[data-discovery-surface='canonical-authoring']");
  assert.ok(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.censusOnly.includes("discovery"));
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.length, 32);
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.includes("discovery"), false);
});

test("#2287/#2603 Discovery opens the detached Blank and defers durable identity until first Save", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  const surface = await read("app/skin-v1/discovery-surface.tsx");
  assert.match(host, /item\.id === "discovery"[\s\S]*setDiscoveryProject\(loadActiveLibraryProject\(\)\)/u);
  assert.match(host, /<DiscoverySurface project=\{discoveryProject\}/u);
  assert.match(surface, /window\.prompt\("Save as New Project", suggested\)/u);
  assert.match(surface, /saveDetachedLibraryProjectAs/u);
  assert.doesNotMatch(host, /createAfterglow|createEmptyLibraryProject/u);
});


test("#2287 live Dashboard keyboard audit includes Discovery between Writer's Craft and Library", async () => {
  const audit = await read("lib/verification/skin-v1-menu-contract-audit.mjs");
  const learn = audit.indexOf("[data-dashboard-menu-item='learn']");
  const library = audit.indexOf("[data-dashboard-menu-item='library']");
  const discovery = audit.indexOf("[data-dashboard-menu-item='discovery']");
  assert.ok(learn >= 0 && library > learn && discovery > library);
  assert.match(audit, /dashboard-discovery/u);
});
