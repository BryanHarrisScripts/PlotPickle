import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const model = read("lib/character-visual-identity.ts");
const generator = read("app/character-image-generator.tsx");
const storyboard = read("app/visual-storyboard.tsx");

test("character visual identity model stores immutable traits, references and approval state", () => {
  for (const field of ["approvedPrompt", "draftPrompt", "negativePrompt", "traits", "references", "wardrobeVariants", "sceneContinuityNotes", "approvedAt", "lockedAt", "pendingRevision"]) assert.match(model, new RegExp(field));
  for (const trait of ["ageRange", "heightBuild", "postureMovement", "faceShape", "skin", "eyes", "hair", "facialHair", "distinguishingMarks", "defaultWardrobe", "accessories", "colourCues"]) assert.match(model, new RegExp(trait));
  for (const angle of ["master", "front", "profile", "three-quarter", "full-body"]) assert.match(model, new RegExp(`"${angle}"`));
});

test("older characters receive a safe lazy migration and retain legacy thumbnails", () => {
  assert.match(model, /createCharacterVisualIdentity/);
  assert.match(model, /normalizeReferences\(\[\], character\.image\)/);
  assert.match(model, /visual-reference-master-legacy/);
  assert.match(model, /CharacterWithVisualIdentity/);
});

test("locked identity edits become a pending version instead of silently replacing canon", () => {
  assert.match(model, /current\.status === "locked"/);
  assert.match(model, /pendingRevision/);
  assert.match(model, /version: current\.version \+ 1/);
  assert.match(model, /approvePendingVisualIdentity/);
  assert.match(generator, /Save as proposed version/);
  assert.match(generator, /Approve and replace locked identity/);
});

test("character editor provides a complete writer-approved identity lock flow", () => {
  for (const label of ["Character Visual Identity Lock", "Stable visual traits", "Identity prompt", "Negative identity prompt", "Reference view", "Approve and lock identity"]) assert.match(generator, new RegExp(label));
  assert.match(generator, /AI is optional/);
  assert.match(generator, /nothing becomes the approved identity without the writer choosing to lock it/i);
});

test("storyboard prompts use exact approved identity packages", () => {
  assert.match(storyboard, /storyboardIdentityInputs/);
  assert.match(storyboard, /approvedCharacterIdentityPrompt/);
  assert.match(storyboard, /approvedCharacterReferenceImages/);
  assert.match(storyboard, /CHARACTER IDENTITY LOCKS/);
  assert.match(storyboard, /identity version/);
  assert.match(storyboard, /Do not drift/);
});

test("storyboard generation hands reference images and identity locks to providers", () => {
  assert.match(storyboard, /referenceImages: unique\(identityInputs\.flatMap/);
  assert.match(storyboard, /identityLocks: identityInputs\.map/);
  assert.match(storyboard, /Character identity status/);
  assert.match(storyboard, /Identity review needed/);
});

test("continuity diagnostics distinguish missing, review and clear states", () => {
  assert.match(model, /CharacterVisualIdentityDiagnostic/);
  assert.match(model, /severity: "blocked"/);
  assert.match(model, /severity: "review"/);
  assert.match(model, /severity: "clear"/);
  assert.match(model, /unapproved visual identity revision/);
});
