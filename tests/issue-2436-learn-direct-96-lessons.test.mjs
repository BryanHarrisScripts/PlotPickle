import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { plotPickleCurriculum } from "../adapters/curriculum/current-catalog.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2436 Learn enters the canonical 96-lesson browser directly", async () => {
  const [journey, explore, route, registryText] = await Promise.all([
    read("app/skin-v1/learn-journey-preview.tsx"),
    read("app/skin-v1/learn-explore.tsx"),
    read("app/api/learn/explore/route.ts"),
    read("config/skin-v1-surface-registry.json"),
  ]);

  assert.equal(plotPickleCurriculum.length, 96);
  assert.match(route, /if \(entries\.length !== 96\)/u);
  assert.match(route, /presentationLessonCount: entries\.length/u);

  assert.match(journey, /const \[exploreOpen, setExploreOpen\] = useState\(true\)/u);
  assert.match(journey, /if \(exploreOpen\)[\s\S]*<LearnExplore/u);
  assert.match(journey, /onDashboard=\{onBack\}/u);
  assert.doesNotMatch(journey, /onBack=\{\(\) => setExploreOpen\(false\)\}/u);

  assert.match(explore, /aria-label="Search all curriculum"/u);
  assert.match(explore, /aria-label="Filter Explore by topic"/u);
  assert.match(explore, /aria-label="Filter Explore by Craft Module"/u);
  assert.match(explore, /\{filteredEntries\.length\} OF \{payload\.presentationLessonCount\} LESSONS/u);

  const registry = JSON.parse(registryText);
  const learnSurface = registry.surfaces.find((surface) => surface.id === "writers-craft");
  assert.equal(learnSurface?.runtimeReadySelector, "section[aria-label=\'LEARN Explore All Curriculum\'][data-learn-explore-access=\'unrestricted\'][data-learn-explore-view=\'directory\']");
});

test("#2436 Learn returns to Dashboard without an intermediate Learn landing surface", async () => {
  const explore = await read("app/skin-v1/learn-explore.tsx");

  assert.doesNotMatch(explore, /Back to Learn/u);
  assert.match(explore, /Back to Dashboard/u);
  assert.match(explore, /Back to All Curriculum/u);
  assert.match(explore, /if \(event\.key === "Escape"\)[\s\S]*onDashboard\(\)/u);
  assert.match(explore, /data-learn-progress-owner="PPFProject\.learning\.completedLessonIds"/u);

  const dashboardButtons = explore.match(/Back to Dashboard/g) ?? [];
  assert.ok(dashboardButtons.length >= 3, "Loading, directory, and lesson states must all expose Dashboard return.");
});
