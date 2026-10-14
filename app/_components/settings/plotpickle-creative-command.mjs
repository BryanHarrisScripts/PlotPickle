import { reviewBlockHandoff } from "../../../modules/write/model/block-handoff-review.mjs";
import { projectRuntimeGrid } from "../../../modules/write/model/selected-ppf-runtime-grid.mjs";

const CANONICAL = "4 Acts / 12 Sequences / 24 Blocks / 96 Mini-Blocks";
const TOOL_ROUTES = Object.freeze([
  Object.freeze({ tool: "Library", scope: "selected PPF", state: "read-only selection inspection" }),
  Object.freeze({ tool: "Story Architect", scope: "Outline assessment", state: "advisory proposal, not executed" }),
  Object.freeze({ tool: "Outline", scope: "Human-accepted Mini-Block Plan", state: "acceptance requires explicit Human review" }),
  Object.freeze({ tool: "Write", scope: "encrypted saved writing", state: "separate editor action, not executed" }),
  Object.freeze({ tool: "Storyboard", scope: "approved image candidates", state: "separate governed image generation, not executed" }),
  Object.freeze({ tool: "Previs", scope: "locked storyboard image playback", state: "separate playback tool, not executed" }),
  Object.freeze({ tool: "Timeline", scope: "verified video/motion/export", state: "separate governed production tool, not executed" }),
  Object.freeze({ tool: "Media providers", scope: "settings and provider preflight", state: "runtime readiness unknown; no spend authorized" }),
  Object.freeze({ tool: "DSDD defect brief", scope: "Interpret / Pi Draft / Publish Brief", state: "existing Human-reviewed GitHub issue workflow" }),
]);

/** Only explicit PlotPickle operational commands are intercepted. Other narration remains DSDD intent. */
export function parsePlotPickleCreativeCommand(input) {
  const value = String(input || "").trim();
  if (!/^\/?plotpickle(?:\s|$)/iu.test(value)) return null;
  if (/^\/?plotpickle\s+(?:help|tools)$/iu.test(value)) return Object.freeze({ action: "tools" });
  if (/^\/?plotpickle\s+status$/iu.test(value)) return Object.freeze({ action: "status" });
  if (/^\/?plotpickle\s+(?:library|list\s+projects)$/iu.test(value)) return Object.freeze({ action: "library" });
  // An explicit selection request only. Unrecognized creative narration stays with DSDD.
  const open = value.match(/^\/?plotpickle\s+open\s+(.+)$/iu);
  if (open) {
    const title = open[1].trim();
    return title.length > 0 && title.length <= 160 && /[\p{L}\p{N}]/u.test(title)
      ? Object.freeze({ action: "open", title })
      : Object.freeze({ action: "invalid", reason: "Choose an existing saved Library story title (1–160 characters). Nothing was executed." });
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
      "Commands: PlotPickle tools | PlotPickle library | PlotPickle status | PlotPickle plan Block 01 | PlotPickle open <saved story title>",
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
