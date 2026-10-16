// #3004 Command proposal staging. All data remains in the existing PPF storyDevelopment
// field proposal store; the imported screenplay is never rewritten or sent to a model.
const PREFIX = /^\/?plotpickle\s+(mind-map|world-map)(?:\s|$)/iu;
const TOPICS = new Set(["foundations", "world", "character", "theme", "structure"]);
const TOKEN = /^[a-f0-9]{16}$/u;
const ID = /^[a-z0-9_.:-]{1,240}$/iu;
const MAX_SOURCE_ROWS = 24;
const HELP = "PlotPickle mind-map fields <foundations|world|character|theme|structure> | PlotPickle world-map fields | PlotPickle mind-map source Block 01 Mini 01 | PlotPickle world-map source Block 01 Mini 01 | PlotPickle mind-map propose <canonical-field-id> from <passage-id> | PlotPickle world-map propose <canonical-field-id> from <passage-id> | PlotPickle mind-map confirm <one-use-token> | PlotPickle world-map confirm <one-use-token> | PlotPickle mind-map review <canonical-field-id> | PlotPickle world-map review <canonical-field-id> | PlotPickle mind-map cancel.";
export function parseCmdSourceProposal(input) {
  const str = String(input ?? "").trim();
  const match = str.match(PREFIX);
  if (!match) return null;
  const area = match[1].toLowerCase();
  const rest = str.replace(PREFIX, "").trim();
  if (/^cancel$/iu.test(rest)) return { action: "cancel", area };
  if (/^fields$/iu.test(rest) && area === "world-map") return { action: "fields", area, topic: "world" };
  const fields = rest.match(/^fields\s+([a-z-]+)$/iu);
  if (fields && area === "mind-map" && TOPICS.has(fields[1].toLowerCase()))
    return { action: "fields", area, topic: fields[1].toLowerCase() };
  const review = rest.match(/^review\s+(\S+)$/iu);
  if (review && ID.test(review[1])) return { action: "review", area, fieldId: review[1] };
  const source = rest.match(/^source\s+block\s+(\d{1,2})\s+mini\s+(\d{1,2})$/iu);
  if (source) {
    const block = Number(source[1]), mini = Number(source[2]);
    return block >= 1 && block <= 24 && mini >= 1 && mini <= 4
      ? { action: "source", area, block, mini } : { action: "invalid", area };
  }
  const propose = rest.match(/^propose\s+(\S+)\s+from\s+(\S+)$/iu);
  if (propose && ID.test(propose[1]) && ID.test(propose[2]))
    return { action: "propose", area, fieldId: propose[1], passageId: propose[2] };
  const confirm = rest.match(/^confirm\s+([a-f0-9]{16})$/iu);
  if (confirm) return { action: "confirm", area, token: confirm[1].toLowerCase() };
  return { action: "invalid", area };
}
function blocked(reason) { return "BLOCKED: " + reason + " No agent, API billing or media generation was started."; }
function verifySnapshot(s) {
  if (!s?.profileId || !s?.activeProjectId || !s?.project || s.project.id !== s.activeProjectId)
    return "Unlock a Human profile and select its exact saved Library PPF.";
  if (!Number.isSafeInteger(s.project.revision) || s.project.revision < 0)
    return "Selected project revision cannot be verified.";
  return "";
}
function safeSource(project) {
  const source = project?.sourceEvidence?.screenplay;
  if (!source || source.passagesTruncated !== false || !Array.isArray(source.passages))
    return { error: "Complete retained imported screenplay passages are required; no fixture or partial copy may substitute." };
  const rows = source.passages;
  if (rows.some(p => !p || typeof p.id !== "string" || !p.id || typeof p.text !== "string" || !p.text.trim()
      || !Number.isInteger(p.blockNumber) || !Number.isInteger(p.miniBlockNumber)))
    return { error: "Retained source includes malformed passage identities." };
  if (new Set(rows.map(p => p.id)).size !== rows.length)
    return { error: "Retained source has duplicate passage IDs; ambiguous citations cannot be saved." };
  if (typeof source.totalPassageCount === "number" && source.totalPassageCount !== rows.length)
    return { error: "Imported passage count differs from retained source; source completeness is unproven." };
  return { rows, source };
}
function candidateText(passage) {
  // A literal source quotation is not a newly inferred field answer or approved canon.
  // This makes the existing GUI's proposal slot genuinely source-linked but unaccepted.
  const quote = passage.text.replace(/\s+/gu, " ").trim().slice(0, 700);
  return "SOURCE-LINKED UNVERIFIED DRAFT — exact imported passage " + passage.id
    + " (" + String(passage.type || "unknown") + "): " + quote
    + "\nReview and rewrite as a field answer before any Human acceptance. The excerpt alone does not establish character, world or theme canon.";
}
function fieldAllowed(area, field) {
  return field && typeof field.canonicalId === "string"
    && TOPICS.has(field.topicId)
    && (area === "world-map" ? field.topicId === "world" : true);
}
export function createCmdSourceProposalSession(services) {
  let pending = null;
  let busy = false;
  return { async execute(command) {
    if (busy) return blocked("A previous source proposal operation is still running.");
    busy = true;
    try {
      if (command.action === "invalid") return blocked("Invalid source proposal grammar. " + HELP);
      if (command.action === "cancel") { pending = null; return "PENDING DRAFT CANCELLED. No PPF revision, proposal or accepted field changed."; }
      const s = await services.snapshot();
      const preflight = verifySnapshot(s);
      if (preflight) return blocked(preflight);
      const { project, profileId } = s;
      const fields = await services.fields();
      if (!Array.isArray(fields)) return blocked("Canonical story-development field registry unavailable.");
      if (command.action === "fields") {
        const visible = fields.filter(f => f.topicId === command.topic && fieldAllowed(command.area, f));
        return ["CANONICAL " + command.area.toUpperCase() + " FIELDS · selected " + project.id + " rev " + project.revision,
          ...visible.map(f => f.canonicalId + " | " + f.lessonTitle + " / " + f.fieldId
            + " | accepted authority: " + (
              project.storyDevelopment?.fields?.[f.canonicalId]?.acceptedSource || "none")
            + " | proposal: " + (
              project.storyDevelopment?.fields?.[f.canonicalId]?.proposal?.trim() ? "saved (unaccepted)" : "none")),
          "Fields listed: " + visible.length + ". No screenplay passage or creative decision changed.",
          HELP].join("\n");
      }
      const evidence = safeSource(project);
      if (evidence.error) return blocked(evidence.error);
      if (command.action === "source") {
        const rows = evidence.rows.filter(p => p.blockNumber === command.block && p.miniBlockNumber === command.mini);
        if (rows.length > MAX_SOURCE_ROWS) return blocked("More than 24 passages within Mini-Block; do not silently truncate this evidence view.");
        return ["IMPORTED SCREENPLAY · " + command.area + " · project " + project.id + " rev " + project.revision,
          "Block " + command.block + " Mini " + command.mini + ": " + rows.length + " retained passages.",
          ...rows.map(p => p.id + " | " + (p.type || "unknown") + " | scene " + p.sceneNumber
            + " | SOURCE-ONLY (not accepted story-development canon)"),
          "IDs above can be used in a source-linked unaccepted proposal. No content or project state changed."].join("\n");
      }
      if (command.action === "review") {
        const field = fields.find(f => f.canonicalId === command.fieldId && fieldAllowed(command.area, f));
        if (!field) return blocked("Unknown or out-of-scope canonical field ID; inspect fields first.");
        const state = project.storyDevelopment?.fields?.[field.canonicalId];
        if (!state?.proposal?.trim())
          return "NO SAVED UNACCEPTED PROPOSAL: " + field.canonicalId + " in PPF " + project.id + " revision " + project.revision
            + ". Existing Human-approved value, if any, is unchanged. No project mutation.";
        const passage = evidence.rows.find(p => p.id === state.proposalSourceRef);
        const exactSourceQuote = Boolean(passage && candidateText(passage) === state.proposal);
        return ["SAVED FIELD DRAFT REVIEW · READ-ONLY · NOT HUMAN-APPROVED",
          "PPF " + project.id + " revision " + project.revision + "; field " + field.canonicalId,
          "Existing accepted authority: " + (state.acceptedSource || "none") + " (unchanged).",
          "Saved sourceRef: " + (state.proposalSourceRef || "NONE"),
          "Direct imported-passage quote: " + (exactSourceQuote
            ? "VERIFIED against retained screenplay passage " + passage.id
            : "NOT VERIFIED. This may be edited, agent-created, unreferenced or stale; no observed-canon claim is made."),
          "SAVED UNACCEPTED DRAFT CONTENT:\n" + state.proposal,
          "Next: review, revise and accept using the existing Mind Map / World Map Human controls. The Command cannot silently promote this draft.",
          "No PPF write, creative approval, agent call, media request or provider charge occurred."].join("\n");
      }
      if (command.action === "propose") {
        pending = null;
        const field = fields.find(f => f.canonicalId === command.fieldId && fieldAllowed(command.area, f));
        if (!field) return blocked("Unknown or out-of-scope canonical field ID; inspect fields first.");
        const passage = evidence.rows.find(p => p.id === command.passageId);
        if (!passage) return blocked("Passage ID is not present in this complete selected imported screenplay.");
        const existing = project.storyDevelopment?.fields?.[field.canonicalId];
        if (existing?.proposal?.trim()) return blocked("This field already contains a saved draft proposal. Review it in Mind Map before replacing any proposal.");
        const proposal = candidateText(passage);
        const token = services.token();
        if (!TOKEN.test(token)) return blocked("Secure preview token unavailable.");
        pending = { token, area: command.area, profileId, projectId: project.id, revision: project.revision, fieldId: field.canonicalId,
          passageId: passage.id, passageText: passage.text, sourceFile: evidence.source.sourceFileName,
          proposal, expiresAt: services.now() + 120_000 };
        return ["UNACCEPTED SOURCE-DRAFT PREVIEW · NO WRITE YET",
          "Story: " + project.title + "; project " + project.id + "; revision " + project.revision,
          "Target: " + field.canonicalId + " (" + field.topicId + "); imported passage: " + passage.id
            + " | Block " + passage.blockNumber + " Mini " + passage.miniBlockNumber,
          "PROVENANCE: observed source text, proposed field application DERIVED-UNVERIFIED; not Human-accepted.",
          "DRAFT CONTENT:\n" + proposal,
          "Human authorization: SAVE ONLY AS AN UNACCEPTED FIELD PROPOSAL in the existing PPF. Never alter source, accepted field or World Map images.",
          "Within two minutes and without switching story/profile, send: PlotPickle " + command.area + " confirm " + token,
          "Or cancel with: PlotPickle " + command.area + " cancel"].join("\n");
      }
      if (command.action === "confirm") {
        const grant = pending;
        pending = null; // consume once even on persistence error; never auto-repeat.
        if (!grant || grant.area !== command.area || grant.token !== command.token || services.now() > grant.expiresAt)
          return blocked("One-use preview missing, expired, cancelled or mismatched.");
        if (grant.profileId !== profileId || grant.projectId !== project.id || grant.revision !== project.revision)
          return blocked("Profile, selected PPF or revision changed after preview.");
        const source = safeSource(project);
        if (source.error) return blocked(source.error);
        const passage = source.rows.find(p => p.id === grant.passageId);
        const field = fields.find(f => f.canonicalId === grant.fieldId && fieldAllowed(grant.area, f));
        if (!passage || passage.text !== grant.passageText || !field || source.source.sourceFileName !== grant.sourceFile
            || candidateText(passage) !== grant.proposal)
          return blocked("Imported source or canonical target changed after preview.");
        const current = project.storyDevelopment?.fields?.[grant.fieldId];
        if (current?.proposal?.trim()) return blocked("An existing field proposal appeared; overwrite requires a separate Human-reviewed workflow.");
        const saved = await services.save({ project, field, proposal: grant.proposal, passageId: grant.passageId, expectedRevision: grant.revision,
          profileId: grant.profileId, projectId: grant.projectId });
        if (!saved || saved.id !== grant.projectId || saved.revision !== grant.revision + 1
            || saved.storyDevelopment?.fields?.[grant.fieldId]?.proposal !== grant.proposal
            || saved.storyDevelopment?.fields?.[grant.fieldId]?.proposalSourceRef !== grant.passageId
            || saved.storyDevelopment?.fields?.[grant.fieldId]?.acceptedSource !== (current?.acceptedSource ?? null))
          return blocked("Durable read-back did not prove the exact unaccepted proposal. Inspect the current project; do not blindly retry.");
        return ["SAVED UNACCEPTED FIELD PROPOSAL (NOT APPROVED)",
          "PPF " + saved.id + " revision " + saved.revision + "; field " + grant.fieldId + "; imported source " + grant.passageId,
          "Confirmed draft text and sourceRef in the existing storyDevelopment field owner after encrypted write/read-back.",
          "Original screenplay, prior accepted value, World Map images, agent tasks and runtime target were not changed by this command.",
          "Next: review the saved proposal in Mind Map / World Map; Human acceptance remains a separate existing GUI action."].join("\n");
      }
      return blocked("Unsupported source proposal action.");
    } catch {
      // No raw private project or provider exception is displayed. A write could
      // have committed before a durable read-back exception: NEVER auto retry.
      pending = null;
      return blocked("The source proposal could not be safely verified; save outcome may be unknown. Reopen the PPF and inspect the field before retrying.");
    } finally {
      busy = false;
    }
  } };
}
