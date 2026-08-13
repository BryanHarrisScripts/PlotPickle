import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("lesson changes and the explicit control return the Creative Canvas to its top", async () => {
  const workspace = await read("modules/learn/ui/learn-workspace.tsx");

  assert.match(workspace, /const lessonRef = useRef<HTMLElement>\(null\)/);
  assert.match(workspace, /lessonRef\.current\?\.scrollTo\(\{ top: 0 \}\)/);
  assert.match(workspace, /window\.requestAnimationFrame/);
  assert.match(workspace, /window\.scrollTo\(\{ top: 0 \}\)/);
  assert.match(workspace, /className=\{styles\.topOfPage\}/);
  assert.match(workspace, />\s*Top of page\s*</);
});

test("Sage requests a dedicated reflection set and refreshes it after three minutes", async () => {
  const contract = await read("core/contracts/curriculum-guide.ts");
  const workspace = await read("modules/learn/ui/learn-workspace.tsx");

  assert.match(contract, /intent: "answer" \| "reflection"/);
  assert.match(contract, /previousQuestions\?: readonly string\[\]/);
  assert.match(contract, /reflectionSource\?: "agent" \| "lesson-fallback"/);
  assert.match(workspace, /const REFLECTION_REFRESH_MS = 3 \* 60 \* 1_000/);
  assert.match(workspace, /intent: "reflection"/);
  assert.match(workspace, /previousQuestions: reflectionHistory/);
  assert.match(workspace, /window\.setTimeout/);
  assert.match(workspace, /reflectionRequestRef/);
  assert.match(workspace, /Three-minute reflection/);
  assert.match(workspace, /reflection\.questions\.map/);
});

test("Sage rejects unusable model output and labels the lesson-grounded fallback honestly", async () => {
  const guide = await read("modules/creative-room/curriculum-guide.ts");
  const runtime = await read("build/mastra-agent-runtime.ts");
  const workspace = await read("modules/learn/ui/learn-workspace.tsx");

  assert.match(guide, /smollm2:135m-instruct-q2_K/);
  assert.match(guide, /cleanReflectionQuestions/);
  assert.match(guide, /questions\.length >= 2/);
  assert.match(guide, /reflectionSource: "lesson-fallback"/);
  assert.match(runtime, /output exactly three short standalone questions grounded in the active lesson/);
  assert.match(workspace, /Lesson-grounded fallback/);
  assert.doesNotMatch(workspace, /reflection\.source === "lesson-fallback" \? "Asked by Sage"/);
});

test("lesson switching cancels stale reflection work and resets the Sage conversation", async () => {
  const workspace = await read("modules/learn/ui/learn-workspace.tsx");

  assert.match(workspace, /setMessages\(\[\]\)/);
  assert.match(workspace, /setReflectionHistory\(\[\]\)/);
  assert.match(workspace, /requestId !== reflectionRequestRef\.current/);
  assert.match(workspace, /window\.clearTimeout\(reflectionTimer\)/);
  assert.match(workspace, /reflectionRequestRef\.current \+= 1/);
  assert.match(workspace, /window\.clearTimeout\(timeout\)/);
});
