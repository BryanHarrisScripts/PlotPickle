import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CHARACTER_DEVELOPMENT_WORKSPACE_STATES,
  createCharacterDevelopmentWorkspaceProjection,
} from "../core/visual-production/character-development-workspace.mjs";

function projection(overrides = {}) {
  return createCharacterDevelopmentWorkspaceProjection({
    projectId: "afterglow-v9",
    ppfRevision: "revision:42",
    characterId: "character:ren",
    characterName: "Ren",
    identityStatus: "locked",
    characterEvidence: {
      physical: ["Lean adult with a narrow angular face."],
      performance: ["Withdrawal protects control until honesty costs less."],
      wardrobe: ["Charcoal field coat."],
      props: ["Brass camera."],
      powersEffects: [],
      relationships: ["Isobel: honesty pressure."],
      locationsWorld: ["Wet industrial exterior with hard practical light."],
      visualDo: ["Preserve the accepted angular face and lean proportions."],
      visualAvoid: ["Do not change apparent age or costume without evidence."],
    },
    approvedVisualRefs: ["/api/local-ai/assets/ren-approved.webp"],
    observedVisualRefs: ["/api/local-ai/assets/ren-lighting-reference.jpg"],
    referenceAngles: ["master", "front", "profile"],
    ...overrides,
  });
}

test("#1557 workspace projection exposes the full PlotPickle development board without inventing acceptance", () => {
  const result = projection();
  assert.equal(result.projectId, "afterglow-v9");
  assert.equal(result.ppfRevision, "revision:42");
  assert.equal(result.studies.length, 8);
  assert.deepEqual(result.studies.map((study) => study.type), [
    "reference-board",
    "turnaround",
    "expressions",
    "movement",
    "wardrobe-props",
    "powers-effects",
    "palette-materials",
    "environment-interaction",
  ]);
  assert.ok(result.studies.every((study) => CHARACTER_DEVELOPMENT_WORKSPACE_STATES.includes(study.state)));
  assert.equal(result.studies.find((study) => study.type === "powers-effects").state, "not-applicable");
  assert.equal(result.studies.find((study) => study.type === "turnaround").state, "defined");
  assert.equal(result.studies.some((study) => study.state === "locked"), false, "A locked identity must not silently lock development studies.");
});

test("#1557 workspace keeps canonical, accepted and observed evidence states distinct", () => {
  const result = projection();
  const canonical = result.evidenceLanes.find((lane) => lane.id === "canonical-character");
  const accepted = result.evidenceLanes.find((lane) => lane.id === "accepted-identity");
  const observed = result.evidenceLanes.find((lane) => lane.id === "observed-references");
  assert.equal(canonical.state, "defined");
  assert.equal(accepted.state, "locked");
  assert.equal(accepted.count, 1);
  assert.equal(observed.state, "observed");
  assert.equal(observed.count, 1);
});

test("#1557 generated candidates remain emerging and targeted stale studies override candidate readiness", () => {
  const result = projection({
    generatedStudyRefs: {
      expressions: ["/api/local-ai/assets/ren-expressions.png"],
      "wardrobe-props": ["/api/local-ai/assets/ren-wardrobe.png"],
    },
    staleStudyTypes: ["wardrobe-props"],
  });
  assert.equal(result.studies.find((study) => study.type === "expressions").state, "emerging");
  assert.equal(result.studies.find((study) => study.type === "expressions").candidateCount, 1);
  assert.equal(result.studies.find((study) => study.type === "wardrobe-props").state, "stale");
  assert.equal(result.summary.emerging, 1);
  assert.equal(result.summary.stale, 1);
});

test("#1557 development board is projected inside the existing Character Visual Identity workspace and is read-only", async () => {
  const [component, projectionSource] = await Promise.all([
    readFile(new URL("../app/character-image-generator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../core/visual-production/character-development-workspace.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(component, /createCharacterDevelopmentWorkspaceProjection/);
  assert.match(component, /data-character-development-board/);
  for (const studyType of ["reference-board", "turnaround", "expressions", "movement", "wardrobe-props", "powers-effects", "palette-materials", "environment-interaction"]) {
    assert.match(projectionSource, new RegExp(studyType));
  }

  const boardStart = component.indexOf('<section className={styles.developmentBoard}');
  const boardEnd = component.indexOf("</section>", boardStart);
  assert.ok(boardStart >= 0 && boardEnd > boardStart);
  const boardMarkup = component.slice(boardStart, boardEnd);
  assert.doesNotMatch(boardMarkup, /<button|onClick=|fetch\(|localStorage|sessionStorage|indexedDB/i);
  assert.match(boardMarkup, /read-only projection/i);
  assert.match(boardMarkup, /cannot become accepted evidence from this board/i);
  assert.doesNotMatch(projectionSource, /applyStoryCommand|localStorage|sessionStorage|indexedDB|sqlite|database|fetch\(/i);
});
