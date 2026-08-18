import { packageProject, projectFromPackage, inspectPackage } from "./ppf-exchange";
import { currentProjectRevision } from "./project-revisions";
import type { PlotPickleProject } from "./project";
import {
  createLocalBackupArchive,
  inspectLocalBackupArchive,
  restoreLocalBackupArchive,
  sanitizeBackupJson,
} from "./local-backup-runtime.mjs";

export const LOCAL_BACKUP_EXTENSION = ".ppbackup" as const;
export const LOCAL_BACKUP_EXCLUSIONS = [
  "PlotPickle credential files and API/provider secrets",
  "OS keychain/DPAPI/Secret Service entries",
  "PlotPickle Studio private signing keys",
  "BUZZ private keys",
  "BUZZ-owned private agent memory and instructions",
  "BUZZ runtime/provider/model configuration",
  "BUZZ Studio membership and relay history",
  "developer shell credentials and GitHub tokens",
] as const;

export type LocalBackupEvidenceRecord = {
  id: string;
  kind: "responsibility-run" | "verification" | "report";
  value: unknown;
};

export type LocalBackupCreateOptions = {
  sourceAppVersion?: string;
  createdAt?: string;
  includeRuns?: boolean;
  includeVerification?: boolean;
  includeReports?: boolean;
  evidence?: readonly LocalBackupEvidenceRecord[];
};

export type LocalBackupRestorePreview = {
  project: PlotPickleProject;
  projectId: string;
  projectTitle: string;
  projectRevision: number;
  createdAt: string;
  sourceAppVersion: string;
  includedKinds: string[];
  evidence: LocalBackupEvidenceRecord[];
  requiresExplicitApply: true;
  overwritePerformed: false;
};

function safeId(value: unknown, maximum = 180) {
  return String(value ?? "").replace(/[^a-z0-9._:-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, maximum);
}

function evidencePath(record: LocalBackupEvidenceRecord) {
  const id = safeId(record.id) || "record";
  if (record.kind === "responsibility-run") return `evidence/runs/${id}.json`;
  if (record.kind === "verification") return `evidence/verification/${id}.json`;
  return `evidence/reports/${id}.json`;
}

function permittedEvidence(options: LocalBackupCreateOptions) {
  return (options.evidence || []).filter((record) => {
    if (record.kind === "responsibility-run") return options.includeRuns === true;
    if (record.kind === "verification") return options.includeVerification === true;
    return options.includeReports === true;
  });
}

function evidenceEntries(records: readonly LocalBackupEvidenceRecord[]) {
  return Object.fromEntries(records.map((record) => {
    const sanitized = sanitizeBackupJson(record.value);
    return [evidencePath(record), Buffer.from(`${JSON.stringify(sanitized, null, 2)}\n`, "utf8")];
  }));
}

function evidenceFromEntries(entries: Record<string, Buffer>): LocalBackupEvidenceRecord[] {
  const result: LocalBackupEvidenceRecord[] = [];
  for (const [path, buffer] of Object.entries(entries)) {
    let kind: LocalBackupEvidenceRecord["kind"] | null = null;
    if (path.startsWith("evidence/runs/")) kind = "responsibility-run";
    else if (path.startsWith("evidence/verification/")) kind = "verification";
    else if (path.startsWith("evidence/reports/")) kind = "report";
    if (!kind) continue;
    try {
      result.push({ id: path.split("/").at(-1)?.replace(/\.json$/i, "") || "record", kind, value: JSON.parse(buffer.toString("utf8")) });
    } catch {
      throw new Error(`Backup evidence record ${path} is invalid JSON.`);
    }
  }
  return result;
}

export function createCompleteLocalBackup(project: PlotPickleProject, options: LocalBackupCreateOptions = {}) {
  const createdAt = options.createdAt || new Date().toISOString();
  const sourceAppVersion = options.sourceAppVersion || "1.0.0-rc.3";
  const packaged = packageProject(project, {
    kind: "complete-project",
    rightsConfirmed: false,
    createdAt,
    applicationVersion: sourceAppVersion,
  });
  const evidence = permittedEvidence(options);
  const includes = ["complete-project-ppf"];
  if (evidence.some((record) => record.kind === "responsibility-run")) includes.push("responsibility-runs");
  if (evidence.some((record) => record.kind === "verification")) includes.push("verification-history");
  if (evidence.some((record) => record.kind === "report")) includes.push("selected-reports");
  const archive = createLocalBackupArchive({
    projectId: project.id,
    projectTitle: project.metadata.title,
    projectRevision: currentProjectRevision(project),
    sourceAppVersion,
    createdAt,
    includes,
    exclusions: [...LOCAL_BACKUP_EXCLUSIONS],
    entries: {
      "project.ppf": packaged.buffer,
      ...evidenceEntries(evidence),
    },
  });
  return { buffer: archive, fileName: `${safeId(project.metadata.title || "untitled-story", 80) || "untitled-story"}-${createdAt.replace(/[:.]/g, "-")}${LOCAL_BACKUP_EXTENSION}` };
}

export function inspectCompleteLocalBackup(buffer: Buffer) {
  const outer = inspectLocalBackupArchive(buffer);
  if (!outer.valid) return { valid: false, errors: outer.errors, manifest: outer.manifest, project: null as PlotPickleProject | null, evidence: [] as LocalBackupEvidenceRecord[] };
  const inner = inspectPackage(outer.entries["project.ppf"]);
  if (!inner.valid) return { valid: false, errors: inner.errors.map((error) => `project.ppf: ${error}`), manifest: outer.manifest, project: null as PlotPickleProject | null, evidence: [] as LocalBackupEvidenceRecord[] };
  const restored = projectFromPackage(outer.entries["project.ppf"]);
  const errors: string[] = [];
  if (restored.project.id !== outer.manifest.projectId) errors.push("Backup project ID does not match project.ppf.");
  if (currentProjectRevision(restored.project) !== outer.manifest.projectRevision) errors.push("Backup project revision does not match project.ppf canonical revision.");
  const evidence = evidenceFromEntries(outer.entries);
  return { valid: errors.length === 0, errors, manifest: outer.manifest, project: restored.project, evidence };
}

export function previewCompleteLocalBackupRestore(buffer: Buffer): LocalBackupRestorePreview {
  const staged = restoreLocalBackupArchive(buffer);
  const inspected = inspectCompleteLocalBackup(buffer);
  if (!inspected.valid || !inspected.project) throw new Error(inspected.errors.join("; ") || "Backup restore validation failed.");
  return {
    project: inspected.project,
    projectId: inspected.manifest.projectId,
    projectTitle: inspected.manifest.projectTitle,
    projectRevision: inspected.manifest.projectRevision,
    createdAt: inspected.manifest.createdAt,
    sourceAppVersion: inspected.manifest.sourceAppVersion,
    includedKinds: [...inspected.manifest.includes],
    evidence: inspected.evidence,
    requiresExplicitApply: staged.requiresExplicitApply,
    overwritePerformed: staged.overwritePerformed,
  };
}

export function backupSecretBoundary() {
  return {
    includesProjectPpf: true,
    includesCredentials: false,
    includesProviderSecrets: false,
    includesStudioPrivateSigningKeys: false,
    includesBuzzPrivateKeys: false,
    includesBuzzOwnedMemoryOrRuntimeConfig: false,
  } as const;
}
