
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Pitch & Review includes a four-part dialectic worksheet and 20-point logline deconstruction", async () => {
  const workspace = await source("app/pitch-review-workspace.tsx");
  const dialectic = await source("app/dialectic-worksheet.tsx");
  const rubric = await source("lib/logline-rubric.ts");
  assert.match(workspace, /Theme Dialectic/);
  assert.match(workspace, /LoglineRubric/);
  for (const field of ["Thesis", "Antithesis", "Synthesis", "Ending proof"]) assert.match(dialectic, new RegExp(field, "i"));
  assert.match(rubric, /LOGLINE_RUBRIC_TOTAL = 20/);
  for (const criterion of ["Identifiable protagonist", "Active visible goal", "Opposing force", "Consequences of failure", "Dramatic irony", "Professional concision", "Specific language", "Escalating final pressure"]) assert.ok(rubric.includes(criterion), `Missing rubric criterion: ${criterion}`);
});

test("Canon Binder can attach the current beats, outline and pitch", async () => {
  const labs = await source("app/specialist-labs.tsx");
  const logic = await source("lib/specialist-labs.ts");
  for (const phrase of ["24 Blocks beats", "Scene outline", "Pitch package", "Attach to Canon Binder", "Refresh attachment"]) assert.ok(labs.includes(phrase) || logic.includes(phrase), `Missing Canon Binder feature: ${phrase}`);
  assert.match(logic, /attachProjectDocumentToCanonBinder/);
  assert.match(logic, /project-document:\$\{kind\}/);
});

test("Settings exposes real connections and three role-specific reports", async () => {
  const panel = await source("app/settings-panel.tsx");
  const reportUi = await source("app/settings-project-tools.tsx");
  const reports = await source("lib/screenplay-reports.ts");
  for (const item of ["<b>GitHub</b>", "<b>AI Setup</b>", "<b>Music</b>"]) assert.ok(panel.includes(item), `Missing live connection: ${item}`);
  assert.doesNotMatch(panel, /<b>Core Model<\/b>/);
  assert.doesNotMatch(panel, /<b>Plugins<\/b>/);
  for (const role of ["Producer report", "Actor", "Director report"]) assert.ok(reportUi.includes(role), `Missing role report: ${role}`);
  assert.match(reports, /createProducerReport/);
  assert.match(reports, /createDirectorReport/);
});

test("README remains complete while three .md tabs are selectable from the main page", async () => {
  const page = await source("app/page.tsx");
  const tabs = await source("app/readme-tabs.tsx");
  const readme = await source("README.md");
  assert.match(page, /ReadmeTabs/);
  for (const name of ["GETTING-STARTED.md", "WRITING-AND-PRODUCTION.md", "COLLABORATION-AND-DEVELOPMENT.md"]) {
    assert.ok(tabs.includes(name));
    assert.ok(readme.includes(name));
    await access(new URL(`public/docs/readme/${name}`, root));
  }
});

test("collaboration documentation uses committed PlotPickle logos", async () => {
  const diagram = await source("docs/images/plotpickle-multi-server-collaboration.svg");
  assert.match(diagram, /plotpickle-header-horizontal-600\.png/);
  assert.match(diagram, /plotpickle-icon-128\.png/);
  assert.match(diagram, /Writer server/);
  assert.match(diagram, /Director server/);
  assert.match(diagram, /Producer server/);
  assert.match(diagram, /Pull-request review queue/);
});

test("Windows publisher guidance explains Mark of the Web and the signed-launcher path", async () => {
  const warning = await source("docs/windows-publisher-warning.md");
  assert.match(warning, /Unblock/);
  assert.match(warning, /Mark of the Web/);
  assert.match(warning, /code-signing certificate/);
  assert.match(warning, /Do not disable Windows Security globally/);
});
