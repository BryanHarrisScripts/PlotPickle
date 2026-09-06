import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1725 Library opens on My Stories and keeps Avery history secondary", async () => {
  const [libraryPage, workspace, css] = await Promise.all([
    read("app/library/page.tsx"),
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
  ]);

  assert.doesNotMatch(libraryPage, /PlotPickleWorkspaceShell/);
  assert.match(libraryPage, /return <LibraryWorkspace \/>/);
  assert.match(workspace, /useState<LibraryTab>\("stories"\)/);
  assert.match(workspace, /data-library-new-story-card="ready"/);
  assert.match(workspace, />New Story<\/button>/);
  assert.match(workspace, /<details className=\{styles\.averyDisclosure\}>/);
  assert.match(workspace, /Avery Writer-in-Residence sessions/);
  assert.doesNotMatch(workspace, /Coming Soon|Coming soon/);
  assert.match(css, /\.averyDisclosure > summary[\s\S]*min-height: var\(--pp-touch-target\)/);
});

test("#1725 every LEARN apply row hands off to a current owner", async () => {
  const [page, workspace] = await Promise.all([
    read("app/page.tsx"),
    read("modules/learn/ui/learn-workspace.tsx"),
  ]);

  assert.match(workspace, /onApplyLearning\?: \(topic: string, lessonId\?: string\) => void/);
  assert.match(workspace, /onApplyLearning\(group\.topic/);
  assert.doesNotMatch(workspace, /Coming soon/);
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
  const [workflow, css] = await Promise.all([
    read("modules/story-workflow/ui/foundations-story-workflow-panel.tsx"),
    read("modules/story-workflow/ui/foundations-story-workflow-panel.module.css"),
  ]);

  const runAction = workflow.indexOf("Run ${selected.length} story");
  const disclosure = workflow.indexOf("<details className={styles.details}>");
  const buzzTest = workflow.indexOf("<FoundationsBuzzStoryLiveTest");
  assert.ok(runAction >= 0 && disclosure > runAction, "primary Story Workflow run action must stay ahead of secondary detail");
  assert.ok(buzzTest > disclosure, "BUZZ live test must stay inside the secondary disclosure");
  assert.match(workflow, /<summary>How Story Workflow works<\/summary>/);
  assert.match(css, /\.details > summary[\s\S]*min-height: var\(--pp-touch-target\)/);
});

test("#1725 BUILD keeps the 24x96 map primary while curriculum and selected-block evidence are progressively disclosed", async () => {
  const [coverage, coverageCss, map, mapCss] = await Promise.all([
    read("modules/build/ui/foundations-story-coverage.tsx"),
    read("modules/build/ui/foundations-story-coverage.module.css"),
    read("modules/build/ui/progressive-story-map.tsx"),
    read("modules/build/ui/progressive-story-map.module.css"),
  ]);

  const storyMap = coverage.indexOf("<ProgressiveStoryMap project={project} />");
  const curriculumDetail = coverage.indexOf("<details className={styles.evidenceDisclosure}>");
  assert.ok(storyMap >= 0 && curriculumDetail > storyMap, "24/96 map must remain visible before secondary curriculum evidence");
  assert.match(coverage, /<summary>Curriculum evidence details<\/summary>/);
  assert.match(coverageCss, /\.evidenceDisclosure > summary[\s\S]*min-height: var\(--pp-touch-target\)/);

  assert.match(map, /<details className=\{styles\.inspectorDetails\} data-story-decision-target=/);
  assert.match(map, /Background story text/);
  assert.match(mapCss, /\.inspectorDetails > summary[\s\S]*min-height: var\(--pp-touch-target\)/);
  assert.match(mapCss, /border: 1px solid var\(--pp-line\)/);
  assert.match(mapCss, /background: var\(--pp-surface\)/);
});

test("#1725 does not add another global navigation area", async () => {
  const shortcuts = await read("app/navigation/global-shortcuts.ts");
  const areas = [...shortcuts.matchAll(/\{ id: "(home|create|produce|review|connect|settings)", label:/g)].map((match) => match[1]);
  assert.deepEqual(areas, ["home", "create", "produce", "review", "connect", "settings"]);
});
