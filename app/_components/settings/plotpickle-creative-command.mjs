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
    return { error: "BLOCKED: No matching selected Library PPF was verified for this Command request. Open the story in Library first. No tool was executed." };
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
      "Commands: PlotPickle tools | PlotPickle status | PlotPickle plan Block 01",
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
