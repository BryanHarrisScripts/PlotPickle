import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  interpretationIntegrity,
  requirementTextsFromInterpretation,
} from "../build/dsdd/dsdd-integrity.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

const repeatedNoProblem = Array.from(
  { length: 20 },
  () => "I'm going to go ahead and say it's not a problem.",
).join(" ");

test("#2369 rejects the exact repeated no-problem dogfood failure from #2366", () => {
  const human = "When you go into Learn, the first screen should be Explore All with all curriculum topics and 96 presentation lessons. The other menus are not required.";
  const result = interpretationIntegrity(human, repeatedNoProblem);
  assert.equal(result.ok, false);
  assert.match(result.message, /repeat|no problem|lost the subject/iu);
});

test("#2369 rejects a false no-problem interpretation for the Dashboard Mind Map request from #2367", () => {
  const human = "Move Story under Discover and change Discover to Mind Map in the PlotPickle menu.";
  const result = interpretationIntegrity(human, "I'm going to go ahead and say it's not a problem. I'm going to go ahead.");
  assert.equal(result.ok, false);
  assert.match(result.message, /no problem|Human narration|repeat|lost the subject/iu);
});

test("#2369 accepts concise interpretations that preserve the Human subject", () => {
  const learn = interpretationIntegrity(
    "In Learn, show Explore All and the 96 presentation lessons first. The extra menus are not required.",
    "Learn should open directly to Explore All and the 96 presentation lessons, without requiring the extra menus.",
  );
  assert.equal(learn.ok, true);

  const dashboard = interpretationIntegrity(
    "Move Story under Discover and rename Discover to Mind Map.",
    "On the Dashboard, rename Discover to Mind Map and place Story beneath that Mind Map destination.",
  );
  assert.equal(dashboard.ok, true);
});

test("#2369 allows a no-action interpretation only when the Human actually says there is no problem", () => {
  const result = interpretationIntegrity(
    "I checked this workflow and it is not a problem. No development action is required.",
    "Understood. This is not a problem and no development action is required. I’ll retain it as a UAT observation.",
  );
  assert.equal(result.ok, true);
});

test("#2369 requirement extraction deduplicates repeated bullets instead of creating a giant repeated R1", () => {
  const requirements = requirementTextsFromInterpretation([
    "- Learn opens to Explore All.",
    "- Learn opens to Explore All.",
    "- Show all 96 presentation lessons.",
  ].join("\n"));
  assert.deepEqual(requirements, [
    "Learn opens to Explore All.",
    "Show all 96 presentation lessons.",
  ]);
});

test("#2369 server revalidates semantic integrity before persistence, lock, draft and publish", async () => {
  const gateway = await read("build/dsdd/dsdd-session-gateway.ts");
  assert.match(gateway, /assertInterpretationIntegrity\(latestHuman\.text, interpretation\)/u);
  assert.match(gateway, /assertInterpretationIntegrity\(human\.text, interpretation\.text\)/u);
  assert.match(gateway, /assertInterpretationIntegrity\(intent\.humanStatement, intent\.understoodMeaning\)/u);
  assert.match(gateway, /requirementTextsFromInterpretation/u);
});
