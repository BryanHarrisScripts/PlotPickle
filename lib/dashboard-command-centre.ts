import { completionFor, type PlotPickleProject } from "./project";
import { projectSectionProgress, sectionHasAlert } from "./project-progress";
import { deriveDashboardStorageStatus, type DashboardStorageStatus } from "./project-dashboard";
import { LEARNING_MODULE_COUNT, type ProductNavigationId } from "./product-direction";
import type { PlotPickleSettings } from "./ai/settings";
import {
  connectionSettingsSection,
  type ConnectionState,
  type ConnectionStatusSnapshot,
  type PublicConnectionStatus,
} from "./connection-status";

export type DashboardTone = "green" | "yellow" | "red";

export type DashboardTarget = {
  workspace: ProductNavigationId;
  section?: string;
  blockNumber?: number;
};

export type DashboardConnectionCard = {
  id: string;
  label: string;
  tone: DashboardTone;
  status: string;
  detail: string;
  target: DashboardTarget;
};

export type DashboardWorkflowCard = {
  id: "learn" | "plan" | "build" | "write" | "storyboard" | "refine";
  label: string;
  completion: number;
  unresolved: number;
  lastActivity: string;
  nextStep: string;
  target: DashboardTarget;
};

export type DashboardAttentionItem = {
  id: string;
  tone: DashboardTone;
  title: string;
  detail: string;
  count?: number;
  target: DashboardTarget;
};

export type DashboardSnapshot = {
  title: string;
  draft: string;
  format: string;
  runtimeMinutes: number;
  pageEstimate: number;
  scenes: number;
  characters: number;
  locations: number;
  projectPath: string;
  lastSaved: string;
  canonicalState: string;
};

export type DashboardCommandCentreModel = {
  readiness: DashboardTone;
  readinessLabel: string;
  recommendedAction: DashboardAttentionItem | null;
  connections: DashboardConnectionCard[];
  workflow: DashboardWorkflowCard[];
  attention: DashboardAttentionItem[];
  snapshot: DashboardSnapshot;
  storage: DashboardStorageStatus;
};

export type DashboardCommandCentreOptions = {
  saveState: string;
  learningCompleted?: number;
  settings: PlotPickleSettings;
  connectionStatus: ConnectionStatusSnapshot;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function filled(values: unknown[]) {
  return values.filter((value) => typeof value === "string" ? value.trim() : Boolean(value)).length;
}

function toneForPercentage(value: number): DashboardTone {
  if (value >= 70) return "green";
  if (value > 0) return "yellow";
  return "red";
}

function storageTone(storage: DashboardStorageStatus): DashboardTone {
  if (storage.state === "synchronized") return "green";
  if (storage.state === "review-required") return "red";
  return "yellow";
}

function connectionTone(state: ConnectionState): DashboardTone {
  if (state === "connected" || state === "disabled") return "green";
  if (state === "error") return "red";
  return "yellow";
}

function connectionStateLabel(connection: PublicConnectionStatus) {
  if (connection.state === "connected") return "Connected";
  if (connection.state === "configured") return "Configured — test connection";
  if (connection.state === "checking") return "Checking connection";
  if (connection.state === "error") return "Connection problem";
  if (connection.state === "unavailable") return "Unavailable in this environment";
  if (connection.state === "disabled") return "Optional — disabled";
  return "Optional — not connected";
}

function latestActivity(project: PlotPickleProject, values: string[] = []) {
  return [project.metadata.updatedAt, ...values]
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || project.metadata.createdAt;
}

function blockCompletion(project: PlotPickleProject) {
  return project.blocks.map((block) => clamp((filled([
    block.summary,
    block.goal,
    block.conflict,
    block.choice,
    block.action,
    block.consequence,
    block.emotionalTurn,
    block.pickleTurn,
  ]) / 8) * 100));
}

function miniCompletion(project: PlotPickleProject) {
  return project.blocks.flatMap((block) => block.scenes.flatMap((scene) => scene.miniBlocks)).map((mini) => clamp((filled([
    mini.objective,
    mini.resistance,
    mini.action,
    mini.turn,
    mini.visualBeat,
    mini.dialogueIntention,
    mini.entryState,
    mini.exitState,
  ]) / 8) * 100));
}

export function createDashboardCommandCentreModel(project: PlotPickleProject, options: DashboardCommandCentreOptions): DashboardCommandCentreModel {
  const sections = projectSectionProgress(project);
  const scenes = project.blocks.flatMap((block) => block.scenes);
  const miniBlocks = scenes.flatMap((scene) => scene.miniBlocks);
  const blockScores = blockCompletion(project);
  const miniScores = miniCompletion(project);
  const visualFrames = project.blocks.flatMap((block) => block.visuals);
  const unresolvedReview = project.review.threads.filter((thread) => thread.status !== "resolved");
  const openSectionAlerts = Object.keys(sections).filter((section) => sectionHasAlert(project, section as keyof typeof sections)).length;
  const latestRevision = project.revisions.at(-1);
  const connectedToGitHub = project.collaboration.provider === "github" && Boolean(project.collaboration.repositoryUrl);
  const commitsMatch = connectedToGitHub
    && Boolean(project.collaboration.lastPulledCommit)
    && project.collaboration.lastPulledCommit === project.collaboration.lastPushedCommit;

  const storage = deriveDashboardStorageStatus({
    hasLocalProject: true,
    hasLocalAssetFolder: visualFrames.some((frame) => Boolean(frame.src)),
    collaboration: project.collaboration,
    localContentHash: latestRevision?.contentHash,
    lastPublishedContentHash: commitsMatch ? latestRevision?.contentHash : undefined,
    remoteHead: project.collaboration.lastPulledCommit || undefined,
    exportCreatedAt: "",
  });

  const sharedConnections = options.connectionStatus.items;
  const saveHealthy = sharedConnections.storage.state === "connected";
  const connectionCard = (connection: PublicConnectionStatus, label = connection.label): DashboardConnectionCard => ({
    id: connection.id,
    label,
    tone: connectionTone(connection.state),
    status: connectionStateLabel(connection),
    detail: [connection.identity, connection.detail].filter(Boolean).join(" · "),
    target: { workspace: "settings", section: connectionSettingsSection(connection.id) },
  });

  const connections: DashboardConnectionCard[] = [
    connectionCard(sharedConnections.github, "Repository & Collab"),
    connectionCard(sharedConnections.ai, "Story & Art"),
    connectionCard(sharedConnections.plugins, "Media & Film Engines"),
    connectionCard(sharedConnections.google, "Scheduling & Meetings"),
    {
      ...connectionCard(sharedConnections.storage, "Current project"),
      id: "save",
      target: { workspace: "dashboard" },
    },
    {
      ...connectionCard(sharedConnections.backups, "Storage and backup"),
      tone: storageTone(storage),
      status: storage.label,
      detail: `${storage.detail} ${sharedConnections.backups.detail}`.trim(),
    },
    {
      id: "collaboration",
      label: "Collaboration",
      tone: connectedToGitHub ? (commitsMatch ? "green" : "yellow") : "yellow",
      status: connectedToGitHub ? (commitsMatch ? "Canonical branch aligned" : "Proposal or synchronization review needed") : "Local-only workflow",
      detail: connectedToGitHub ? `Canonical branch: ${project.collaboration.branch || "main"}.` : "Local work stays private until you explicitly connect and propose changes.",
      target: { workspace: "settings", section: "github" },
    },
  ];

  const learnCompletion = clamp(((options.learningCompleted || 0) / LEARNING_MODULE_COUNT) * 100);
  const planCompletion = completionFor(project);
  const buildCompletion = clamp(average([...blockScores, ...miniScores]));
  const screenplayElements = project.screenplay.draftElements.length;
  const writeCompletion = clamp(Math.max(project.screenplay.sourceText.trim() ? 45 : 0, (screenplayElements / Math.max(1, scenes.length * 6)) * 100));
  const storyboardCompletion = clamp((visualFrames.length / Math.max(1, miniBlocks.length || 96)) * 100);
  const refineActivity = project.revisions.length + project.review.threads.length + project.storyThreads.length;
  const refineCompletion = clamp(refineActivity ? 55 + ((project.review.threads.length - unresolvedReview.length) / Math.max(1, project.review.threads.length)) * 45 : 0);

  const workflow: DashboardWorkflowCard[] = [
    {
      id: "learn",
      label: "Learn",
      completion: learnCompletion,
      unresolved: Math.max(0, LEARNING_MODULE_COUNT - (options.learningCompleted || 0)),
      lastActivity: latestActivity(project),
      nextStep: learnCompletion ? "Continue the next unfinished lesson." : "Choose a learning path for the current writing problem.",
      target: { workspace: "learn" },
    },
    {
      id: "plan",
      label: "Plan",
      completion: planCompletion,
      unresolved: openSectionAlerts,
      lastActivity: latestActivity(project),
      nextStep: openSectionAlerts ? "Resolve the next open story question." : planCompletion < 70 ? "Complete the least-developed story section." : "Review the complete story overview.",
      target: { workspace: "planner", section: openSectionAlerts ? "notes" : "overview" },
    },
    {
      id: "build",
      label: "Build",
      completion: buildCompletion,
      unresolved: blockScores.filter((score) => score < 70).length + miniScores.filter((score) => score < 70).length,
      lastActivity: latestActivity(project),
      nextStep: miniBlocks.length < 96 ? "Restore the complete 96-position structural wall." : "Develop the next incomplete Block or mini-block.",
      target: { workspace: "planner", section: "structureMap" },
    },
    {
      id: "write",
      label: "Write",
      completion: writeCompletion,
      unresolved: scenes.filter((scene) => scene.status === "outline").length,
      lastActivity: latestActivity(project, project.screenplay.draftElements.map((element) => element.updatedAt)),
      nextStep: screenplayElements || project.screenplay.sourceText ? "Continue the current screenplay draft." : "Open the screenplay and write the first scene.",
      target: { workspace: "script" },
    },
    {
      id: "storyboard",
      label: "Storyboard",
      completion: storyboardCompletion,
      unresolved: Math.max(0, (miniBlocks.length || 96) - visualFrames.length),
      lastActivity: latestActivity(project),
      nextStep: visualFrames.length ? "Create the next missing visual frame." : "Establish the first visual turn and continuity reference.",
      target: { workspace: "visuals" },
    },
    {
      id: "refine",
      label: "Refine",
      completion: refineCompletion,
      unresolved: unresolvedReview.length,
      lastActivity: latestActivity(project, [...project.review.threads.map((thread) => thread.updatedAt), ...project.revisions.map((revision) => revision.createdAt)]),
      nextStep: unresolvedReview.length ? "Review the highest-priority unresolved note." : "Run the next specialist diagnostic pass.",
      target: { workspace: "engines" },
    },
  ];

  const attention: DashboardAttentionItem[] = [];
  const incompleteBlocks = blockScores.filter((score) => score < 70).length;
  if (project.blocks.length !== 24 || incompleteBlocks) attention.push({
    id: "blocks",
    tone: project.blocks.length !== 24 ? "red" : "yellow",
    title: project.blocks.length !== 24 ? "The canonical 24-Block map is incomplete" : "Blocks still need development",
    detail: `${project.blocks.length} Blocks exist; ${incompleteBlocks} remain below the working-readiness threshold.`,
    count: Math.max(Math.abs(24 - project.blocks.length), incompleteBlocks),
    target: { workspace: "planner", section: "blocks" },
  });

  const incompleteMinis = miniScores.filter((score) => score < 70).length;
  if (miniBlocks.length !== 96 || incompleteMinis) attention.push({
    id: "mini-blocks",
    tone: miniBlocks.length !== 96 ? "red" : "yellow",
    title: miniBlocks.length !== 96 ? "The 96 mini-block wall needs repair" : "Mini-blocks still need story movement",
    detail: `${miniBlocks.length} mini-blocks exist; ${incompleteMinis} remain below the working-readiness threshold.`,
    count: Math.max(Math.abs(96 - miniBlocks.length), incompleteMinis),
    target: { workspace: "planner", section: "structureMap" },
  });

  const incompleteCharacters = project.characters.filter((character) => filled([character.name, character.role, character.want, character.need, character.arc]) < 5).length;
  if (!project.characters.length || incompleteCharacters) attention.push({
    id: "characters",
    tone: project.characters.length ? "yellow" : "red",
    title: project.characters.length ? "Character records need completion" : "No characters are defined",
    detail: project.characters.length ? `${incompleteCharacters} character records are missing role, want, need or arc information.` : "Create the protagonist before structure and dialogue decisions harden.",
    count: Math.max(1, incompleteCharacters),
    target: { workspace: "planner", section: "characters" },
  });

  const missingFrames = Math.max(0, (miniBlocks.length || 96) - visualFrames.length);
  if (missingFrames) attention.push({
    id: "storyboard",
    tone: visualFrames.length ? "yellow" : "red",
    title: "Storyboard frames are missing",
    detail: `${visualFrames.length} visual frames exist across ${miniBlocks.length || 96} structural positions.`,
    count: missingFrames,
    target: { workspace: "visuals" },
  });

  if (unresolvedReview.length) attention.push({
    id: "feedback",
    tone: unresolvedReview.some((thread) => thread.priority === "critical") ? "red" : "yellow",
    title: "Feedback remains unresolved",
    detail: `${unresolvedReview.length} review threads still require a decision or response.`,
    count: unresolvedReview.length,
    target: { workspace: "reports" },
  });

  if (!saveHealthy) attention.push({
    id: "unsaved",
    tone: "yellow",
    title: "Current changes are not confirmed saved",
    detail: options.saveState,
    target: { workspace: "dashboard" },
  });

  if (sharedConnections.ai.state === "error") attention.push({
    id: "ai",
    tone: "red",
    title: "AI connection needs attention",
    detail: sharedConnections.ai.error || sharedConnections.ai.detail || "Open Settings to verify the saved provider.",
    target: { workspace: "settings", section: "ai" },
  });

  if (connectedToGitHub && !commitsMatch) attention.push({
    id: "proposals",
    tone: "yellow",
    title: "GitHub synchronization or proposal review is pending",
    detail: "The last pulled and last pushed canonical commits do not match.",
    target: { workspace: "settings", section: "github" },
  });

  if (storage.requiresReview || storage.state === "backup-recommended") attention.push({
    id: "storage",
    tone: storage.state === "review-required" ? "red" : "yellow",
    title: storage.label,
    detail: storage.detail,
    target: { workspace: "settings", section: "storage" },
  });

  const redCount = attention.filter((item) => item.tone === "red").length;
  const readiness: DashboardTone = redCount ? "red" : attention.length ? "yellow" : "green";
  const readinessLabel = readiness === "green" ? "Ready to continue" : readiness === "yellow" ? "Continue with review" : "Resolve blockers first";
  const recommendedAction = attention.find((item) => item.tone === "red") || attention[0] || null;
  const pageEstimate = scenes.reduce((sum, scene) => sum + (scene.pageEstimate || 0), 0) || project.metadata.targetMinutes;

  return {
    readiness,
    readinessLabel,
    recommendedAction,
    connections,
    workflow,
    attention,
    snapshot: {
      title: project.metadata.title,
      draft: project.metadata.status,
      format: project.metadata.format,
      runtimeMinutes: project.metadata.targetMinutes,
      pageEstimate: Math.round(pageEstimate * 10) / 10,
      scenes: scenes.length,
      characters: project.characters.length,
      locations: project.world.locations.length,
      projectPath: project.collaboration.projectPath || `local/${project.id}.ppf`,
      lastSaved: project.metadata.updatedAt,
      canonicalState: connectedToGitHub ? `${project.collaboration.branch || "main"} · ${storage.label}` : `Local canonical project · ${storage.label}`,
    },
    storage,
  };
}

export function dashboardToneForPercentage(value: number) {
  return toneForPercentage(value);
}
