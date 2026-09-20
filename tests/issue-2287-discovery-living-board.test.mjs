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
  const ordered = ["community", "learn", "discovery", "library", "story-bible", "plan", "storyboard", "previs", "timeline", "production"];
  let cursor = -1;
  for (const id of ordered) {
    const next = menu.indexOf(`id: "${id}"`);
    assert.ok(next > cursor, "Dashboard hierarchy drifted at " + id);
    cursor = next;
  }
  assert.match(menu, /id: "discovery", shortcut: "G", label: "Discovery"/u);
  assert.match(menu, /id: "story-bible", shortcut: "V", label: "Story Bible"/u);
  assert.doesNotMatch(menu, /id: "story-bible"[\s\S]{0,120}label: "Pre-Production"/u);
  assert.match(menu, /"discovery"[\s\S]*"library"/u);
});

test("#2287 stores Discovery metadata in the existing Library project envelope", async () => {
  const library = await read("core/storage/library-project.ts");
  const contract = await read("core/contracts/discovery/index.ts");
  assert.match(library, /readonly discovery: DiscoveryState/u);
  assert.match(library, /normalizeDiscoveryState\(source\.discovery\)/u);
  assert.match(library, /createEmptyDiscoveryState\(\)/u);
  for (const lane of ["story-plot", "character", "scene-dialogue", "world-research", "theme-motif", "visual-mood"]) {
    assert.match(contract, new RegExp('id: "' + lane + '"', "u"));
  }
  assert.match(contract, /export function discoveryActForBlock/u);
});

test("#2287 derives existing project pins from canonical Block addresses instead of model guesses", async () => {
  const projection = await read("core/project/discovery/index.ts");
  assert.match(projection, /placement:[\s\S]*act: block\.actNumber/u);
  assert.match(projection, /lane: "story-plot"/u);
  assert.match(projection, /classifierId: "deterministic-ppf-address"/u);
  assert.match(projection, /Derived deterministically from canonical PPF Block/u);
  assert.doesNotMatch(projection, /fetch\(|askPlotPickleAgent|\/api\/writing-assistant/u);
});

test("#2287 Pin routes only genuinely unplaced local cards through the Discovery Mapper", async () => {
  const [surface, runtime, registry, skill, trust] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("build/mastra-agent-runtime.ts"),
    readJson("config/agent-skills.json"),
    read(".agents/skills/discovery-mapper/SKILL.md"),
    readJson("config/agent-skill-trust.json"),
  ]);

  assert.match(surface, /globalThis\.crypto\.randomUUID\(\)/u);
  assert.doesNotMatch(surface, /Math\.random/u);
  assert.match(surface, /agentId: "discovery-mapper"/u);
  assert.match(surface, /modelRole: "quality"/u);
  assert.doesNotMatch(surface, /provider:\s*"(?:local|ollama|openai|minimax|gemini)"/u);
  assert.match(surface, /normalizeDiscoveryMapperResult/u);
  assert.match(surface, /The card remains unpinned/u);
  assert.match(runtime, /"discovery-mapper": "Classify one unplaced Human-authored Discovery item/u);
  assert.match(runtime, /schema: discoveryMapperSchema\(\)/u);
  assert.ok(registry.skills.some((item) => item.id === "discovery-mapper" && item.primaryWorker === "mastra"));
  assert.ok(trust.records.some((item) => item.uri === "skill://plotpickle/discovery-mapper" && item.evalStatus === "covered"));
  assert.match(skill, /This skill classifies; it does not write/u);
});

test("#2287 pinned placement is read-only and distinguishes PROJECT from NEW LOCAL without color alone", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");
  const css = await read("app/skin-v1/discovery-surface.module.css");
  assert.match(surface, />PROJECT</u);
  assert.match(surface, />NEW LOCAL</u);
  assert.match(surface, /Placement is read-only in v1/u);
  assert.doesNotMatch(surface, /draggable=|onDragStart|onDrop|Move earlier|Move later/u);
  assert.match(css, /data-source-state="new-local"/u);
  assert.match(css, /var\(--pp-skin-accent-bright\)/u);
});

test("#2287 registers Discovery as census-only Skin V1/WebMCP coverage without expanding the standard 30", async () => {
  const registry = await readJson("config/skin-v1-surface-registry.json");
  const discovery = registry.surfaces.find((surface) => surface.id === "discovery");
  assert.equal(discovery?.label, "Discovery");
  assert.equal(discovery?.capturePolicy, "census-only");
  assert.equal(discovery?.runtimeSelector, "[data-discovery-surface='living-board']");
  assert.ok(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.censusOnly.includes("discovery"));
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.length, 30);
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.includes("discovery"), false);
});

test("#2287 Discovery is connected from Dashboard and does not manufacture a project when none is active", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  const surface = await read("app/skin-v1/discovery-surface.tsx");
  assert.match(host, /item\.id === "discovery"[\s\S]*setDiscoveryProject\(hasActiveLibraryProject\(\) \? loadActiveLibraryProject\(\) : null\)/u);
  assert.match(host, /<DiscoverySurface project=\{discoveryProject\}/u);
  assert.match(surface, /Load or create a story in Library before persistent project pinning/u);
  assert.doesNotMatch(surface, /createLibraryUserProject|createEmptyProject|Untitled Story/u);
});
