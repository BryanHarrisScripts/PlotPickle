import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("Mastra is the live Learn agent runtime", async () => {
  const [runtime, gateway, shell, pkg] = await Promise.all([
    read("build/mastra-agent-runtime.ts"),
    read("build/writing-assistant-gateway.ts"),
    read("app/learn-three-column-shell.tsx"),
    read("package.json"),
  ]);
  assert.match(runtime, /from "@mastra\/core\/agent"/);
  assert.match(runtime, /new Mastra\(\{ agents/);
  assert.match(runtime, /agent\.generate\(prompt\)/);
  assert.match(gateway, /askPlotPickleAgent/);
  assert.match(gateway, /mastraRuntimeStatus/);
  assert.match(shell, /Curriculum agent ready/);
  assert.equal(JSON.parse(pkg).dependencies["@mastra/core"], "1.57.0");
});

test("Learn exposes one curriculum-wide guide backed by a versioned 81-module index", async () => {
  const [runtime, shell, curriculum, index] = await Promise.all([
    read("build/mastra-agent-runtime.ts"),
    read("app/learn-three-column-shell.tsx"),
    read("build/plotpickle-curriculum.ts"),
    read("build/plotpickle-curriculum-index.json"),
  ]);
  assert.match(runtime, /"curriculum-guide"/);
  assert.match(runtime, /curriculumContext\(input\.message\)/);
  assert.match(shell, /agentId: "curriculum-guide"/);
  assert.match(shell, /81 modules indexed/);
  assert.match(curriculum, /retrieveCurriculum/);
  assert.equal(JSON.parse(index).length, 81);
});
