import * as core from "./profile-private-storage-core.mjs";
import type { AuthContext, PlotPickleAuthService } from "../../auth/plotpickle-auth";

export type ProfileStorageDomain = "projects" | "library" | "memory" | "indexes" | "assets" | "buzz" | "credentials" | "settings" | "cache";

export type ProfileStoragePaths = Readonly<{
  home: string;
  profileId: string;
  profileRoot: string;
  vault: string;
  projects: string;
  library: string;
  memory: string;
  indexes: string;
  assets: string;
  buzz: string;
  credentials: string;
  settings: string;
  cache: string;
}>;

export type ProfileProjectSummary = Readonly<{
  projectId: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  progress: number;
  frontier: string;
  thumbnailRef: string;
}>;

export type LegacyProfileMigrationSource = {
  readonly sourceId: string;
  setReadOnly(value: true): Promise<void>;
  createSnapshot(): Promise<string>;
  listProjects(): Promise<ReadonlyArray<{ readonly id: string; readonly value: unknown; readonly summary?: Partial<ProfileProjectSummary> }>>;
  listCredentials(): Promise<ReadonlyArray<{ readonly name: string; readonly value: unknown }>>;
  complete?(result: { readonly profileId: string; readonly snapshotId: string }): Promise<void>;
};

export type ProfilePrivateStorageService = {
  initializeProfile(authContext: AuthContext): Promise<{ readonly profileId: string; readonly paths: ProfileStoragePaths }>;
  readPrivateJson(authContext: AuthContext, input: { readonly domain: ProfileStorageDomain; readonly objectId: string }): Promise<unknown | null>;
  writePrivateJson(authContext: AuthContext, input: { readonly domain: ProfileStorageDomain; readonly objectId: string; readonly value: unknown }): Promise<unknown>;
  saveProject(authContext: AuthContext, input: { readonly project: unknown; readonly summary?: Partial<ProfileProjectSummary>; readonly activate?: boolean }): Promise<{ readonly project: unknown; readonly summary: ProfileProjectSummary }>;
  loadProject(authContext: AuthContext, projectId: string): Promise<unknown | null>;
  listProjects(authContext: AuthContext): Promise<ReadonlyArray<ProfileProjectSummary>>;
  activateProject(authContext: AuthContext, projectId: string): Promise<string>;
  loadActiveProject(authContext: AuthContext): Promise<unknown | null>;
  writeCredential(authContext: AuthContext, name: string, value: unknown): Promise<unknown>;
  readCredential(authContext: AuthContext, name: string): Promise<unknown | null>;
  exportProject(authContext: AuthContext, projectId: string): Promise<Readonly<{ format: "plotpickle-explicit-project-export"; version: 1; ownerProfileId: string; project: unknown; exportedAt: string }>>;
  migrateLegacyProfile(authContext: AuthContext, source: LegacyProfileMigrationSource): Promise<Readonly<{ sourceId: string; resumed: boolean; complete: boolean; projectCount: number; credentialCount: number; snapshotId: string }>>;
  close(): void;
};

export type NodeSecretProtector = {
  readonly protection: string;
  protect(input: { readonly name: string; readonly clear: Uint8Array }): Promise<unknown>;
  unprotect(input: { readonly name: string; readonly protected: unknown }): Promise<Uint8Array>;
};

export type NodeSecretStore = {
  readonly scope: "node";
  readonly protection: string;
  readonly path: string;
  write(name: string, value: unknown): Promise<void>;
  read(name: string): Promise<unknown | null>;
  remove(name: string): Promise<void>;
  inventory(): Promise<ReadonlyArray<string>>;
};

export const PROFILE_PRIVATE_STORAGE_VERSION = core.PROFILE_PRIVATE_STORAGE_VERSION as 1;
export const PROFILE_PRIVATE_OBJECT_FORMAT = core.PROFILE_PRIVATE_OBJECT_FORMAT as "plotpickle-profile-private-object";
export const NODE_SECRET_FORMAT = core.NODE_SECRET_FORMAT as "plotpickle-node-secret";
export const normalizeProfileStorageId = core.normalizeProfileStorageId as (value: unknown) => string;
export const profileStoragePaths = core.profileStoragePaths as (root: string, profileId: string) => ProfileStoragePaths;
export const nodeStoragePaths = core.nodeStoragePaths as (root: string) => Readonly<{ home: string; nodeRoot: string; identity: string; runtime: string; secrets: string }>;
export const createProfilePrivateStorageService = core.createProfilePrivateStorageService as (options: {
  readonly root: string;
  readonly authService: Pick<PlotPickleAuthService, "createProfileVaultCapability" | "registerVaultCleanupHook">;
  readonly normalizeProject?: (value: unknown) => unknown;
  readonly now?: () => string;
  readonly migrationLog?: (event: Readonly<Record<string, unknown>>) => void;
}) => ProfilePrivateStorageService;
export const createNodeSecretStore = core.createNodeSecretStore as (options: { readonly root: string; readonly protector: NodeSecretProtector }) => NodeSecretStore;
