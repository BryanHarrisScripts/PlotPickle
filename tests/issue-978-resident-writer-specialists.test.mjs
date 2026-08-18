import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  loadResidentWriterSpecialist,
  loadResidentWriterSpecialistsForTask,
  residentWriterSpecialistIndex,
  selectResidentWriterSpecialists,
  selfTestResidentWriterSpecialists,
} from "../scripts/resident-writer-specialists.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Resident Writer has five versioned on-demand specialist procedures inside the trusted writer-in-residence Skill package", async () => {
  const config = JSON.parse(await read("config/resident-writer-specialists.json"));
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.packageUri, "skill://plotpickle/writer-in-residence");
  assert.match(config.packageVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(config.selection.mode, "on-demand");
  assert.equal(config.selection.maxSpecialistsPerTurn, 2);
  assert.equal(config.specialists.length, 5);
  assert.deepEqual(config.specialists.map((item) => item.id).sort(), ["character-continuity", "reader-review", "scene-revision", "story-structure", "visual-continuity"]);
});

test("specialist loader requires the #976 trusted package and exposes trust/hash/revision metadata", async () => {
  const source = await read("scripts/resident-writer-specialists.mjs");
  assert.match(source, /trustedAgentSkillIndex/);
  assert.match(source, /package is not trusted/);
  assert.match(source, /trusted-built-in/);
  assert.match(source, /approved-external/);
  assert.match(source, /packageContentSha256/);
  assert.match(source, /packagePinnedRevision/);
  assert.match(source, /packageReviewStatus/);
  const index = await residentWriterSpecialistIndex();
  assert.equal(index.length, 5);
  for (const item of index) {
    assert.match(item.packageContentSha256, /^[a-f0-9]{64}$/);
    assert.equal(item.packageTrustState, "trusted-built-in");
    assert.equal(item.capabilitiesGranted, false);
  }
});

test("all specialist procedures are real bounded reference files and never grant authority", async () => {
  const index = await residentWriterSpecialistIndex();
  for (const item of index) {
    const packet = await loadResidentWriterSpecialist(item.id);
    assert.ok(packet.procedure.startsWith("# "));
    assert.ok(packet.procedure.length > 200);
    assert.equal(packet.authority.grantsTools, false);
    assert.equal(packet.authority.grantsNetwork, false);
    assert.equal(packet.authority.grantsProviderSelection, false);
    assert.equal(packet.authority.grantsDeveloperAuthority, false);
    assert.equal(packet.authority.grantsPpfMutation, false);
    assert.equal(packet.authority.grantsFinalCreativeAuthority, false);
    assert.match(packet.procedureReference, /^\.agents\/skills\/writer-in-residence\/references\/specialists\/[a-z-]+\.md$/);
  }
});

test("on-demand selection chooses relevant procedures and never loads more than two per turn", async () => {
  const selected = await selectResidentWriterSpecialists("Please revise this dialogue scene while checking character voice and continuity.");
  assert.ok(selected.length >= 1 && selected.length <= 2);
  assert.ok(selected.some((item) => item.id === "scene-revision" || item.id === "character-continuity"));
  const loaded = await loadResidentWriterSpecialistsForTask("Review this storyboard image for visual continuity and character costume consistency.");
  assert.ok(loaded.length >= 1 && loaded.length <= 2);
  assert.ok(loaded.some((item) => item.id === "visual-continuity" || item.id === "character-continuity"));
  assert.deepEqual(await selectResidentWriterSpecialists("unrelated-zebra-quantum-no-match"), []);
});

test("scene revision procedure preserves revision-aware PPF and writer approval boundaries", async () => {
  const procedure = await read(".agents/skills/writer-in-residence/references/specialists/scene-revision.md");
  assert.match(procedure, /proposal against the supplied\/base PPF revision/i);
  assert.match(procedure, /stale at apply time/i);
  assert.match(procedure, /rebase\/merge\/regenerate/i);
  assert.match(procedure, /No direct PPF mutation/i);
  assert.match(procedure, /No writer approval by proxy/i);
});

test("fresh reader procedure is advisory and does not turn taste into grading or canon", async () => {
  const procedure = await read(".agents/skills/writer-in-residence/references/specialists/reader-review.md");
  assert.match(procedure, /fresh-reader reaction/i);
  assert.match(procedure, /productive mystery/i);
  assert.match(procedure, /Do not turn personal taste into a rule/i);
  assert.match(procedure, /does not grade the writer/i);
  assert.match(procedure, /PPF canon without explicit writer action/i);
});

test("Resident Writer specialist manifest owns no runtime provider model or BUZZ social settings", async () => {
  const raw = await read("config/resident-writer-specialists.json");
  assert.doesNotMatch(raw, /"provider"\s*:/i);
  assert.doesNotMatch(raw, /"model"\s*:/i);
  assert.doesNotMatch(raw, /"effort"\s*:/i);
  assert.doesNotMatch(raw, /"respondTo"\s*:|"respond-to"\s*:/i);
  assert.doesNotMatch(raw, /"allowlist"\s*:/i);
  assert.doesNotMatch(raw, /"parallelism"\s*:/i);
  assert.doesNotMatch(raw, /"memory"\s*:/i);
  assert.doesNotMatch(raw, /"credentials"\s*:/i);
});

test("Resident Writer specialist loader has no connector execution network or PPF mutation path", async () => {
  const source = await read("scripts/resident-writer-specialists.mjs");
  assert.doesNotMatch(source, /node:child_process|execSync|spawnSync|fork\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(|https?:\/\//);
  assert.doesNotMatch(source, /saveProject|writeProject|applyWriterApprovedCanonicalProposal|ppf-direct-write/);
  assert.doesNotMatch(source, /BUZZ_PRIVATE_KEY|Authorization|apiKey|credential/i);
});

test("Resident Writer specialist self-test passes against the current trusted package hash", async () => {
  const result = await selfTestResidentWriterSpecialists();
  assert.equal(result.ok, true);
  assert.equal(result.count, 5);
  assert.ok(result.selected.length >= 1 && result.selected.length <= 2);
});
