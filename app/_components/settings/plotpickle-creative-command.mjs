import { reviewBlockHandoff } from "../../../modules/write/model/block-handoff-review.mjs";
import { projectRuntimeGrid } from "../../../modules/write/model/selected-ppf-runtime-grid.mjs";

const CANONICAL = "4 Acts / 12 Sequences / 24 Blocks / 96 Mini-Blocks";
const TOOL_ROUTES = Object.freeze([
  Object.freeze({ tool: "Library", scope: "selected PPF", state: "read-only selection inspection" }),
  Object.freeze({ tool: "Story Architect", scope: "Outline assessment and production", state: "explicit local assessment or configured writing production starts a real hosted task; cloud writing may incur provider charges; results remain advisory" }),
  Object.freeze({ tool: "Outline", scope: "Human-accepted Mini-Block Plan", state: "acceptance requires explicit Human review" }),
  Object.freeze({ tool: "Write", scope: "encrypted saved writing", state: "separate editor action, not executed" }),
  Object.freeze({ tool: "Storyboard", scope: "approved image candidates", state: "separate governed image generation, not executed" }),
  Object.freeze({ tool: "Previs", scope: "locked storyboard image playback", state: "separate playback tool, not executed" }),
  Object.freeze({ tool: "Timeline", scope: "verified video/motion/export", state: "separate governed production tool, not executed" }),
  Object.freeze({ tool: "Connections", scope: "Local / Cloud / Hybrid", state: "PlotPickle connect local|cloud|hybrid opens identical Settings GUI; no connection changes until the user uses those controls" }),
  Object.freeze({ tool: "Media providers", scope: "settings and provider preflight", state: "runtime readiness unknown; no spend authorized" }),
  Object.freeze({ tool: "DSDD defect brief", scope: "Interpret / Pi Draft / Publish Brief", state: "existing Human-reviewed GitHub issue workflow" }),
]);

/** Only explicit PlotPickle operational commands are intercepted. Other narration remains DSDD intent. */
export function parsePlotPickleCreativeCommand(input) {
  const value = String(input || "").trim();
  if (!/^\/?plotpickle(?:\s|$)/iu.test(value)) return null;
  if (/^\/?plotpickle\s+(?:help|tools)$/iu.test(value)) return Object.freeze({ action: "tools" });
  if (/^\/?plotpickle\s+status$/iu.test(value)) return Object.freeze({ action: "status" });
  if (/^\/?plotpickle\s+(?:connect|connections)$/iu.test(value)) return Object.freeze({ action: "connections-help" });
  const connectionMode = value.match(/^\/?plotpickle\s+(?:connect|connections)\s+(local|cloud|hybrid)$/iu);
  if (connectionMode) return Object.freeze({ action: "connections-open", mode: connectionMode[1].toLowerCase() });
  const production = value.match(/^\/?plotpickle\s+(produce|production|resume-production|cancel-production)\s+block\s+(\d{1,3})(\s+local)?$/iu);
  if (production) {
    const blockNumber = Number(production[2]);
    if (blockNumber < 1 || blockNumber > 24 || (production[3] && production[1].toLowerCase() !== "produce")) return Object.freeze({ action: "invalid", reason: "Use PlotPickle produce Block 01 for configured writing, or PlotPickle produce Block 01 local for no-spend inference." });
    return Object.freeze({ action: production[1].toLowerCase(), blockNumber, ...(production[1].toLowerCase() === "produce" ? { localOnly: Boolean(production[3]) } : {}) });
  }
  const workflow = value.match(/^\/?plotpickle\s+workflow\s+block\s+(\d{1,3})$/iu);
  if (workflow) {
    const blockNumber = Number(workflow[1]);
    return blockNumber >= 1 && blockNumber <= 24
      ? Object.freeze({ action: "workflow", blockNumber })
      : Object.freeze({ action: "invalid", reason: "Workflow Block must be within the canonical 24 Blocks. No task ran." });
  }
  if (/^\/?plotpickle\s+(?:library|list\s+projects)$/iu.test(value)) return Object.freeze({ action: "library" });
  const inspect = value.match(/^\/?plotpickle\s+inspect\s+([A-Za-z0-9_.:-]{1,180})$/iu);
  if (inspect) return Object.freeze({ action: "inspect", projectId: inspect[1] });
  // Naming changes require a separate exact-identity preview and confirmation.
  const confirmedRename = value.match(/^\/?plotpickle\s+confirm\s+rename\s+(\S+)\s+revision\s+(\d{1,12})\s+from\s+"([^"]+)"\s+to\s+"([^"]+)"$/iu);
  if (confirmedRename) {
    const title = confirmedRename[4].trim();
    const previousTitle = confirmedRename[3].trim();
    const revision = Number(confirmedRename[2]);
    return /^[A-Za-z0-9_.:-]{1,180}$/u.test(confirmedRename[1]) && Number.isSafeInteger(revision)
      && revision >= 0 && previousTitle.length > 0 && previousTitle.length <= 160
      && title.length > 0 && title.length <= 160 && /[\p{L}\p{N}]/u.test(title)
      ? Object.freeze({ action: "confirm-rename", projectId: confirmedRename[1], revision, previousTitle, title })
      : Object.freeze({ action: "invalid", reason: "Choose an exact saved project ID, nonnegative revision and title of 1–160 characters. Nothing was renamed." });
  }
  const rename = value.match(/^\/?plotpickle\s+rename\s+(\S+)\s+to\s+(.+)$/iu);
  if (rename) {
    const title = rename[2].trim();
    return /^[A-Za-z0-9_.:-]{1,180}$/u.test(rename[1]) && title.length > 0
      && title.length <= 160 && /[\p{L}\p{N}]/u.test(title)
      ? Object.freeze({ action: "rename", projectId: rename[1], title })
      : Object.freeze({ action: "invalid", reason: "Choose an exact saved project ID and title of 1–160 characters. Nothing was renamed." });
  }
  // An explicit selection request only. Unrecognized creative narration stays with DSDD.
  const open = value.match(/^\/?plotpickle\s+open\s+(.+)$/iu);
  if (open) {
    const title = open[1].trim();
    return title.length > 0 && title.length <= 160 && /[\p{L}\p{N}]/u.test(title)
      ? Object.freeze({ action: "open", title })
      : Object.freeze({ action: "invalid", reason: "Choose an existing saved Library story title (1–160 characters). Nothing was executed." });
  }
  const startLocal = value.match(/^\/?plotpickle\s+assess\s+block\s+(\d{1,3})\s+local$/iu);
  if (startLocal) {
    const blockNumber = Number(startLocal[1]);
    return blockNumber >= 1 && blockNumber <= 24
      ? Object.freeze({ action: "assess-local", blockNumber })
      : Object.freeze({ action: "invalid", reason: "Story Architect Block must be 1–24. No inference ran." });
  }
  const diagnostic = value.match(/^\/?plotpickle\s+diagnose\s+block\s+(\d{1,3})$/iu);
  if (diagnostic) {
    const blockNumber = Number(diagnostic[1]);
    return blockNumber >= 1 && blockNumber <= 24
      ? Object.freeze({ action: "diagnose", blockNumber })
      : Object.freeze({ action: "invalid", reason: "Diagnostic Block must be 1–24. No task changed." });
  }
  const status = value.match(/^\/?plotpickle\s+assessment\s+block\s+(\d{1,3})$/iu);
  if (status) {
    const blockNumber = Number(status[1]);
    return blockNumber >= 1 && blockNumber <= 24
      ? Object.freeze({ action: "assessment", blockNumber })
      : Object.freeze({ action: "invalid", reason: "Story Architect Block must be 1–24. No tool ran." });
  }
  const match = value.match(/^\/?plotpickle\s+plan\s+block\s+(\d{1,3})$/iu);
  if (match) {
    const block = Number(match[1]);
    return block >= 1 && block <= 24
      ? Object.freeze({ action: "plan", blockNumber: block })
      : Object.freeze({ action: "invalid", reason: "Block must be from 1 to 24. Nothing was executed." });
  }
  return null;
}

function projectContext(project, activeProjectId) {
  if (!activeProjectId || !project || project.id !== activeProjectId) {
    return { error: "BLOCKED: No matching selected Library PPF was verified for this Command request. Run PlotPickle library to inspect the current-profile saved titles; do not assume a story was opened. No tool was executed." };
  }
  if (typeof project.revision !== "number" || !Number.isInteger(project.revision)) {
    return { error: "BLOCKED: Selected PPF revision is not verifiable. No tool was executed." };
  }
  return { project };
}

function runtimeText(project) {
  const grid = projectRuntimeGrid(project);
  if (grid.status !== "runtime-configured") {
    return "Runtime: " + grid.status + "; " + grid.reason;
  }
  return "Runtime: " + grid.format + ", Human-selected target " + grid.targetMinutes
    + " min; nominal Block " + (grid.targetMinutes * 60 / 24).toFixed(3)
    + " s, Mini-Block " + (grid.targetMinutes * 60 / 96).toFixed(3)
    + " s. Timing is a proposal budget, NOT rendered Shot duration.";
}

function projectHeader(project) {
  const title = typeof project.title === "string" ? project.title.trim() : "";
  const safeTitle = title && /[\p{L}\p{N}]/u.test(title) ? title : "[title requires review]";
  return ["Selected PPF: " + safeTitle, "Project ID: " + project.id,
    "Revision: " + project.revision, "Canonical structure: " + CANONICAL,
    runtimeText(project)];
}

/** Read-only production inventory. This never invokes a creative provider or changes project data. */
export function describePlotPickleCreativeCommand(command, { project = null, activeProjectId = "", currentAssessment = false } = {}) {
  if (!command) return null;
  if (command.action === "invalid") return command.reason;
  if (command.action === "tools") {
    return [
      "PLOTPICKLE CREATIVE TOOLS · read-only discovery (not a provider readiness check)",
      "Commands: PlotPickle tools | PlotPickle library | PlotPickle status | PlotPickle workflow Block 01 | PlotPickle plan Block 01 | PlotPickle open <saved story title> | PlotPickle inspect <project ID> | PlotPickle rename <project ID> to <new title> (preview first) | PlotPickle assess Block 01 local | PlotPickle assessment Block 01 | PlotPickle diagnose Block 01 | PlotPickle produce Block 01 local | PlotPickle production Block 01 | PlotPickle resume-production Block 01 | PlotPickle cancel-production Block 01",
      ...TOOL_ROUTES.map(({ tool, scope, state }) => tool + " — " + scope + " — " + state),
      "No creative action ran; no screenplay or PPF was changed; no cloud credits spent.",
      "For software defects, describe the observed and expected behavior, then use 01 Interpret → 02 Pi Draft → 03 Publish Brief."
    ].join("\n");
  }
  const selected = projectContext(project, activeProjectId);
  if (selected.error) return selected.error;
  try {
    const header = projectHeader(selected.project);
    if (command.action === "status") {
      return [
        "PLOTPICKLE SELECTED STORY · read-only status",
        ...header,
        "Tool actions: NOT RUN. Saved Storyboard, provider readiness and Timeline playback are NOT verified by this inspection.",
        "Inspect one Block with: PlotPickle plan Block 01",
      ].join("\n");
    }
    if (command.action === "workflow") {
      const source = selected.project.sourceEvidence?.screenplay;
      if (!source || source.passagesTruncated !== false || !Array.isArray(source.passages)) {
        return "BLOCKED: Complete retained screenplay evidence is required for a source-grounded workflow inventory. No data was changed.";
      }
      const review = reviewBlockHandoff(selected.project, command.blockNumber, { currentAssessment });
      const fields = Object.values(selected.project.storyDevelopment?.fields || {});
      const accepted = fields.filter(field => field?.acceptedSource === "human" || field?.acceptedSource === "agent-proposal");
      const proposals = fields.filter(field => typeof field?.proposal === "string" && field.proposal.trim());
      const packages = Array.isArray(selected.project.worldMap?.characterVisuals) ? selected.project.worldMap.characterVisuals : [];
      const approved = packages.filter(item => item.lockedVersionId &&
        Array.isArray(item.references) && item.references.some(ref => ref.versionId === item.lockedVersionId && ref.reviewState === "approved"));
      const notes = selected.project.mindMapNotes || {};
      const noteCount = [...Object.values(notes.fields || {}), ...Object.values(notes.topics || {})]
        .filter(note => typeof note?.text === "string" && note.text.trim()).length;
      return [
        "PLOTPICKLE CMD · SOURCE-BOUND WORKFLOW INVENTORY · BLOCK " + String(command.blockNumber).padStart(2, "0"),
        ...header,
        "SOURCE: imported retained passages for this Block " + review.mappedSourcePassages
          + "; complete import in storage: " + (source.passagesTruncated === false ? "not truncated" : "truncation not explicitly verified"),
        "MIND MAP: tracked accepted field decisions " + accepted.length + "; stored draft field proposals " + proposals.length
          + "; saved nonempty notes " + noteCount
          + ". These counts exclude untracked Foundation/World lesson values and do not prove full topic coverage.",
        "WORLD MAP: character visual packages " + packages.length + "; packages with a matching approved locked version "
          + approved.length + ". Source character identity/continuity and missing views are NOT verified by this inventory.",
        "STORY ARCHITECT: " + (review.currentAssessment ? "source-matched advisory assessment reported; not approval" : "no current advisory assessment verified"),
        "OUTLINE: " + review.acceptedCount + "/4 Human-accepted Mini-Block Plans",
        "WRITE: saved writing in " + review.savedWritingCount + "/4 Mini-Blocks",
        "STORYBOARD: NOT INSPECTED. 25 planned Shot addresses per Mini-Block do not prove any generated, saved or locked images.",
        "PREVIS: NOT INSPECTED. No flipbook or Graphic Novel playback is certified.",
        "TIMELINE: NOT INSPECTED. No verified motion route, clip or exported MP4 is certified.",
        "ROUGH CUT: NOT INSPECTED. No assembled or playable movie is certified.",
        review.allPlansAccepted
          ? "NEXT: Human-reviewed Outline Plan gate is satisfied for this Block. Inspect the real Write/Storyboard owners separately; no production approval was inferred."
          : "BLOCKED: Outline has " + (4 - review.acceptedCount) + " unaccepted Mini-Block Plans. Inspect PlotPickle assessment Block "
            + String(command.blockNumber).padStart(2, "0") + " and the real Outline before any Write/Storyboard production.",
        "Source-grounded Mind Map/World Map proposal generation from Command is a future governed stage, not executed here.",
        "READ-ONLY: No agent call, candidate creation, proposal acceptance, Save/Lock, model charge or export occurred.",
      ].join("\n");
    }
    if (command.action === "plan") {
      const review = reviewBlockHandoff(selected.project, command.blockNumber, { currentAssessment });
      return [
        "PLOTPICKLE BLOCK " + String(command.blockNumber).padStart(2, "0") + " · read-only proposed handoff",
        ...header,
        "Imported screenplay passages mapped: " + review.mappedSourcePassages
          + (review.sourceIsPartial ? " (retained source is partial)" : ""),
        "Story Architect: " + (review.currentAssessment ? "current ADVISORY assessment; not Human-approved" : "no current assessment verified"),
        "Outline: " + review.acceptedCount + "/4 Human-accepted Plans; saved writing: " + review.savedWritingCount + "/4 Mini-Blocks.",
        ...review.miniBlocks.map(m => "Mini-Block " + m.address + ": "
          + (m.planAccepted ? "accepted Plan" : "Plan " + m.planState + " — Human review required")
          + "; source passages " + m.importedPassages + "; saved writing " + (m.savedWriting ? "present" : "absent")),
        review.allPlansAccepted
          ? "NEXT: The Write screen can prepare proposal-only Responsibility Run records after confirmation. This is NOT creative agent execution."
          : "BLOCKED: Do not prepare Write candidate stages until the missing Outline Plans have actually been Human-accepted.",
        "No Story Architect inference, writing, image/video generation, media spend, save, approval or GitHub publication occurred. This inspection is not a product acceptance receipt.",
      ].join("\n");
    }
  } catch (error) {
    return "BLOCKED: Selected PPF inspection failed: " + (error instanceof Error ? error.message : "unknown project state")
      + ". No tool was executed.";
  }
  return "Unsupported PlotPickle creative command. No tool was executed.";
}


/**
 * Select one existing, profile-owned saved Library PPF and report its actual
 * read-back state using the same inspection routines as Command.
 * All services are passed in from the authenticated browser Library owner.
 * No new project store, screenplay edit, agent Run, or provider call is made.
 */
function libraryTitle(value) {
  return String(value || "").trim().normalize("NFC").replace(/[\r\n\t]+/gu, " ").slice(0, 160);
}
function libraryKey(value) { return libraryTitle(value).toLocaleLowerCase("en-US"); }
function libraryInventory(services) {
  const projects = services.listInventory();
  return Array.isArray(projects) ? projects.filter(p => p && typeof p.id === "string"
    && p.id.trim() && typeof p.title === "string" && libraryTitle(p.title)) : null;
}
function libraryRecord(item) {
  return libraryTitle(item.title) + " [id: " + String(item.id).slice(0, 120)
    + ", kind: " + (typeof item.sourceKind === "string" ? item.sourceKind : "unknown") + "]";
}
function libraryAvailableMessage(items) {
  if (!items.length) return "This hydrated profile currently reports zero saved PPFs; no recovery or other profile was searched.";
  const shown = items.slice(0, 20);
  return "Current-profile saved Library titles (" + items.length + "):\n"
    + shown.map(item => "- " + libraryRecord(item)).join("\n")
    + (items.length > shown.length ? "\n... " + (items.length - shown.length) + " more; inspect Library to resolve." : "");
}

/**
 * Command's inventory is a current-session read-only diagnostic, not proof
 * that a saved vault record was independently reopened after process restart.
 */
export function describePlotPickleLibraryInventory(services) {
  try {
    if (!services.profileReady()) return "BLOCKED: Authenticated profile Library is not yet hydrated/unlocked in this browser. Sign in or unlock the existing profile. No project was selected.";
    const items = libraryInventory(services);
    if (!items) return "BLOCKED: Saved Library inventory is unavailable. No project was selected.";
    const selected = services.activeProjectId();
    return "PLOTPICKLE LIBRARY · current-profile read-only inventory\n"
      + "Currently selected session project ID: " + (selected || "none") + "\n"
      + libraryAvailableMessage(items) + "\n"
      + "Use PlotPickle open <exact saved title>. Synthetic/example references are visible for diagnosis but not automatically opened. "
      + "No project was selected or modified; no media/provider tools ran.";
  } catch (error) {
    return "BLOCKED: Library inventory could not be inspected: "
      + (error instanceof Error ? error.message : "unknown Library error")
      + ". No project was selected.";
  }
}

/**
 * Select one existing, profile-owned Human saved Library PPF and report its
 * actual read-back. The diagnostic can inspect other saved kinds without
 * escalating their selection authority.
 */
export async function executePlotPickleLibraryOpen(command, services) {
  if (!command || (command.action !== "open" && command.action !== "library")) return null;
  if (command.action === "library") return describePlotPickleLibraryInventory(services);
  const requested = libraryKey(command.title);
  if (!requested) return "BLOCKED: Name a saved Library PPF. Nothing was selected.";
  try {
    if (!services.profileReady()) return "BLOCKED: Authenticated profile Library is not hydrated/unlocked. "
      + "Sign in or unlock the existing profile and retry PlotPickle library. Nothing was selected.";
    const inventory = libraryInventory(services);
    if (!inventory) return "BLOCKED: Current-profile saved Library inventory is unavailable. Nothing was selected.";
    const summaries = services.listProjects();
    if (!Array.isArray(summaries)) return "BLOCKED: Current-profile Human PPF inventory is unavailable. Nothing was selected.";
    const matches = summaries.filter(item => item && libraryKey(item.title) === requested
      && typeof item.id === "string" && item.id.trim());
    if (!matches.length) {
      const excluded = inventory.filter(item => libraryKey(item.title) === requested);
      const near = inventory.filter(item => libraryKey(item.title).includes(requested)
        || requested.includes(libraryKey(item.title))).slice(0, 8);
      if (excluded.length) return "BLOCKED: " + libraryTitle(command.title)
        + " is present in the current-profile Library index but excluded from automatic opening by its classification. "
        + excluded.map(libraryRecord).join("; ")
        + ". Review its ownership and saved state. No project was selected.";
      return "BLOCKED: No Human-owned saved PPF exactly titled " + libraryTitle(command.title)
        + " was found in this hydrated current-profile Library. "
        + (near.length ? "Other matching titles: " + near.map(libraryRecord).join("; ") + ". " : "")
        + "Run PlotPickle library to see all titles. No project was selected.";
    }
    if (matches.length > 1) return "BLOCKED: Multiple saved PPFs are titled "
      + libraryTitle(command.title) + ". Open the intended version in Library. Candidates: "
      + matches.map(item => item.id).join(", ") + ". Nothing was selected.";
    const target = matches[0];
    const priorId = services.activeProjectId();
    if (priorId && priorId !== target.id) return "BLOCKED: A different PPF (" + priorId
      + ") is already active. Finish any unsaved work and switch deliberately in Library. Nothing was selected.";
    const expected = services.readSnapshot(target.id);
    if (!expected || expected.id !== target.id || libraryKey(expected.title) !== requested
        || !Number.isInteger(expected.revision) || expected.revision < 0)
      return "BLOCKED: Library could not verify the requested PPF snapshot, title and revision. Nothing was selected.";
    if (priorId !== target.id) {
      const switched = services.switchProject(target.id);
      if (!switched || switched.id !== target.id || switched.revision !== expected.revision)
        return "BLOCKED: Library switch did not confirm the requested project identity and revision. Inspect Library state before retrying.";
      await services.persistProject();
      await services.flushWrites();
    }
    const actualId = services.activeProjectId();
    const project = actualId === target.id ? services.loadActiveProject() : null;
    if (!project || project.id !== target.id || project.revision !== expected.revision || libraryKey(project.title) !== requested)
      return "BLOCKED: Selected Library PPF differs from the requested saved snapshot. Inspect Library state before continuing.";
    const options = {project, activeProjectId: actualId, currentAssessment: Boolean(services.currentAssessment(project, 1))};
    const status = describePlotPickleCreativeCommand({action:"status"},options);
    const plan = describePlotPickleCreativeCommand({action:"plan",blockNumber:1},options);
    return "LIBRARY PPF VERIFIED: " + project.title + " (ID " + project.id + ", revision " + project.revision
      + "). Selected through the existing Library operation, without leaving Command.\n\n"
      + status + "\n\n" + plan
      + "\n\nNo creative edits, provider requests, approvals, paid generation or media playback occurred.";
  } catch (error) {
    return "BLOCKED: Library Open could not be durably verified: "
      + (error instanceof Error ? error.message : "unknown Library failure")
      + ". Selection or encrypted-save acknowledgement may be uncertain; inspect Library status before retrying. No creative production ran.";
  }
}


/**
 * Preview or perform one explicitly confirmed title-only change of a saved,
 * current-profile Human-owned PPF. Never infer identity from creative content,
 * auto-adopt reference examples, create a project, or silently overwrite titles.
 * Services are authoritative browser Library operations already used by the GUI.
 */
export async function executePlotPickleLibraryRename(command, services) {
  if (!command || (command.action !== "rename" && command.action !== "confirm-rename")) return null;
  const confirmed = command.action === "confirm-rename";
  const id = String(command.projectId || "");
  const title = String(command.title || "").trim().normalize("NFC");
  if (!/^[A-Za-z0-9_.:-]{1,180}$/u.test(id) || !title || title.length > 160
      || !/[\p{L}\p{N}]/u.test(title) || /[\r\n\t]/u.test(title)) {
    return "BLOCKED: Invalid saved project ID or title. No rename was attempted.";
  }
  try {
    if (!services.profileReady()) return "BLOCKED: Human profile is locked or Library is not hydrated. No rename was attempted.";
    const authority = services.profileId();
    if (!authority) return "BLOCKED: The authenticated profile identity is unavailable. No rename was attempted.";
    const items = services.listProjects();
    if (!Array.isArray(items)) return "BLOCKED: Current-profile Human Library inventory is unavailable. No rename was attempted.";
    const matches = items.filter(item => item && item.id === id);
    if (matches.length !== 1) return "BLOCKED: Project ID is not uniquely present in the current-profile Human Library. "
      + "Run PlotPickle library and select a saved Human story ID. No rename was attempted.";
    const item = matches[0];
    const oldTitle = libraryTitle(item.title);
    const targetTitle = libraryTitle(title);
    const targetKey = libraryKey(targetTitle);
    if (targetKey === libraryKey(oldTitle) && targetTitle === oldTitle)
      return "NO CHANGE: " + libraryRecord(item) + " already has that title. No project was modified.";
    const conflicting = services.listInventory().filter(other => other && other.id !== id
      && libraryKey(other.title) === targetKey);
    if (conflicting.length) return "BLOCKED: Another saved Library PPF already has the target title: "
      + conflicting.slice(0, 4).map(libraryRecord).join("; ") + ". Nothing was renamed.";
    const snapshot = services.readSnapshot(id);
    if (!snapshot || snapshot.id !== id || snapshot.title !== item.title
      || !Number.isInteger(snapshot.revision) || snapshot.revision < 0)
      return "BLOCKED: Saved title/identity/revision does not match its Library summary. No rename was attempted.";
    const activeId = services.activeProjectId();
    if (activeId && activeId !== id) return "BLOCKED: Another story is active. "
      + "To protect possible unsaved edits, finish that story in Library before renaming. No project was changed.";
    if (oldTitle.includes('"') || targetTitle.includes('"')) return "BLOCKED: Quotes in saved titles require Library review before preparing a safe confirmation command. Nothing was renamed.";
    if (!confirmed) {
      return "TITLE RENAME PREVIEW · no changes made\n"
        + "Saved PPF: " + oldTitle + "\nProject ID: " + id
        + "\nRevision: " + snapshot.revision + "\nNew title: " + targetTitle
        + "\nClassification: " + (item.sourceKind || "unknown")
        + "\nOnly the PPF display title will change; project identity, screenplay, story and media must remain intact. Save any unsaved editor drafts before confirming. "
        + "The selected profile's encrypted Library must acknowledge the write.\n"
        + "To approve this exact identity and revision, send:\nPlotPickle confirm rename " + id
        + ' revision ' + snapshot.revision + ' from "' + oldTitle + '" to "' + targetTitle + '"';
    }
    if (command.revision !== snapshot.revision || command.previousTitle !== oldTitle)
      return "BLOCKED: The saved PPF title or revision has changed since the preview. "
        + "Run PlotPickle rename " + id + " to " + targetTitle + " again. No rename was attempted.";
    // Validate all pending encrypted writes before the first local mutation.
    await services.flushWrites();
    if (!services.profileReady() || services.profileId() !== authority
        || services.activeProjectId() !== activeId)
      return "BLOCKED: Profile or active project changed during title confirmation. No rename was attempted.";
    const check = services.readSnapshot(id);
    if (!check || check.id !== id || check.title !== oldTitle || check.revision !== snapshot.revision
        || !services.listProjects().some(row => row.id === id && row.title === oldTitle))
      return "BLOCKED: Saved PPF identity/title/revision changed before the write. No rename was attempted.";
    const currentTitleKey = libraryKey(targetTitle);
    if (services.listInventory().some(row => row.id !== id && libraryKey(row.title) === currentTitleKey))
      return "BLOCKED: Another PPF now uses the requested title. No rename was attempted.";
    // Reuse the exact same switch and save path as the Library GUI. Never
    // mutate the live snapshot in place. This intentionally selects the story.
    if (!activeId) {
      const switched = services.switchProject(id);
      if (!switched || switched.id !== id || switched.revision !== snapshot.revision)
        return "BLOCKED: Library could not verify project selection. Inspect Library before retrying.";
    }
    const saved = services.saveProject({ ...check, title: targetTitle });
    if (!saved || saved.id !== id || saved.title !== targetTitle)
      return "BLOCKED: Library did not confirm the requested title-only Save. Inspect Library; save state may be uncertain.";
    await services.persistProject(id);
    await services.flushWrites();
    const after = services.readSnapshot(id);
    const summary = services.listProjects().find(row => row.id === id);
    if (!services.profileReady() || services.profileId() !== authority
        || services.activeProjectId() !== id
        || !after || after.id !== id || after.title !== targetTitle
        || !summary || summary.title !== targetTitle)
      return "BLOCKED: Post-save Library title/identity verification failed. The write status is uncertain; inspect Library.";
    // Rewriting screenplay or creative decisions is never an acceptable side effect.
    const removeTitleAndMetadata = p => {
      const { title: _title, updatedAt: _updatedAt, revision: _revision, ...rest } = p;
      return JSON.stringify(rest);
    };
    if (removeTitleAndMetadata(after) !== removeTitleAndMetadata(check))
      return "BLOCKED: Non-title PPF fields changed during rename. Inspect saved Library/recovery immediately; acceptance is denied.";
    return "TITLE RENAME VERIFIED · saved to current-profile Library\n"
      + "Old title: " + oldTitle + "\nNew title: " + targetTitle
      + "\nProject ID: " + id + "\nRevision: " + after.revision
      + "\nThe same PPF identity remains active. Encrypted profile Save was acknowledged and Library session metadata was read back. Restart/reopen is not proven by this command. "
      + "No movie operations, creative approvals or provider calls ran.\n"
      + "Next: PlotPickle plan Block 01";
  } catch (error) {
    return "BLOCKED: Rename could not be verified: "
      + (error instanceof Error ? error.message : "unknown Library write failure")
      + ". If a write was attempted, its durable status is uncertain. Inspect the Library before retrying.";
  }
}


/**
 * Look at one exact project snapshot without selecting, renaming or saving it.
 * Read-only screenplay identification evidence stays in the authenticated
 * Human's local Command conversation, not in GitHub reports or external APIs.
 */
export function inspectPlotPickleLibraryProject(command, services) {
  if (!command || command.action !== "inspect") return null;
  const id = String(command.projectId || "");
  if (!/^[A-Za-z0-9_.:-]{1,180}$/u.test(id))
    return "BLOCKED: Supply the exact saved PPF ID from PlotPickle library. No project was changed.";
  try {
    if (!services.profileReady())
      return "BLOCKED: Current Human profile is not unlocked/hydrated. No project was inspected.";
    const profile = services.profileId();
    if (!profile) return "BLOCKED: Current profile identity is unavailable. No project was inspected.";
    const items = services.listInventory();
    if (!Array.isArray(items)) return "BLOCKED: Saved PPF inventory is unavailable. No project was inspected.";
    const matches = items.filter(item => item && item.id === id);
    if (matches.length !== 1) return "BLOCKED: Exactly one saved Library PPF with that ID was not found in the current profile. Nothing changed.";
    const info = matches[0];
    const project = services.readSnapshot(id);
    if (!project || project.id !== id || project.title !== info.title
        || !Number.isInteger(project.revision) || project.revision < 0)
      return "BLOCKED: Saved PPF snapshot identity/title/revision disagrees with its Library entry. Nothing changed.";
    if (!services.profileReady() || services.profileId() !== profile)
      return "BLOCKED: The authenticated Human profile changed during inspection. No PPF evidence was displayed.";
    const source = project.sourceEvidence?.screenplay || null;
    const passages = Array.isArray(source?.passages) ? source.passages : [];
    const sane = (value, limit = 120) => typeof value === "string"
      ? value.replace(/[\r\n\t]+/gu, " ").trim().slice(0, limit) : "";
    const filename = sane(source?.sourceFileName, 180);
    const kind = sane(info.sourceKind, 24) || "unknown";
    const details = [
      "PLOTPICKLE SAVED PPF INSPECTION · read-only",
      "Library title: " + (sane(project.title, 160) || "[blank title]"),
      "Project ID: " + id,
      "Revision: " + project.revision,
      "Library classification: " + kind,
      "Import/source reference: " + (sane(info.sourceId, 180) || "not recorded"),
      "Screenplay filename: " + (filename || "not recorded"),
      "Screenplay format: " + (sane(source?.sourceFormat, 40) || "not recorded"),
      "Screenplay analysis: " + (sane(source?.analysisStatus, 32) || "not recorded"),
      "Source passages: " + (source ? (Number.isInteger(source.totalPassageCount)
        ? source.totalPassageCount : "unknown") : "none")
        + " total, " + passages.length + " retained, truncated: " + (source?.passagesTruncated === true ? "yes" : "no/unknown"),
    ];
    const markers = Array.isArray(source?.sectionMarkers) ? source.sectionMarkers
      .filter(marker => marker && typeof marker.title === "string" && marker.title.trim()).slice(0, 3) : [];
    if (markers.length) details.push("First screenplay section headings: "
      + markers.map(marker => sane(marker.title, 90)).join(" | "));
    const samples = passages.filter(p => p && typeof p.text === "string" && p.text.trim())
      .slice(0, 2).map(p => "[" + sane(p.type, 24) + "] " + sane(p.text, 150));
    if (samples.length) details.push("Opening retained source evidence:\n" + samples.join("\n"));
    details.push(source && (filename || passages.length || markers.length)
      ? "Review the original screenplay filename and source evidence above before proposing a title. None of this proves a particular film identity automatically."
      : "SCREENPLAY IDENTITY UNPROVEN: This saved project lacks usable imported screenplay identification evidence. Do not rename it from title similarity alone.");
    details.push("No PPF was selected, saved, renamed, restored or modified. No AI/media provider was called.");
    return details.join("\n");
  } catch(error) {
    return "BLOCKED: Read-only saved PPF inspection failed: "
      + (error instanceof Error ? error.message : "unknown local Library error")
      + ". No PPF change or provider call was requested.";
  }
}
