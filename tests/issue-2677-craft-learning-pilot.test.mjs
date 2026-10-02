import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PILOT_CRAFT_CAPABILITIES, PILOT_CRAFT_GOVERNANCE } from "../core/learning/pilot-craft-capabilities.ts";

const readJson = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));

test("#2677 six pilot capabilities map into canonical Learn topics", async () => {
  const index = await readJson("learn/index.json");
  const topics = new Set(index.files.map((entry) => entry.topic));
  assert.equal(PILOT_CRAFT_CAPABILITIES.length, 6);
  for (const capability of PILOT_CRAFT_CAPABILITIES) {
    assert.ok(capability.lessonTopics.length > 0);
    for (const topic of capability.lessonTopics) assert.ok(topics.has(topic), `${capability.id} references unknown Learn topic ${topic}`);
  }
});

test("#2677 pilot preserves Human authority and bounded routing", () => {
  assert.deepEqual(PILOT_CRAFT_GOVERNANCE.invocationModes, ["learn", "authoring-proposal"]);
  assert.equal(PILOT_CRAFT_GOVERNANCE.primaryCapabilityCount, 1);
  assert.equal(PILOT_CRAFT_GOVERNANCE.maximumSupportingCapabilities, 2);
  assert.equal(PILOT_CRAFT_GOVERNANCE.canonicalWriteAuthority, false);
  assert.equal(PILOT_CRAFT_GOVERNANCE.authoringProposalRequiresHumanAcceptance, true);
});

test("#2677 tropes and reader response remain advisory", () => {
  assert.equal(PILOT_CRAFT_GOVERNANCE.tropesAreAdvisory, true);
  assert.equal(PILOT_CRAFT_GOVERNANCE.readerResponseIsSimulated, true);
  assert.ok(PILOT_CRAFT_CAPABILITIES.find((item) => item.id === "craft-reader-response")?.actions.includes("reader-response"));
});
