import { readFile } from "node:fs/promises";
import path from "node:path";

function normalizedTerms(value) {
  return Array.isArray(value) ? value.map((term) => String(term)).filter(Boolean) : [];
}

async function read(root, relative) {
  return readFile(path.join(root, relative), "utf8");
}

async function verifyProbe(root, probe) {
  const files = Array.isArray(probe.files) ? probe.files : [probe.file].filter(Boolean);
  const fileResults = [];
  let combined = "";
  for (const file of files) {
    try {
      const content = await read(root, file);
      combined += `\n${content}`;
      fileResults.push({ file, exists: true });
    } catch {
      fileResults.push({ file, exists: false });
    }
  }

  const missingTerms = normalizedTerms(probe.requiredTerms).filter((term) => !combined.includes(term));
  const missingFiles = fileResults.filter((item) => !item.exists).map((item) => item.file);
  return {
    id: probe.id,
    label: probe.label ?? probe.id,
    passed: missingFiles.length === 0 && missingTerms.length === 0,
    missingFiles,
    missingTerms,
  };
}

function verifyHumanRoutes(manifest) {
  const stages = manifest?.humanUat?.stages ?? [];
  const fixture = manifest?.fixture ?? {};
  const requiredIds = ["story-cards", "write", "outline", "storyboard", "previs", "scene-workspace", "production"];
  const found = new Set(stages.map((stage) => stage.id));
  const errors = [];
  for (const id of requiredIds) if (!found.has(id)) errors.push(`missing Human UAT stage: ${id}`);

  for (const stage of stages) {
    if (!String(stage.route ?? "").includes(`block=${fixture.blockNumber}`)) {
      errors.push(`${stage.id}: route does not preserve Block ${fixture.blockNumber}`);
    }
    if (!String(stage.route ?? "").includes(`mini=${fixture.miniBlockNumber}`)) {
      errors.push(`${stage.id}: route does not preserve Mini-Block ${fixture.miniBlockNumber}`);
    }
    if (!String(stage.selector ?? "").trim()) errors.push(`${stage.id}: selector is missing`);
  }
  return {
    passed: errors.length === 0,
    errors,
    stages: stages.map((stage) => ({ id: stage.id, route: stage.route, selector: stage.selector })),
  };
}

export async function verifyStoryToScreenAcceptance(root, manifest) {
  const fixtureProofs = [];
  for (const proof of manifest.fixtureProofs ?? []) fixtureProofs.push(await verifyProbe(root, proof));

  const stages = [];
  for (const stage of manifest.ciStages ?? []) stages.push(await verifyProbe(root, stage));

  const humanUat = verifyHumanRoutes(manifest);
  const fixture = manifest.fixture ?? {};
  const fixtureIdentityErrors = [];
  if (manifest.schemaVersion !== 1) fixtureIdentityErrors.push("schemaVersion must be 1");
  if (fixture.id !== "afterglow-v8-v9-v10-24x96-evidence-matrix") fixtureIdentityErrors.push("unexpected Afterglow fixture id");
  if (fixture.projectTitle !== "Afterglow: Reflections of Sentience") fixtureIdentityErrors.push("unexpected Afterglow project title");
  if (fixture.sourceVersion !== "v9") fixtureIdentityErrors.push("acceptance source must be v9 baseline");
  if (fixture.blockNumber !== 17 || fixture.miniBlockNumber !== 1) fixtureIdentityErrors.push("executable acceptance slice must remain Block 17.1");
  if (fixture.blockTitle !== "Waves of Connections") fixtureIdentityErrors.push("Block 17 title drifted");
  if (fixture.anchorRef !== "storyboard-anchor:block:block-17:mini-1") fixtureIdentityErrors.push("Block 17.1 anchor drifted");
  if (fixture.storyboardReferenceRef !== "afterglow-block-17-mini-1") fixtureIdentityErrors.push("Block 17.1 storyboard reference drifted");
  if (fixture.cloudSpendAllowed !== false) fixtureIdentityErrors.push("ordinary CI must not authorize cloud spend");

  const failedFixtureProofs = fixtureProofs.filter((item) => !item.passed);
  const failedStages = stages.filter((item) => !item.passed);
  const passed = fixtureIdentityErrors.length === 0
    && failedFixtureProofs.length === 0
    && failedStages.length === 0
    && humanUat.passed;

  return {
    schemaVersion: 1,
    passed,
    fixture: {
      id: fixture.id,
      projectTitle: fixture.projectTitle,
      blockNumber: fixture.blockNumber,
      miniBlockNumber: fixture.miniBlockNumber,
      blockTitle: fixture.blockTitle,
      anchorRef: fixture.anchorRef,
    },
    fixtureIdentityErrors,
    fixtureProofs,
    stages,
    humanUat,
    ordinaryCi: {
      cloudSpendAllowed: false,
      providerGenerationExecuted: false,
      subjectiveQualityJudgment: false,
    },
  };
}
