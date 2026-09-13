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

test("#1994 consumes the current canonical Explore payload and derives inventory totals", async () => {
  const [explore, route] = await Promise.all([
    read("app/skin-v1/learn-explore.tsx"),
    read("app/api/learn/explore/route.ts"),
  ]);

  assert.match(route, /phase: "phase-d-canonical-integration"/u);
  assert.match(route, /presentationLessonCount: entries\.length/u);
  assert.match(explore, /phase: "phase-d-canonical-integration"/u);
  assert.match(explore, /value\.presentationLessonCount !== value\.entries\.length/u);
  assert.match(explore, /\{payload\.presentationLessonCount\} PRESENTATION LESSONS/u);
  assert.match(explore, /\{payload\.topicCount\} TOPICS/u);
  assert.match(explore, /\{payload\.craftModuleCount\} CRAFT MODULES/u);
  assert.doesNotMatch(explore, /\b88\b/u);
});

test("#1994 Phase A preserves the six guided Paths as a secondary view", async () => {
  const journey = await read("app/skin-v1/learn-journey-preview.tsx");

  assert.match(journey, /OPEN JOURNEY \/ 6 PATHS \/ 24 CRAFT MODULES/u);
  assert.match(journey, /preview\.semesters\.map/u);
  assert.match(journey, /data-learn-semester-open="true"/u);
  assert.match(journey, /setExploreOpen\(false\)/u);
});

test("#1994 Phase B1 gives All Curriculum rows a compact title-first hierarchy", async () => {
  const explore = await read("app/skin-v1/learn-explore.tsx");

  assert.match(explore, /function exploreRowPrimary\(entry: ExploreEntry\)[\s\S]*entry\.presentationOrder[\s\S]*entry\.lesson\.title/u);
  assert.match(explore, /function exploreRowSecondary\(entry: ExploreEntry\)[\s\S]*entry\.topic\.title[\s\S]*Craft Module/u);
  assert.match(explore, /\{filteredEntries\.length\} OF \{payload\.presentationLessonCount\} LESSONS/u);

  const rowsStart = explore.indexOf("{filteredEntries.map");
  const rowsEnd = explore.indexOf("{!filteredEntries.length");
  assert.ok(rowsStart >= 0 && rowsEnd > rowsStart, "All Curriculum browse-row source must remain identifiable.");
  const browseRows = explore.slice(rowsStart, rowsEnd);

  assert.match(browseRows, /exploreRowPrimary\(entry\)/u);
  assert.match(browseRows, /exploreRowSecondary\(entry\)/u);
  assert.doesNotMatch(browseRows, /entry\.lesson\.apply/u);
  assert.doesNotMatch(browseRows, /entry\.lesson\.duration/u);
  assert.doesNotMatch(browseRows, /\bOPEN\b|\bAVAILABLE\b/u);
});

test("#1994 Phase B1 uses the existing compact status box for completion rather than access prose", async () => {
  const explore = await read("app/skin-v1/learn-explore.tsx");
  const rowsStart = explore.indexOf("{filteredEntries.map");
  const rowsEnd = explore.indexOf("{!filteredEntries.length");
  const browseRows = explore.slice(rowsStart, rowsEnd);

  assert.match(browseRows, /data-learn-lesson-completed=\{completed \? "true" : "false"\}/u);
  assert.match(browseRows, /aria-label=\{completed \? "Lesson complete" : "Lesson incomplete"\}/u);
  assert.match(browseRows, /pp-skin-v1-dashboard-status-box\$\{completed \? " is-active" : ""\}/u);
  assert.match(explore, /UP\/DOWN MOVES · ENTER OPENS · ESC RETURNS TO JOURNEY\./u);
});

test("#1994 Phase B2 removes duration and repeated access prose from secondary Journey lesson rows", async () => {
  const journey = await read("app/skin-v1/learn-journey-preview.tsx");
  const lessonsStart = journey.indexOf("{openCourseContent.lessons.map");
  const lessonsEnd = journey.indexOf("</div>\n          <p", lessonsStart);
  assert.ok(lessonsStart >= 0 && lessonsEnd > lessonsStart, "Journey lesson-row source must remain identifiable.");
  const lessonRows = journey.slice(lessonsStart, lessonsEnd);

  assert.match(lessonRows, /\[\{shortcut\}\] \{lesson\.title\}/u);
  assert.doesNotMatch(lessonRows, /lesson\.duration/u);
  assert.doesNotMatch(lessonRows, /\bOPEN\b|\bAVAILABLE\b/u);
  assert.match(lessonRows, /data-learn-lesson-completed=\{completed \? "true" : "false"\}/u);
  assert.match(lessonRows, /aria-label=\{completed \? "Lesson complete" : "Lesson incomplete"\}/u);
});

test("#1994 Phase B2 keeps Path and Craft Module rows concise without weakening structural authority", async () => {
  const journey = await read("app/skin-v1/learn-journey-preview.tsx");

  assert.match(journey, /\{command\} · \{progress\}/u);
  assert.doesNotMatch(journey, /\{course\.purpose\} · \{progress\} \[AVAILABLE\]/u);
  assert.match(journey, /\{command\} · CRAFT MODULES \{firstModule\}–\{lastModule\}/u);
  assert.doesNotMatch(journey, /4 modules · lesson content available/u);

  assert.match(journey, /data-learn-course-status="wired"/u);
  assert.match(journey, /data-learn-course-content="available"/u);
  assert.match(journey, /data-learn-semester-content="wired"/u);
  assert.match(journey, /recommendedSequenceIsAccessControl: false/u);
  assert.match(journey, /humanMayLearnOutOfOrder: true/u);
});

test("#1994 Phase B2 removes the obsolete 88-lesson Journey shortcut without inventing a new static count", async () => {
  const journey = await read("app/skin-v1/learn-journey-preview.tsx");

  assert.match(journey, /\[E\] EXPLORE \/ ALL CURRICULUM - SEARCH · TOPIC · CRAFT MODULE/u);
  assert.doesNotMatch(journey, /\b88 PRESENTATION LESSONS\b/u);
  assert.doesNotMatch(journey, /UNRESTRICTED SEARCH \/ BROWSE/u);
});
