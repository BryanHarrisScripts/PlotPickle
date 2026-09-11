import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scorePath = "core/project/plotpickle-score.ts";
const dashboardPath = "app/skin-v1/dashboard-bbs-panel.tsx";
const panelPath = "app/skin-v1/plotpickle-score-panel.tsx";
const readmePath = "README.md";
const scoreDocsPath = "docs/architecture/PLOTPICKLE-SCORE.md";
const mathDocsPath = "docs/architecture/PLOTPICKLE-MATHEMATICAL-MODEL.md";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("#1905 defines one deterministic five-dimension PlotPickle Score contract", async () => {
  const score = await source(scorePath);

  for (const dimension of ["alignment", "verbosity", "erosion", "progression", "coverage"]) {
    assert.match(score, new RegExp(`\\b${dimension}: number\\b`, "u"));
  }

  assert.match(score, /Math\.pow\(clamp01\(product\), 1 \/ 5\)/u);
  assert.match(score, /metrics\.alignment[\s\S]*\(1 - metrics\.verbosity\)[\s\S]*\(1 - metrics\.erosion\)[\s\S]*metrics\.progression[\s\S]*metrics\.coverage/u);
  assert.match(score, /displayScore: "NR"/u);
  assert.match(score, /ratingState: "unrated"/u);
  assert.match(score, /"imported-screenplay"[\s\S]*"native-structure"[\s\S]*"none"/u);

  assert.doesNotMatch(score, /fetch\(|OpenAI|Gemini|Ollama|Mastra|providerId|modelId|aiGenerated|authorship/iu,
    "The numeric score must not call or weight an AI/provider/provenance source.");
});

test("#1905 supports imported screenplay evidence first and native 24/96 evidence as fallback", async () => {
  const score = await source(scorePath);

  assert.match(score, /function importedEvidence\(/u);
  assert.match(score, /screenplay\?\.passages\.length/u);
  assert.match(score, /function nativeEvidence\(/u);
  assert.match(score, /mini\.stages\.storyboard\.content\.trim\(\)[\s\S]*mini\.stages\.build\.content\.trim\(\)[\s\S]*mini\.stages\.plan\.content\.trim\(\)/u);
  assert.match(score, /const units = imported\.length \? imported : native/u);
  assert.match(score, /units\.length \/ STORY_MINI_BLOCK_COUNT/u);
});

test("#1905 places PlotPickle Score immediately below canonical Dashboard art", async () => {
  const [dashboard, panel] = await Promise.all([source(dashboardPath), source(panelPath)]);

  const art = dashboard.indexOf("pp-skin-v1-dashboard-art");
  const score = dashboard.indexOf("<PlotPickleScorePanel />");
  const brand = dashboard.indexOf("pp-skin-v1-dashboard-brand");

  assert.ok(art >= 0, "Dashboard art is missing.");
  assert.ok(score > art, "PlotPickle Score must appear after Dashboard art.");
  assert.ok(brand > score, "PlotPickle Score must appear before the Dashboard brand/menu content.");
  assert.match(dashboard, /import PlotPickleScorePanel from "\.\/plotpickle-score-panel"/u);

  assert.match(panel, /initializeProjectLibrary\(\)\.activeProject/u);
  assert.match(panel, /PROJECT_LIBRARY_CHANGED_EVENT/u);
  assert.match(panel, /calculatePlotPickleScore/u);
  assert.match(panel, /PLOTPICKLE SCORE/u);
  assert.match(panel, /ALIGNMENT/u);
  assert.match(panel, /VERBOSITY/u);
  assert.match(panel, /EROSION/u);
  assert.match(panel, /PROGRESSION/u);
  assert.match(panel, /COVERAGE/u);
  assert.match(panel, /LOWER IS BETTER/u);
});

test("#1905 documentation makes the mathematical model core without replacing Human creative authority", async () => {
  const [readme, scoreDocs, mathDocs] = await Promise.all([
    source(readmePath),
    source(scoreDocsPath),
    source(mathDocsPath),
  ]);

  assert.match(readme, /### PlotPickle Score/u);
  assert.match(readme, /Alignment, Verbosity, Erosion, Progression and Coverage/u);
  assert.match(readme, /PlotPickle does for narrative structure what timecode does for film/u);
  assert.match(readme, /PlotPickle-specific design by Bryan Harris/u);
  assert.match(readme, /PLOTPICKLE-MATHEMATICAL-MODEL\.md/u);

  assert.match(scoreDocs, /A beat sheet describes landmarks\. PlotPickle adds an address system around the whole territory\./u);
  assert.match(scoreDocs, /PlotPickle-specific design by Bryan Harris/u);
  assert.match(scoreDocs, /24 Story Blocks → 96 Mini-Blocks/u);
  assert.match(scoreDocs, /technical render slots are not a claim that every finished movie contains 2,400 editorial shots/iu);

  assert.match(mathDocs, /Hierarchical Discrete Temporal Story Quantization \(HDTSQ\)/u);
  assert.match(mathDocs, /This is a PlotPickle term for its own architecture/u);
  assert.match(mathDocs, /u = t \/ T/u);
  assert.match(mathDocs, /Δt_block = T \/ 24/u);
  assert.match(mathDocs, /Δt_mini = T \/ 96/u);
  assert.match(mathDocs, /δ_k = \|u_actual\(k\) - u_expected\(k\)\|/u);
  assert.match(mathDocs, /Mathematics gives the narrative an address\. Evidence gives the address meaning\. The Human decides whether that meaning serves the story\./u);
});
