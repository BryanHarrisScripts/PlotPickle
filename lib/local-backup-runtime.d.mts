export const LOCAL_BACKUP_FORMAT: "plotpickle-local-backup";
export const LOCAL_BACKUP_VERSION: 1;

export type LocalBackupRuntimeManifest = {
  format: typeof LOCAL_BACKUP_FORMAT;
  formatVersion: typeof LOCAL_BACKUP_VERSION;
  backupId: string;
  projectId: string;
  projectTitle: string;
  projectRevision: number;
  createdAt: string;
  sourceAppVersion: string;
  includes: string[];
  exclusions: string[];
  files: Array<{ path: string; bytes: number; sha256: string }>;
  archiveSha256: string;
};

export function sanitizeBackupJson(value: unknown, depth?: number): unknown;

export function createLocalBackupArchive(input: {
  backupId?: string;
  projectId: string;
  projectTitle: string;
  projectRevision: number;
  sourceAppVersion?: string;
  createdAt?: string;
  includes?: string[];
  exclusions?: string[];
  entries: Record<string, Buffer | string>;
}): Buffer;

export function inspectLocalBackupArchive(buffer: Buffer): {
  valid: boolean;
  errors: string[];
  manifest: LocalBackupRuntimeManifest;
  entries: Record<string, Buffer>;
};

export function restoreLocalBackupArchive(buffer: Buffer): {
  manifest: LocalBackupRuntimeManifest;
  entries: Record<string, Buffer>;
  requiresExplicitApply: true;
  overwritePerformed: false;
};
