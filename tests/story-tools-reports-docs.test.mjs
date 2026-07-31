import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Pitch & Review includes a four-part dialectic worksheet and evidence-based Logline Lab", async () => {
  const workspace = await source("app/pitch-review-workspace.tsx");
  const labUi = await source("app/logline-lab.tsx");
  const dialectic = await source("app/dialectic-worksheet.tsx");
  const rubric = await source("lib/logline-rubric.ts");
  const evidence = await source("lib/logline-lab.ts");
  assert.match(workspace, /Theme Dialectic/);
  assert.match(workspace, /LoglineLab/);
  assert.match(labUi, /LoglineRubric/);
  for (const field of ["Thesis", "Antithesis", "Synthesis", "Ending proof"]) assert.match(dialectic, new RegExp(field, "i"));
  for (const group of ["Core dramatic engine", "Promise and distinction", "Clarity and delivery"]) assert.ok(evidence.includes(group), `Missing evidence group: ${group}`);
  for (const state of ["sentence-supported", "project-only", "intentional-omission", "review"]) assert.ok(evidence.includes(state), `Missing evidence state: ${state}`);
  assert.doesNotMatch(rubric, /LOGLINE_RUBRIC_TOTAL|Exceptional|Pitch-ready/);
});

test("Canon Binder can attach the current beats, outline and pitch", async () => {
  const labs = await source("app/specialist-labs.tsx");
  const logic = await source("lib/specialist-labs.ts");
  for (const phrase of ["24 Blocks beats", "Scene outline", "Pitch package", "Attach to Canon Binder", "Refresh attachment"]) assert.ok(labs.includes(phrase) || logic.includes(phrase), `Missing Canon Binder feature: ${phrase}`);
  assert.match(logic, /attachProjectDocumentToCanonBinder/);
  assert.match(logic, /project-document:\$\{kind\}/);
});

test("Settings exposes real connections while Reports remains a primary workspace", async () => {
  const [page, navigation, panel, reportUi, reports] = await Promise.all([
    source("app/page.tsx"),
    source("lib/product-direction.ts"),
    source("app/settings-panel-legacy.tsx"),
    source("app/settings-project-tools.tsx"),
    source("lib/screenplay-reports.ts"),
  ]);
  for (const item of ['label: "Story & Art"', 'label: "Repository & Collab"', 'label: "Scheduling & Meetings"', 'label: "Media & Film Engines"', "Music service links"]) assert.ok(panel.includes(item), `Missing live Settings capability: ${item}`);
  assert.match(navigation, /id: "reports", label: "Reports", description: "Understand the screenplay"/);
  assert.match(page, /activeTab === "reports"[\s\S]*ReportsWorkspace/);
  assert.doesNotMatch(panel, /<b>Reports<\/b>/);
  assert.doesNotMatch(panel, /<b>Terminology Index<\/b>/);
  assert.doesNotMatch(panel, /<b>Core Model<\/b>/);
  assert.match(panel, /label: "Media & Film Engines"/);
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

test("collaboration documentation shows complete installations with roles inside PlotPickle", async () => {
  const diagram = await source("docs/images/plotpickle-multi-server-collaboration.svg");
  assert.match(diagram, /plotpickle-header-horizontal-600\.png/);
  assert.match(diagram, /plotpickle-icon-128\.png/);
  assert.match(diagram, /Complete PlotPickle installations/);
  assert.match(diagram, /Local PlotPickle/);
  assert.match(diagram, /Private web PlotPickle/);
  for (const role of ["Writer", "Director", "Producer", "Actor", "Reviewer"]) assert.match(diagram, new RegExp(role));
  assert.match(diagram, /Roles belong to people inside PlotPickle/);
  assert.match(diagram, /Proposal branches and pull requests/);
  assert.match(diagram, /Owner \/ maintainer: review · merge · close/);
  assert.doesNotMatch(diagram, /Writer server|Director server|Producer server|Actor server/);
});

test("Windows publisher guidance explains Mark of the Web and the signed-launcher path", async () => {
  const warning = await source("docs/windows-publisher-warning.md");
  assert.match(warning, /Unblock/);
  assert.match(warning, /Mark of the Web/);
  assert.match(warning, /code-signing certificate/);
  assert.match(warning, /Do not disable Windows Security globally/);
});
