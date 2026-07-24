import { readFile, writeFile } from "node:fs/promises";

async function replace(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) throw new Error(`Pattern not found in ${path}: ${before.slice(0, 120)}`);
  await writeFile(path, source.replace(before, after));
}

await replace(
  "lib/collaboration-handbook.ts",
  "export function createDefaultProposalPacket(project: PlotPickleProject, brief?: ContributionBrief): ProposalReviewPacket {",
  `export function createAfterglowContributorExample(project: PlotPickleProject) {\n  const owner = project.rights.projectOwner || \"Bryan Elgin Harris / Project Owner\";\n  const block = project.blocks.find((item) => item.number === 21) ?? project.blocks.at(-1) ?? project.blocks[0];\n  const agreement: CollaborationAgreement = {\n    ...createDefaultCollaborationAgreement(project),\n    model: \"invited-contributor\",\n    ownerName: owner,\n    canonicalAuthority: owner,\n    privacy: \"private-repository\",\n    unsolicitedProposals: false,\n    confidentiality: \"Afterglow drafts, images, prompts, research and unpublished story decisions remain private unless the project owner approves sharing.\",\n    creditExpectation: \"Accepted contributions are credited according to the recorded contribution and written agreement; feedback alone does not create ownership.\",\n    notes: \"Editable Afterglow example: an invited contributor reviews a bounded late-story relationship and ending question without changing approved canon directly.\",\n    updatedAt: now(),\n  };\n  const authority: AuthorityRecord = {\n    ...createDefaultAuthorityRecord(),\n    collaboratorName: \"Afterglow invited contributor\",\n    role: \"contributor\",\n    authority: [\"view\", \"comment\", \"create-review-threads\", \"propose-changes\"],\n    scope: \"Review the selected Afterglow Block, linked relationship evidence and ending consequences; submit a bounded proposal only.\",\n    delegatedBy: owner,\n    agreementReference: \"Attach the applicable contributor, commission or collaboration agreement.\",\n  };\n  const brief: ContributionBrief = {\n    ...createDefaultContributionBrief(project),\n    title: \"Afterglow relationship and ending review\",\n    template: \"Alternative scene or Block\",\n    contributorName: authority.collaboratorName,\n    requestedRole: \"contributor\",\n    decisionMaker: owner,\n    targetKind: \"block\",\n    targetId: block.id,\n    targetLabel: \`Block \${block.number}: \${block.title}\`,\n    problem: \"Test whether the late-story relationship choice and final consequence are emotionally earned by earlier Afterglow evidence.\",\n    storyPurpose: \"Clarify the decisive relationship turn while preserving the intended theme, protagonist agency and ending image.\",\n    canonLocks: \"Preserve established character identities, approved world rules, the current crisis choice, existing rights records and linked continuity facts.\",\n    mustNotChange: \"Do not replace the complete screenplay, remove approved attribution, publish private material or treat the proposal as canon.\",\n    preferredOutput: \"Anchored review notes plus one bounded alternative scene or Block proposal with before-and-after evidence.\",\n    creativeFreedom: \"bounded\",\n    privacy: \"private-repository\",\n    reviewWindow: \"The project owner will review when the current development round reaches this Block; detailed feedback is not guaranteed on a fixed timetable.\",\n    creditExpectation: \"Record credit only for accepted material under the applicable agreement.\",\n    acceptanceCriteria: \"The proposal preserves canon locks, explains its audience effect, identifies relationship and ending dependencies, records provenance and remains separately reviewable before approval.\",\n    status: \"draft\",\n    updatedAt: now(),\n  };\n  return { agreement, authority, brief };\n}\n\nexport function createDefaultProposalPacket(project: PlotPickleProject, brief?: ContributionBrief): ProposalReviewPacket {`,
);

await replace(
  "app/collaboration-handbook/page.tsx",
  "  createDefaultAuthorityRecord,\n  createDefaultContributionBrief,",
  "  createAfterglowContributorExample,\n  createDefaultAuthorityRecord,\n  createDefaultContributionBrief,",
);

await replace(
  "app/collaboration-handbook/page.tsx",
  "  function saveAgreement() {\n    if (!project || !agreement) return;\n    commit(saveCollaborationAgreement(project, agreement), \"Collaboration operating agreement saved as an anchored canonical review record.\");\n  }\n\n  function selectCollaborator",
  `  function saveAgreement() {\n    if (!project || !agreement) return;\n    commit(saveCollaborationAgreement(project, agreement), \"Collaboration operating agreement saved as an anchored canonical review record.\");\n  }\n\n  function loadAfterglowExample() {\n    if (!project) return;\n    const example = createAfterglowContributorExample(project);\n    setAgreement(example.agreement);\n    setAuthority(example.authority);\n    setBrief(example.brief);\n    setSelectedAuthorityId(example.authority.id);\n    setSelectedBriefId(example.brief.id);\n    setNotice(\"Loaded the editable Afterglow contributor example. Review and save each record deliberately; nothing was published or made canonical.\");\n  }\n\n  function selectCollaborator`,
);

await replace(
  "app/collaboration-handbook/page.tsx",
  '<button className={styles.primary} type="button" onClick={saveAgreement}>Save operating agreement</button>',
  '<div className={styles.actions}><button className={styles.primary} type="button" onClick={saveAgreement}>Save operating agreement</button><button type="button" onClick={loadAfterglowExample}>Load editable Afterglow example</button></div>',
);

await replace(
  "app/learning-working-together.ts",
  '"Connect GitHub only when it helps the chosen model. Pull the approved `.ppf`, compare it, deliberately apply it as the local base, read the brief and continuity locks, then work locally. Save backups and revision snapshots before submitting a bounded proposal."',
  '"Connect GitHub only when it helps the chosen model. For a private repository, the owner invites a named contributor, the contributor accepts the invitation and connects their own PlotPickle server. For a public project, a contributor may work from a fork, while an authorized proposal branch keeps the owner’s canon protected. In every case, pull the approved `.ppf`, compare it, deliberately apply it as the local base, read the welcome card, brief and continuity locks, then work locally. Save backups and revision snapshots before submitting a bounded proposal. Repository visibility never substitutes for reuse permission."',
);

await replace(
  "app/learning-working-together.ts",
  '["Pull approved story", "Compare before applying", "Apply as local base", "Work locally", "Save backup and revision", "Submit proposal—not a direct canon write"]',
  '["Private repository: owner invitation → contributor acceptance → personal PlotPickle connection", "Public project: fork for independent work → proposal branch for review", "Pull approved story", "Compare before applying", "Apply as local base", "Work locally", "Save backup and revision", "Submit proposal—not a direct canon write", "Visibility and reuse permission remain separate"]',
);

await replace(
  "app/learning-working-together.ts",
  '"A merge, decline, defer, withdrawal or supersession should name the decision-maker, date, rationale, accepted and rejected portions, resolved or deferred review threads, revision snapshot, rights updates and follow-up work."',
  '"Review the structured packet, affected project areas and before-and-after evidence inside PlotPickle first. Use GitHub for repository history, discussion and the final technical merge when the project uses it. A merge, decline, defer, withdrawal or supersession should name the decision-maker, date, rationale, accepted and rejected portions, resolved or deferred review threads, revision snapshot, rights updates and follow-up work."',
);

const tests = await readFile("tests/issue-52-contributor-handbook.test.mjs", "utf8");
if (!tests.includes("editable Afterglow contributor example")) {
  await writeFile("tests/issue-52-contributor-handbook.test.mjs", `${tests}\n\ntest("issue 52 retains an editable Afterglow contributor example", () => {\n  assert.match(model, /createAfterglowContributorExample/);\n  assert.match(model, /Afterglow relationship and ending review/);\n  assert.match(model, /Afterglow drafts, images, prompts, research and unpublished story decisions remain private/);\n  assert.match(page, /Load editable Afterglow example/);\n  assert.match(page, /nothing was published or made canonical/);\n});\n\ntest("issue 52 explains private invitations, public forks and proposal branches", () => {\n  assert.match(learning, /private repository, the owner invites a named contributor/i);\n  assert.match(learning, /public project, a contributor may work from a fork/i);\n  assert.match(learning, /proposal branch keeps the owner’s canon protected/i);\n  assert.match(learning, /Repository visibility never substitutes for reuse permission/i);\n  assert.match(learning, /Review the structured packet.*inside PlotPickle first/i);\n});\n`);
}

console.log("Issue 52 final refinements applied.");
