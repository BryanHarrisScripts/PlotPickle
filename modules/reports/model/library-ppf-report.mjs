/**
 * #2956 Reports is a read-only projection of the exact active Library PPF.
 * No legacy project key, synthetic completion count, provider query or write.
 */
export function resolveActiveLibraryReportsProject({ activeProjectId, loadSnapshot }) {
  if (typeof activeProjectId !== "string" || !activeProjectId.trim()) return null;
  const selectedId = activeProjectId.trim();
  const project = loadSnapshot(selectedId);
  return project && project.id === selectedId ? project : null;
}

const items = value => Array.isArray(value) ? value : [];
const text = value => typeof value === "string" ? value : "";
const positive = value => Number.isInteger(value) && value >= 0 ? value : 0;

export function summarizeLibraryPpfReport(project) {
  if (!project || typeof project.id !== "string" || !project.id.trim()) {
    throw new Error("Reports require an identified, selected Library PPF story.");
  }
  const blocks = items(project.structure?.blocks);
  const minis = blocks.flatMap(block => items(block.miniBlocks));
  const writing = items(project.writing?.entries);
  const screenplay = project.sourceEvidence?.screenplay ?? null;
  const storedPassages = items(screenplay?.passages);
  const estimatedFullSource = Boolean(screenplay && (screenplay.passagesTruncated || positive(screenplay.totalPassageCount) > storedPassages.length));
  const knownSceneIds = new Set(storedPassages.filter(p => text(p.sceneId)).map(p => p.sceneId));
  const sourceSceneNumbers = new Set(storedPassages.filter(p => positive(p.sceneNumber)>0).map(p=>p.sceneNumber));
  const dialogue = storedPassages.filter(p => /dialog/i.test(text(p.type)));
  const claims = items(project.sourceEvidence?.characterTruth?.claims);
  const approvedClaims = claims.filter(c => c.reviewState === "human-approved" && c.handling === "writer-reference");
  const fields = Object.values(project.storyDevelopment?.fields ?? {}).filter(value => value && typeof value === "object");
  const acceptedFields = fields.filter(f=>f.acceptedSource === "human" || f.acceptedSource === "agent-proposal");
  const proposals = fields.filter(f=>text(f.proposal).trim());
  const planned = minis.filter(m => Boolean(m.stages?.plan?.acceptedAt));
  const storyboard = minis.filter(m => Boolean(m.stages?.storyboard?.acceptedAt));
  return {
    id: project.id,
    title: text(project.title) || "Untitled Story",
    revision: positive(project.revision),
    updatedAt: text(project.updatedAt) || null,
    imported: screenplay ? {
      name: text(screenplay.sourceFileName) || "Imported screenplay",
      format: text(screenplay.sourceFormat) || "Unspecified format",
      reportedPassages: positive(screenplay.totalPassageCount),
      retainedPassages: storedPassages.length,
      truncated: estimatedFullSource,
    } : null,
    structure: {
      blocks: blocks.length,
      miniBlocks: minis.length,
      acts: new Set(blocks.map(b=>b.actNumber).filter(n=>n>=1&&n<=4)).size,
      planAccepted: planned.length,
      storyboardAccepted: storyboard.length,
      authoredBlocks: blocks.filter(b=>text(b.note).trim() || (text(b.title).trim() && !/^Block \\d{2}$/u.test(text(b.title).trim()))).length,
    },
    writing: { miniBlocksWithText: writing.filter(w=>text(w.text).trim()).length },
    importedEvidence: {
      retainedPassages: storedPassages.length,
      knownSceneReferences: knownSceneIds.size || sourceSceneNumbers.size,
      dialoguePassages: dialogue.length,
      incomplete: estimatedFullSource,
    },
    characters: { approvedReferenceClaims: approvedClaims.length, countAvailable: false },
    development: { acceptedFields: acceptedFields.length, unacceptedProposals: proposals.length },
    unavailable: {
      runtime: "Actual screenplay runtime is not derived from retained Library evidence here.",
      scenes: "Complete scene census, timing, and cast coverage are not verified by this PPF report.",
      characters: "A verified distinct-character census is not available from these reference claims.",
      dialogue: "Speech duration, voices, and complete dialogue statistics are not verified from retained passages.",
      production: "Physical shoot schedules and finished playable video are not certified by structural planning or accepted Storyboard stages.",
      feedback: "Legacy Feedback model is not the active Library PPF authority. No counts are supplied.",
      connections: "Provider, GitHub, and connector readiness are owned by Settings; this read-only report does not certify them.",
    },
  };
}
