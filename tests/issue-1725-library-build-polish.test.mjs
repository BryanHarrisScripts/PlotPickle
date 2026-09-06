import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1725 Library opens on My Stories and keeps Avery history secondary", async () => {
  const [libraryPage, workspace, polish] = await Promise.all([
    read("app/library/page.tsx"),
    read("modules/library/ui/library-workspace.tsx"),
    read("app/issue-1725-polish.css"),
  ]);

  assert.doesNotMatch(libraryPage, /PlotPickleWorkspaceShell/);
  assert.match(libraryPage, /return <LibraryWorkspace \/>/);
  assert.match(libraryPage, /issue-1725-polish\.css/);
  assert.match(workspace, /useState<LibraryTab>\("stories"\)/);
  assert.match(workspace, /data-library-new-story-card="ready"/);
  assert.match(workspace, />New Story<\/button>/);
  assert.match(workspace, /<details className=\{styles\.averyDisclosure\}>/);
  assert.match(workspace, /Avery Writer-in-Residence sessions/);
  assert.doesNotMatch(workspace, /Coming Soon|Coming soon/);
  assert.match(polish, /main\[data-library-workspace="v1"\] > div > details:last-child > summary/);
  assert.match(polish, /min-height: var\(--pp-touch-target\)/);
});

test("#1725 every LEARN apply row hands off to a current owner without adding inline styles", async () => {
  const [page, workspace, controls] = await Promise.all([
    read("app/page.tsx"),
    read("modules/learn/ui/learn-workspace.tsx"),
    read("modules/learn/ui/learn-workspace-controls.module.css"),
  ]);

  assert.match(workspace, /onApplyLearning\?: \(topic: string, lessonId\?: string\) => void/);
  assert.match(workspace, /onApplyLearning\(group\.topic/);
  assert.doesNotMatch(workspace, /Coming soon/);
  assert.doesNotMatch(workspace, /style=\{\{/);
  assert.match(workspace, /controlsStyles\.workflowStageButton/);
  assert.match(controls, /gap: var\(--pp-space-1\)/);
  assert.match(controls, /margin-right: var\(--pp-space-12\)/);
  assert.match(page, /function openLearningApplication\(topic: string, lessonId\?: string\)/);
  for (const owner of [
    'window.location.assign("/structure")',
    'window.location.assign("/storyboard")',
    'window.location.assign("/pageflow")',
    'window.location.assign("/edit")',
    'window.location.assign("/production")',
    'navigateWorkspace("settings")',
    'navigateWorkspace("collab")',
  ]) assert.ok(page.includes(owner), `LEARN application handoff is missing ${owner}`);
});

test("#1725 Story Workflow keeps one obvious run action and discloses secondary explanation and BUZZ test", async () => {
  const [workflow, polish] = await Promise.all([
    read("modules/story-workflow/ui/foundations-story-workflow-panel.tsx"),
    read("app/issue-1725-polish.css"),
  ]);

  const runAction = workflow.indexOf("Run ${selected.length} story");
  const disclosure = workflow.indexOf("<details className={styles.details}>");
  const buzzTest = workflow.indexOf("<FoundationsBuzzStoryLiveTest");
  assert.ok(runAction >= 0 && disclosure > runAction, "primary Story Workflow run action must stay ahead of secondary detail");
  assert.ok(buzzTest > disclosure, "BUZZ live test must stay inside the secondary disclosure");
  assert.match(workflow, /<summary>How Story Workflow works<\/summary>/);
  assert.match(polish, /\[data-story-workflow="foundations"\] > details > summary/);
  assert.match(polish, /\[data-story-workflow="foundations"\] > details button[\s\S]*min-height: var\(--pp-touch-target\)/);
});

test("#1725 BUILD keeps the 24x96 map primary while curriculum and selected-block evidence are progressively disclosed", async () => {
  const [coverage, map, polish] = await Promise.all([
    read("modules/build/ui/foundations-story-coverage.tsx"),
    read("modules/build/ui/progressive-story-map.tsx"),
    read("app/issue-1725-polish.css"),
  ]);

  const storyMap = coverage.indexOf("<ProgressiveStoryMap project={project} />");
  const curriculumDetail = coverage.indexOf("<details className={styles.evidenceDisclosure}>");
  assert.ok(storyMap >= 0 && curriculumDetail > storyMap, "24/96 map must remain visible before secondary curriculum evidence");
  assert.match(coverage, /<summary>Curriculum evidence details<\/summary>/);
  assert.match(polish, /\[data-story-coverage="live-foundations"\] > details > summary/);

  assert.match(map, /<details className=\{styles\.inspectorDetails\} data-story-decision-target=/);
  assert.match(map, /Background story text/);
  assert.match(polish, /details\[data-story-decision-target\] > summary/);
  assert.match(polish, /details\[data-text-projection\] > summary/);
  assert.match(polish, /border: 1px solid var\(--pp-line\)/);
  assert.match(polish, /background: var\(--pp-surface\)/);
});

test("#1725 changed styles are isolated and token-only", async () => {
  const polish = await read("app/issue-1725-polish.css");
  for (const token of [
    "--pp-line",
    "--pp-radius-panel",
    "--pp-surface",
    "--pp-space-3",
    "--pp-touch-target",
    "--pp-text",
    "--pp-font-body",
    "--pp-text-sm",
    "--pp-leading-tight",
    "--pp-orange",
    "--pp-muted",
  ]) assert.ok(polish.includes(`var(${token})`), `#1725 polish must use ${token}`);
  assert.doesNotMatch(polish, /#[0-9a-f]{3,8}/i);
  assert.doesNotMatch(polish, /rgba?\(/i);
});

test("#1725 does not add another global navigation area", async () => {
  const shortcuts = await read("app/navigation/global-shortcuts.ts");
  const areas = [...shortcuts.matchAll(/\{ id: "(home|create|produce|review|connect|settings)", label:/g)].map((match) => match[1]);
  assert.deepEqual(areas, ["home", "create", "produce", "review", "connect", "settings"]);
});
