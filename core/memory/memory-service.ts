import type { AuthContext } from "../auth/plotpickle-auth";
import * as core from "./memory-service-core.mjs";

export type MemoryScope = "human" | "project" | "agent";
export type MemorySource = "human" | "agent" | "project";
export type MemoryStatus = "active" | "forgotten";
export type MemoryAuthority = "contextual";

export type MemoryRecord = Readonly<{
  version: 1;
  id: string;
  scope: MemoryScope;
  profileId: string;
  projectId: string | null;
  agentId: string | null;
  content: string;
  source: MemorySource;
  authority: MemoryAuthority;
  createdAt: string;
  updatedAt: string;
  tags: readonly string[];
  status: MemoryStatus;
}>;

export type MemorySessionProof = Readonly<{ sessionId: string }>;

export type MemoryWrite = Readonly<{
  scope: MemoryScope;
  projectId?: string | null;
  agentId?: string | null;
  content: string;
  source: MemorySource;
  tags?: readonly string[];
}>;

export type MemoryQuery = Readonly<{
  scope?: MemoryScope;
  projectId?: string | null;
  agentId?: string | null;
  includeForgotten?: boolean;
}>;

export type MemoryService = Readonly<{
  saveMemory(proof: MemorySessionProof, value: MemoryWrite): Promise<MemoryRecord>;
  listMemories(proof: MemorySessionProof, query?: MemoryQuery): Promise<readonly MemoryRecord[]>;
  forgetMemory(proof: MemorySessionProof, memoryId: string): Promise<MemoryRecord>;
}>;

export type MemoryServiceOptions = Readonly<{
  resolveSession(sessionId: string): AuthContext;
  authorizeProject?: (input: Readonly<{ authContext: AuthContext; projectId: string }>) => boolean | Promise<boolean>;
  authorizeAgent?: (input: Readonly<{ authContext: AuthContext; agentId: string; projectId: string | null }>) => boolean | Promise<boolean>;
  now?: () => string;
  createId?: () => string;
}>;

export const MEMORY_RECORD_VERSION = core.MEMORY_RECORD_VERSION as 1;
export const MEMORY_AUTHORITY = core.MEMORY_AUTHORITY as MemoryAuthority;
export const MEMORY_SCOPES = core.MEMORY_SCOPES as readonly MemoryScope[];
export const MEMORY_SOURCES = core.MEMORY_SOURCES as readonly MemorySource[];
export const MEMORY_STATUSES = core.MEMORY_STATUSES as readonly MemoryStatus[];
export const parseMemoryRecord = core.parseMemoryRecord as (value: unknown) => MemoryRecord;
export const resolveMemoryAgainstPpf = core.resolveMemoryAgainstPpf as <T>(input: Readonly<{
  ppfValue: T | null | undefined;
  memoryValue: T;
}>) => Readonly<{ value: T; authority: "ppf" | "memory-context" }>;
export const createMemoryService = core.createMemoryService as (options: MemoryServiceOptions) => MemoryService;
