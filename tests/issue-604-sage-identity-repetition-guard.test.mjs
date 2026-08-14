import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("Sage identity facts are explicit but every reply still uses the active LLM", async () => {
  const [playbook, guide] = await Promise.all([
    read("agents/sage-brinewick.md"),
    read("modules/creative-room/curriculum-guide.ts"),
  ]);

  assert.match(playbook, /not a real-world person/i);
  assert.match(playbook, /no personal résumé, production credits, awards, employers, years of professional experience/i);
  assert.match(playbook, /PlotPickle’s Curriculum Guide/i);
  assert.match(playbook, /answer naturally through the active language model/i);
  assert.match(playbook, /Do not return a hard-coded sentence or a response-bank entry/i);
  assert.doesNotMatch(playbook, /spent a lifetime around scripts/i);

  assert.match(guide, /Every Sage reply, including identity and odd conversational questions/);
  assert.match(guide, /await preflightGuideRuntime\(\)/);
  assert.match(guide, /requestGuideModel\(message, 45_000, "fast"\)/);
  assert.doesNotMatch(guide, /SAGE_IDENTITY_TEXT/);
  assert.doesNotMatch(guide, /sageIdentityReply/);
  assert.doesNotMatch(guide, /model: "Sage identity contract"/);
});

test("Sage rejects runaway phrase loops before rendering them", async () => {
  const guide = await read("modules/creative-room/curriculum-guide.ts");

  assert.match(guide, /export function guideAnswerHasRunawayRepetition/);
  assert.match(guide, /words\.slice\(index, index \+ 5\)\.join\(" "\)/);
  assert.match(guide, /if \(next >= 3\) return true/);
  assert.match(guide, /if \(guideAnswerHasRunawayRepetition\(answer\)\) return true/);
  assert.match(guide, /RESPONSE QUALITY RETRY/);
  assert.match(guide, /Do not invent credentials, years of experience, job titles, production credits, awards, employers, biography, memories, or a physical body for Sage/);
  assert.match(guide, /SAGE_QUALITY_ESCALATION_INSTRUCTION/);
  assert.match(guide, /failed to answer the question after repair/);
});

test("startup health also fails Sage repetition loops instead of reporting healthy", async () => {
  const diagnostic = await read("build/startup-agent-diagnostics.ts");

  assert.match(diagnostic, /function repetitionPass/);
  assert.match(diagnostic, /if \(count >= 3\) return false/);
  assert.match(diagnostic, /repetitionSafe: repetitionPass\(text\)/);
  assert.match(diagnostic, /Sage repetition guard/);
  assert.match(diagnostic, /!sage\.repetitionSafe/);
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
