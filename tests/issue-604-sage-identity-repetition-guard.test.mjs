import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("Sage identity is explicit and cannot invent a production biography", async () => {
  const [playbook, guide] = await Promise.all([
    read("agents/sage-brinewick.md"),
    read("modules/creative-room/curriculum-guide.ts"),
  ]);

  assert.match(playbook, /not a real-world person/i);
  assert.match(playbook, /no personal résumé, production credits, awards, employers, years of professional experience/i);
  assert.match(playbook, /I’m Sage Brinewick, PlotPickle’s Curriculum Guide/i);
  assert.match(playbook, /Never invent any of those details/i);
  assert.doesNotMatch(playbook, /spent a lifetime around scripts/i);

  assert.match(guide, /const SAGE_IDENTITY_TEXT = "I'm Sage Brinewick, PlotPickle's Curriculum Guide/);
  assert.match(guide, /export function sageIdentityReply/);
  assert.match(guide, /who are you\|who is sage brinewick\|what is your role\|what do you do\|tell me about yourself/);
  assert.match(guide, /model: "Sage identity contract"/);
  assert.ok(guide.indexOf("const identity = sageIdentityReply(studentQuestion)") < guide.indexOf("await preflightGuideRuntime()"));
});

test("Sage rejects runaway phrase loops before rendering them", async () => {
  const guide = await read("modules/creative-room/curriculum-guide.ts");

  assert.match(guide, /export function guideAnswerHasRunawayRepetition/);
  assert.match(guide, /words\.slice\(index, index \+ 5\)\.join\(" "\)/);
  assert.match(guide, /if \(next >= 3\) return true/);
  assert.match(guide, /if \(guideAnswerHasRunawayRepetition\(answer\)\) return true/);
  assert.match(guide, /entered a repetition loop/);
  assert.match(guide, /Do not invent credentials, years of experience, job titles, production credits, awards, employers, biography, or personal history for Sage/);
  assert.match(guide, /repeated, looped, or failed to answer the question twice/);
});

test("the screenshot failure pattern would violate the repetition rule", () => {
  const sample = "I'm a Master of the Scripts, a Master of the Scripts, a Master of the Scripts. I've been involved in the editing process for over 10 years and have been involved in the editing process for over 10 years and have been involved in the editing process for over 10 years.";
  const words = sample.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/);
  const counts = new Map();
  let repeated = false;
  for (let index = 0; index <= words.length - 5; index += 1) {
    const phrase = words.slice(index, index + 5).join(" ");
    const count = (counts.get(phrase) || 0) + 1;
    counts.set(phrase, count);
    if (count >= 3) repeated = true;
  }
  assert.equal(repeated, true);
});
