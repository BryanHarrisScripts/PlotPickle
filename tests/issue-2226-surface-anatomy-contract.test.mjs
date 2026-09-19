import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

test("#2226 hardens the four-layer Skin V1 interface specification stack", async () => {
  const [anatomy, composition, grammar] = await Promise.all([
    readJson("config/skin-v1-surface-anatomy-contract.json"),
    readJson("config/skin-v1-surface-composition-reference.json"),
    readJson("config/skin-v1-surface-grammar.json"),
  ]);

  assert.deepEqual(anatomy.fourLayerModel.map((layer) => layer.id), [
    "tokens",
    "components-and-composition",
    "surface-anatomy",
    "surface-declaration",
  ]);
  assert.equal(composition.authority.anatomySource, "config/skin-v1-surface-anatomy-contract.json");
  assert.equal(composition.authority.surfaceDeclarationDirectory, "config/skin-v1-surface-declarations/");
  assert.equal(grammar.anatomyContract, "config/skin-v1-surface-anatomy-contract.json");
  assert.equal(grammar.specSheetContract, "config/skin-v1-spec-sheet-contract.json");
  assert.equal(grammar.surfaceDeclarations, "config/skin-v1-surface-declarations/*.json");
});

test("#2226 anatomy declares title, return and navigation placement rather than inferring them", async () => {
  const anatomy = await readJson("config/skin-v1-surface-anatomy-contract.json");

  assert.deepEqual(anatomy.titleStack.globalHeader.pattern, [
    "PLOTPICKLE",
    "<CURRENT SURFACE>",
    "SKIN V1",
  ]);
  assert.equal(anatomy.titleStack.globalHeader.productAlignment, "left");
  assert.equal(anatomy.titleStack.globalHeader.titleAlignment, "center");
  assert.equal(anatomy.titleStack.globalHeader.skinAlignment, "right");

  assert.equal(anatomy.titleStack.workspaceHeader.alignment, "left");
  assert.deepEqual(anatomy.titleStack.workspaceHeader.verticalOrder, [
    "eyebrow",
    "title",
    "subtitle",
    "context-metadata",
  ]);
  assert.equal(anatomy.titleStack.workspaceHeader.returnActionAllowedHere, false);

  assert.equal(anatomy.navigationSemantics.destinationNavigation.preferredPlacement[0], "left-rail");
  assert.equal(anatomy.navigationSemantics.destinationNavigation.countsAsWorkspaceColumn, false);
  assert.equal(anatomy.navigationSemantics.returnAction.preferredPlacement[0], "surface-action-row");
  assert.equal(anatomy.navigationSemantics.returnAction.alignment, "right");
  assert.equal(anatomy.navigationSemantics.localViewTabs.navigation, false);
  assert.equal(anatomy.navigationSemantics.filters.navigation, false);
});

test("#2226 anatomy vocabulary distinguishes navigation, content, controls and context", async () => {
  const anatomy = await readJson("config/skin-v1-surface-anatomy-contract.json");
  const requiredRoles = [
    "destination-navigation",
    "submenu",
    "content-selector",
    "primary-content",
    "secondary-content",
    "editor",
    "canvas",
    "media-preview",
    "script-preview",
    "timeline",
    "inspector",
    "form",
    "fields",
    "metadata",
    "toolbar",
    "tabs",
    "filters",
    "list",
    "grid",
    "directory",
    "status",
    "help",
    "context",
    "evidence",
    "reference",
    "history",
  ];

  for (const role of requiredRoles) assert.ok(anatomy.regionRoles[role], "missing role " + role);

  assert.equal(anatomy.regionRoles["destination-navigation"].navigation, true);
  assert.equal(anatomy.regionRoles["submenu"].navigation, true);
  assert.equal(anatomy.regionRoles["content-selector"].navigation, false);
  assert.equal(anatomy.regionRoles["script-preview"].navigation, false);
  assert.equal(anatomy.regionRoles["inspector"].navigation, false);
  assert.equal(anatomy.regionRoles["timeline"].navigation, false);
  assert.equal(anatomy.regionRoles["list"].description.includes("semantics come from parent role"), true);
});

test("#2226 column counting is semantic and excludes chrome, menus, tabs and timeline", async () => {
  const anatomy = await readJson("config/skin-v1-surface-anatomy-contract.json");
  const excluded = new Set(anatomy.columnCounting.neverCount);

  for (const role of [
    "global-header",
    "surface-action-row",
    "workspace-header",
    "status-footer",
    "toolbar",
    "tabs",
    "filters",
    "destination-navigation",
    "submenu",
    "timeline",
  ]) assert.ok(excluded.has(role), "expected excluded column role " + role);

  assert.ok(anatomy.columnCounting.importantConsequences.some((value) =>
    value.includes("destination menu plus editor plus inspector is still a two-column workspace")
  ));
});

test("#2226 Scene Workspace declaration treats script, playback, inspector and timeline as work semantics, not menus", async () => {
  const [scene, registry] = await Promise.all([
    readJson("config/skin-v1-surface-declarations/scene-workspace.json"),
    readJson("config/skin-v1-surface-registry.json"),
  ]);
  const registered = registry.surfaces.find((surface) => surface.id === "scene-timeline");

  assert.ok(registered);
  assert.equal(scene.surfaceId, registered.id);
  assert.equal(scene.registryParent, registered.parent);
  assert.equal(scene.formatProfile.layout, registered.formatProfile.layout);
  assert.equal(scene.contentLayout.workspaceColumnCount, 3);
  assert.equal(scene.contentLayout.primaryRegionId, "playback");

  const byId = new Map(scene.contentLayout.regions.map((region) => [region.id, region]));
  assert.equal(byId.get("script").role, "script-preview");
  assert.equal(byId.get("script").navigation, false);
  assert.equal(byId.get("playback").role, "media-preview");
  assert.equal(byId.get("playback").dominance, "primary");
  assert.equal(byId.get("inspector").role, "inspector");
  assert.equal(byId.get("inspector").navigation, false);
  assert.equal(byId.get("timeline").role, "timeline");
  assert.equal(byId.get("timeline").countsAsWorkspaceColumn, false);
  assert.deepEqual(byId.get("timeline").spansRegions, ["playback", "inspector"]);
  assert.deepEqual(byId.get("timeline").lanes.map((lane) => lane.literalLabel), [
    "Dialogue",
    "Action",
    "Shot",
    "Audio",
  ]);

  assert.deepEqual(scene.navigationDeclaration.destinationNavigationRegions, []);
  assert.match(scene.navigationDeclaration.explicitRule, /not product navigation/u);
});

test("#2226 Scene Workspace declaration preserves source design boundaries", async () => {
  const scene = await readJson("config/skin-v1-surface-declarations/scene-workspace.json");

  assert.equal(scene.visualRules.avoidNestedDecorativeFrames, true);
  assert.equal(scene.visualRules.onePrimaryWorkArea, "playback");
  assert.equal(scene.visualRules.categoryColorMayAssistButNotCarryMeaningAlone, true);
  assert.equal(scene.visualRules.keyboardOperationRequired, true);
  assert.ok(scene.architectureBoundaries.includes("The timeline is a disposable projection and not a competing story store."));
  assert.ok(scene.architectureBoundaries.includes("The first delivery requires no new game engine and must work with local media without a cloud model."));
});

test("#2226 spec-sheet contract forces semantic annotations and controls invention", async () => {
  const contract = await readJson("config/skin-v1-spec-sheet-contract.json");

  assert.equal(contract.requiredOutputs.regionLabelsRequired, true);
  assert.equal(contract.requiredOutputs.regionRoleLabelsRequired, true);
  assert.equal(contract.requiredOutputs.navigationSemanticsRequired, true);
  assert.equal(contract.requiredOutputs.workspaceColumnCountRequired, true);
  assert.equal(contract.requiredOutputs.titleStackRequired, true);
  assert.match(contract.contentPolicies.literal, /exactly/u);
  assert.match(contract.contentPolicies.illustrative, /does not change structure/u);
  assert.ok(contract.interpretationRules.includes("Do not invent a navigation region because a column or list exists."));
  assert.ok(contract.interpretationRules.includes("A spec sheet is explanatory evidence, not a new visual authority."));
});

test("#2226 maps all specification-layer production ownership fail-closed", async () => {
  const ownership = await readJson("config/verification/ownership-map.json");
  const composition = ownership.rules.find((rule) => rule.id === "skin-v1-surface-composition-reference");
  const anatomy = ownership.rules.find((rule) => rule.id === "skin-v1-surface-anatomy-and-declarations");

  assert.equal(composition.ownerLayer, "experience-skins");
  assert.ok(composition.include.includes("config/skin-v1-surface-composition-reference.json"));
  assert.equal(anatomy.ownerLayer, "experience-contract");
  assert.ok(anatomy.include.includes("config/skin-v1-surface-anatomy-contract.json"));
  assert.ok(anatomy.include.includes("config/skin-v1-spec-sheet-contract.json"));
  assert.ok(anatomy.include.includes("config/skin-v1-surface-declarations/**"));
});
