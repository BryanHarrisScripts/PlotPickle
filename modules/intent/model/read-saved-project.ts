import type { AuthContext } from "../../../core/auth/plotpickle-auth";
import type { ProfilePrivateStorageService } from "../../../core/storage/profile-private/profile-private-storage";
import { normalizeLibraryProject } from "../../../core/storage/library-project";
import { projectCanonicalProjectForOutline } from "../../plan/projections/canonical-project-outline";
import { observeProjectStatus, observeStoryboardShot } from "./observe-project-status";

type StorageReader = Pick<ProfilePrivateStorageService, "listProjects" | "loadProject">;

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,159}$/;
const evidence = Object.freeze({
  authority: "READ_ONLY", canonMutated: false, modelCalled: false,
  independentVerification: false, mediaBytesVerified: false,
});

function result(value: Record<string, unknown>, status = 200) {
  return { status, body: { version: 1, ...evidence, ...value } };
}

function blocked(code: string, status = 400) {
  return result({ state: "BLOCKED", code }, status);
}

function index(query: URLSearchParams, name: string, fallback?: number) {
  const value = query.get(name);
  if (value === null) return fallback ?? -1;
  return /^(0|[1-9][0-9]{0,8})$/.test(value) ? Number(value) : -1;
}

function savedSnapshot(value: unknown, expectedId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const saved = value as Record<string, unknown>;
  // Normalization supplies defaults for legacy UI data. Do not mistake those
  // defaults for an observed persisted identity/revision at a headless boundary.
  if (saved.id !== expectedId || !Number.isSafeInteger(saved.revision) || Number(saved.revision) < 0) return null;
  return normalizeLibraryProject(saved);
}

/**
 * #3409: host-authenticated reads of an explicit saved PPF. The caller must
 * obtain authContext from the existing profile boundary, never MCP arguments.
 * Storage revalidates the vault capability. No active-project read or write.
 */
export async function readSavedProject(
  query: URLSearchParams,
  authContext: AuthContext,
  storage: StorageReader,
) {
  const operation = query.get("storyRead");
  if (!["projects", "status", "source", "structure", "shot"].includes(operation ?? "")) {
    return blocked("UNSUPPORTED_STORY_READ");
  }
  const allowed = new Set(["storyRead", "projectId", "revision"]);
  if (operation === "projects" || operation === "source") {
    allowed.add("offset"); allowed.add("limit");
  }
  if (operation === "shot") {
    for (const key of ["act", "sequence", "block", "mini", "shot"]) allowed.add(key);
  }
  if ([...query.keys()].some(key => !allowed.has(key) || query.getAll(key).length !== 1)) {
    return blocked("INVALID_STORY_READ_QUERY");
  }
  const offset = index(query, "offset", 0);
  const limit = index(query, "limit", 25);
  if (offset < 0 || limit < 1 || limit > 50) return blocked("INVALID_PAGINATION");

  if (operation === "projects") {
    if (query.has("projectId") || query.has("revision")) return blocked("INVALID_STORY_READ_QUERY");
    // listProjects is profile-scoped by the encrypted vault owner. Reading an
    // explicit snapshot does not activate it, including after Library unload.
    const summaries = [...await storage.listProjects(authContext)]
      .sort((a, b) => a.projectId.localeCompare(b.projectId));
    const projects = await Promise.all(summaries.slice(offset, offset + limit).map(async summary => {
      const saved = await storage.loadProject(authContext, summary.projectId);
      const project = savedSnapshot(saved, summary.projectId);
      return {
        id: summary.projectId, title: summary.title, archivedAt: summary.archivedAt,
        revision: project?.revision ?? null,
        availability: project ? "SAVED_RECORD_READ" : "UNAVAILABLE",
      };
    }));
    return result({ state: "OBSERVED", code: "PROFILE_SAVED_PROJECTS_READ", projects,
      total: summaries.length, nextOffset: offset + projects.length < summaries.length ? offset + projects.length : null });
  }

  const projectId = query.get("projectId") ?? "";
  const revision = index(query, "revision");
  if (!ID.test(projectId) || revision < 0) return blocked("INVALID_PROJECT_SELECTION");
  const saved = await storage.loadProject(authContext, projectId);
  if (saved === null) return blocked("SAVED_PROJECT_UNAVAILABLE", 404);
  const project = savedSnapshot(saved, projectId);
  if (!project) return blocked("SAVED_PROJECT_IDENTITY_UNVERIFIABLE", 409);
  if (project.revision !== revision) return blocked("STALE_PROJECT_REVISION", 409);
  const identity = { id: project.id, title: project.title, revision: project.revision };

  if (operation === "source") {
    const screenplay = project.sourceEvidence?.screenplay;
    if (!screenplay) return blocked("SOURCE_EVIDENCE_MISSING", 409);
    const passages = screenplay.passages.slice(offset, offset + limit).map(item => ({
      id: item.id, type: item.type, text: item.text, sceneNumber: item.sceneNumber,
      sceneId: item.sceneId, blockNumber: item.blockNumber, miniBlockNumber: item.miniBlockNumber,
    }));
    return result({ state: "OBSERVED", code: "RETAINED_SCREENPLAY_SOURCE_READ", project: identity,
      source: { fileName: screenplay.sourceFileName, format: screenplay.sourceFormat,
        retainedPassageCount: screenplay.passages.length, importedPassageCount: screenplay.totalPassageCount,
        retainedSourceTruncated: screenplay.passagesTruncated },
      scope: "SCREENPLAY_PASSAGES_NOT_SHOT_MAPPING", passages,
      nextOffset: offset + passages.length < screenplay.passages.length ? offset + passages.length : null });
  }
  if (operation === "structure") {
    const projection = projectCanonicalProjectForOutline(project);
    return result({ state: "OBSERVED", code: "CANONICAL_STRUCTURE_DERIVED", project: identity,
      projectionVersion: projection.version, blocks: projection.blocks });
  }
  const context = { activeProfileId: authContext.profileId, activeProject: project };
  const request = { profileId: authContext.profileId, projectId, projectRevision: revision,
    providerPolicy: "LOCAL_READ_ONLY" as const };
  // Existing observation APIs call their injected project 'activeProject'. Here
  // it is the explicitly loaded saved snapshot, not the UI's active selection.
  const observation = operation === "shot"
    ? observeStoryboardShot({ ...request, capability: "storyboard-shot.observe",
      actNumber: index(query, "act"), sequenceNumber: index(query, "sequence"),
      blockNumber: index(query, "block"), miniBlockNumber: index(query, "mini"),
      shotNumber: index(query, "shot") }, context)
    : observeProjectStatus({ ...request, capability: "project-status.observe" }, context);
  return result({ state: observation.state, code: observation.code, project: identity, observation },
    observation.state === "BLOCKED" ? 409 : 200);
}
