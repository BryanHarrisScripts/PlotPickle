import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#1994 Writer's Craft opens All Curriculum before the guided Journey", async () => {
  const [dashboard, journey, explore] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/learn-journey-preview.tsx"),
    read("app/skin-v1/learn-explore.tsx"),
  ]);

  assert.match(dashboard, /if \(writerCraftMenuOpen\)[\s\S]*<LearnJourneyPreview onBack=\{\(\) => setWriterCraftMenuOpen\(false\)\} \/>/u);
  assert.match(journey, /const \[exploreOpen, setExploreOpen\] = useState\(true\)/u);
  assert.match(journey, /if \(exploreOpen\)[\s\S]*<LearnExplore/u);
  assert.match(journey, /onBack=\{\(\) => setExploreOpen\(false\)\}/u);
  assert.match(explore, /aria-label="LEARN Explore All Curriculum"/u);
});

test("#1994 keeps All Curriculum open-access controls and shared progress authority", async () => {
  const explore = await read("app/skin-v1/learn-explore.tsx");

  assert.match(explore, /data-learn-explore-access="unrestricted"/u);
  assert.match(explore, /aria-label="Search all curriculum"/u);
  assert.match(explore, /aria-label="Filter Explore by topic"/u);
  assert.match(explore, /aria-label="Filter Explore by Craft Module"/u);
  assert.match(explore, /data-learn-progress-owner="PPFProject\.learning\.completedLessonIds"/u);
  assert.match(explore, /Back to Journey/u);
});

test("#1994 Phase A preserves the six guided Paths as a secondary view", async () => {
  const journey = await read("app/skin-v1/learn-journey-preview.tsx");

  assert.match(journey, /OPEN JOURNEY \/ 6 PATHS \/ 24 CRAFT MODULES/u);
  assert.match(journey, /preview\.semesters\.map/u);
  assert.match(journey, /data-learn-semester-open="true"/u);
  assert.match(journey, /setExploreOpen\(false\)/u);
});
