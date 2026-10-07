import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";

const readText = (file) => readFile(path.resolve(file), "utf8");

function executableVisualContract(source) {
  const stripped = stripTypeScriptTypes(source).replace(/\bexport\s+/gu, "");
  return vm.runInNewContext(
    stripped + "\n({ isSupportedVisualAssetUrl, supportedVisualAssetKind })",
  );
}

function storyCommand(project, command) {
  const artifacts = [...project.build.foundations.visualArtifacts];
  let accepted = [...project.build.foundations.acceptedVisualArtifactIds];
  if (command.type === "foundations.visual.store") {
    const index = artifacts.findIndex((item) => item.id === command.artifact.id);
    if (index >= 0) artifacts[index] = command.artifact;
    else artifacts.push(command.artifact);
  } else if (command.type === "foundations.visual.accept") {
    const index = artifacts.findIndex((item) => item.id === command.artifactId);
    assert.ok(index >= 0);
    artifacts[index] = { ...artifacts[index], reviewState: "accepted" };
    accepted = [...new Set([...accepted, command.artifactId])];
  } else if (command.type === "foundations.visual.unaccept") {
    const index = artifacts.findIndex((item) => item.id === command.artifactId);
    assert.ok(index >= 0);
    artifacts[index] = { ...artifacts[index], reviewState: "draft" };
    accepted = accepted.filter((id) => id !== command.artifactId);
  } else {
    throw new Error("Unexpected command in #2830 regression.");
  }
  return {
    ...project,
    revision: project.revision + 1,
    updatedAt: command.occurredAt,
    build: {
      ...project.build,
      foundations: {
        ...project.build.foundations,
        visualArtifacts: artifacts,
        acceptedVisualArtifactIds: accepted,
      },
    },
  };
}

test("#2830 real packaged Afterglow Outline visual can Save, Lock, visibly report Lock, and Unlock", async () => {
  const [manifest, snapshot, visualSource, component, styles] = await Promise.all([
    readText("data/afterglow-packaged-current/manifest.json").then(JSON.parse),
    readText("data/afterglow-packaged-current/snapshot.json").then(JSON.parse),
    readText("core/media/visual-asset-url.ts"),
    readText("app/skin-v1/outline-mini-block-anchor-workspace.tsx"),
    readText("app/skin-v1/outline-mini-block-workspace.module.css"),
  ]);
  const visual = executableVisualContract(visualSource);
  const manifestStoryboardUrls = new Set(
    (manifest.assets ?? [])
      .map((item) => item?.publicUrl)
      .filter((value) => typeof value === "string" && value.includes("/storyboard-")),
  );
  const promotedProject = snapshot.project ?? snapshot;
  const packagedArtifact = (promotedProject.build?.foundations?.visualArtifacts ?? []).find((candidate) => (
    candidate.workflow === "storyboard-frame-webp-v2"
    && candidate.reviewState !== "rejected"
    && manifestStoryboardUrls.has(candidate.assetUrl)
    && (candidate.sourceDecisionKeys ?? []).some((key) => /^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/u.test(key))
  ));
  assert.ok(packagedArtifact, "the committed Afterglow snapshot must contain a packaged Storyboard artifact");
  assert.equal(visual.supportedVisualAssetKind(packagedArtifact.assetUrl), "packaged-example");

  const savedFunctionSource = stripTypeScriptTypes(component.slice(
    component.indexOf("function savedLocally"),
    component.indexOf("type Candidate"),
  ));
  const savedLocally = vm.runInNewContext(
    savedFunctionSource + "\nsavedLocally",
    { isSupportedVisualAssetUrl: visual.isSupportedVisualAssetUrl },
  );
  assert.equal(savedLocally(packagedArtifact), (packagedArtifact.sourceDecisionKeys ?? []).includes("storyboard-local-save:v1"));

  const anchorRef = (packagedArtifact.sourceDecisionKeys ?? []).find((key) => /^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/u.test(key));
  assert.ok(anchorRef);
  const match = /^storyboard-anchor:block:block-(\d{2}):mini-([1-4])$/u.exec(anchorRef);
  assert.ok(match);
  const blockNumber = Number(match[1]);
  const miniBlockNumber = Number(match[2]);

  let current = {
    ...promotedProject,
    build: {
      ...promotedProject.build,
      foundations: {
        ...promotedProject.build.foundations,
        acceptedVisualArtifactIds: promotedProject.build.foundations.acceptedVisualArtifactIds.filter((id) => id !== packagedArtifact.id),
        visualArtifacts: promotedProject.build.foundations.visualArtifacts.map((item) => (
          item.id === packagedArtifact.id ? { ...item, reviewState: "draft" } : item
        )),
      },
    },
  };
  const notices = [];
  const handlers = stripTypeScriptTypes(component.slice(
    component.indexOf("  function saveVersion()"),
    component.indexOf("  function deleteVersion()"),
  ));
  const context = vm.createContext({
    Date,
    Error,
    Set,
    LOCAL_SAVE_MARKER: "storyboard-local-save:v1",
    busy: false,
    isSaved: false,
    isLocked: false,
    isSupportedVisualAssetUrl: visual.isSupportedVisualAssetUrl,
    selectedArtifact: current.build.foundations.visualArtifacts.find((item) => item.id === packagedArtifact.id),
    selected: null,
    project: current,
    blockNumber,
    miniBlockNumber,
    anchorRef,
    targetId: `block:block-${String(blockNumber).padStart(2, "0")}`,
    pendingSelectedId: { current: "" },
    createStoryboardReferenceArtifact() {
      throw new Error("The packaged artifact path must not create a duplicate reference artifact.");
    },
    applyStoryCommand: storyCommand,
    setMessage(value) { notices.push(value); },
    commit(next, status) {
      current = next;
      notices.push(status);
    },
  });
  vm.runInContext(handlers, context);

  const originalCount = current.build.foundations.visualArtifacts.length;
  context.saveVersion();
  let artifact = current.build.foundations.visualArtifacts.find((item) => item.id === packagedArtifact.id);
  assert.ok(artifact?.sourceDecisionKeys?.includes("storyboard-local-save:v1"));
  assert.equal(current.build.foundations.visualArtifacts.length, originalCount, "Save must not duplicate packaged image bytes");
  assert.match(notices.at(-1), /Packaged source media remains immutable/u);
  assert.equal(savedLocally(artifact), true);

  context.project = current;
  context.selectedArtifact = artifact;
  context.selected = { kind: "artifact", id: artifact.id, assetUrl: artifact.assetUrl, label: "Afterglow", artifact };
  context.isLocked = false;
  context.toggleLockVersion();
  artifact = current.build.foundations.visualArtifacts.find((item) => item.id === packagedArtifact.id);
  assert.ok(current.build.foundations.acceptedVisualArtifactIds.includes(packagedArtifact.id));
  assert.equal(artifact?.reviewState, "accepted");
  assert.ok(artifact?.sourceDecisionKeys?.includes("storyboard-local-save:v1"));
  assert.equal(current.build.foundations.visualArtifacts.length, originalCount);

  context.project = current;
  context.selectedArtifact = artifact;
  context.selected = { kind: "artifact", id: artifact.id, assetUrl: artifact.assetUrl, label: "Afterglow", artifact };
  context.isLocked = true;
  context.toggleLockVersion();
  artifact = current.build.foundations.visualArtifacts.find((item) => item.id === packagedArtifact.id);
  assert.equal(current.build.foundations.acceptedVisualArtifactIds.includes(packagedArtifact.id), false);
  assert.equal(artifact?.reviewState, "draft");
  assert.ok(artifact?.sourceDecisionKeys?.includes("storyboard-local-save:v1"), "Unlock must not remove Save metadata");
  assert.equal(artifact?.assetUrl, packagedArtifact.assetUrl, "Lock/Unlock must retain the same packaged media identity");
  assert.equal(current.build.foundations.visualArtifacts.length, originalCount);

  assert.match(component, /data-locked=\{isLocked \? "true" : "false"\}/u);
  assert.match(component, /className=\{styles\.lockedOverlay\}>LOCKED</u);
  assert.match(component, /aria-pressed=\{isLocked\}/u);
  assert.match(component, /\{isLocked \? "Unlock" : "Lock"\}/u);
  assert.match(styles, /\.preview\[data-locked="true"\]/u);
  assert.match(styles, /\.lockedOverlay/u);
});
