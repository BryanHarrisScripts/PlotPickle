"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AFTERGLOW_PROJECT_FILE,
  AFTERGLOW_PROJECT_ID,
  AFTERGLOW_PROJECT_TITLE,
  AFTERGLOW_REPOSITORY_FULL_NAME,
  AFTERGLOW_REPOSITORY_PROJECT_PATH,
  AFTERGLOW_REPOSITORY_URL,
  afterglowCollaborationPatch,
  deriveAfterglowDashboardState,
  EMPTY_AFTERGLOW_PERSISTENCE_STATUS,
  isAfterglowProjectId,
  isExpectedAfterglowRepository,
  normalizeAfterglowPersistenceStatus,
  type AfterglowPersistenceRepository,
  type AfterglowPersistenceServerStatus,
} from "@/lib/afterglow-persistence";
import type { PlotPickleProject } from "@/lib/project";

type JsonRequestError = Error & { status?: number; response?: Record<string, unknown> };
type LoadResult = {
  project: PlotPickleProject;
  source: "persistent-local" | "github";
  message: string;
};

async function jsonRequest(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: object,
) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : { Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const error = new Error("Afterglow GitHub persistence is available in the downloaded PlotPickle server.") as JsonRequestError;
    error.status = response.status;
    throw error;
  }
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(typeof value.message === "string" ? value.message : "The Afterglow persistence operation failed.") as JsonRequestError;
    error.status = response.status;
    error.response = value;
    throw error;
  }
  return value;
}

function localProjectAvailable(value: Record<string, unknown>) {
  if (!Array.isArray(value.projects)) return false;
  return value.projects.some((item) => {
    if (!item || typeof item !== "object") return false;
    const project = item as Record<string, unknown>;
    return project.projectKey === AFTERGLOW_PROJECT_ID || project.fileName === AFTERGLOW_PROJECT_FILE;
  });
}

function repositoryFrom(value: Record<string, unknown>): AfterglowPersistenceRepository & {
  login?: string;
  repositoryUrl?: string;
} {
  return {
    owner: String(value.owner || ""),
    repo: String(value.repo || ""),
    branch: String(value.branch || "main"),
    projectPath: String(value.projectPath || AFTERGLOW_REPOSITORY_PROJECT_PATH),
    ready: Boolean(value.ready),
    verifiedAt: String(value.verifiedAt || ""),
    login: String(value.login || ""),
    repositoryUrl: String(value.repositoryUrl || AFTERGLOW_REPOSITORY_URL),
  };
}

function connectedProject(
  project: PlotPickleProject,
  connection: ReturnType<typeof repositoryFrom>,
) {
  const now = new Date().toISOString();
  return {
    ...project,
    collaboration: {
      ...project.collaboration,
      ...afterglowCollaborationPatch(connection, now),
    },
    metadata: { ...project.metadata, updatedAt: now },
  };
}

function locallyLoadedProject(project: PlotPickleProject) {
  const now = new Date().toISOString();
  return {
    ...project,
    collaboration: {
      ...project.collaboration,
      provider: "none" as const,
      syncEnabled: false,
      updatedAt: now,
    },
    metadata: { ...project.metadata, updatedAt: now },
  };
}

async function currentAfterglowConnection() {
  try {
    const checked = await jsonRequest("/api/local-github/connection/check", "POST");
    const repository = repositoryFrom(checked);
    return isExpectedAfterglowRepository(repository.owner, repository.repo) && repository.ready
      ? repository
      : null;
  } catch {
    return null;
  }
}

async function selectAfterglowRepository(project: PlotPickleProject) {
  const app = await jsonRequest("/api/local-github-app/status");
  if (!app.authenticated) {
    throw new Error(`Connect GitHub in Settings and grant PlotPickle access to ${AFTERGLOW_REPOSITORY_FULL_NAME} first.`);
  }
  const select = (initializeMissingManifest: boolean) => jsonRequest(
    "/api/local-github-app/select",
    "POST",
    {
      fullName: AFTERGLOW_REPOSITORY_FULL_NAME,
      projectPath: AFTERGLOW_REPOSITORY_PROJECT_PATH,
      initializeMissingManifest,
      title: project.metadata.title || AFTERGLOW_PROJECT_TITLE,
      projectId: AFTERGLOW_PROJECT_ID,
    },
  );
  let selected = await select(false);
  if (selected.requiresInitialization) {
    const approved = window.confirm(
      `The Afterglow repository needs PlotPickle’s manifest and starter project folders. Initialize only the missing files in ${AFTERGLOW_REPOSITORY_FULL_NAME}? Existing repository files will be preserved.`,
    );
    if (!approved) throw new Error("The Afterglow repository was not changed, and GitHub persistence remains off.");
    selected = await select(true);
  }
  if (selected.requiresInitialization) throw new Error("The Afterglow repository still requires PlotPickle initialization.");
  const checked = repositoryFrom(await jsonRequest("/api/local-github/connection/check", "POST"));
  if (!isExpectedAfterglowRepository(checked.owner, checked.repo) || !checked.ready) {
    throw new Error(`PlotPickle could not verify ${AFTERGLOW_REPOSITORY_FULL_NAME}. GitHub persistence remains off.`);
  }
  return checked;
}

export function useAfterglowPersistence(activeProjectId: string) {
  const [status, setStatus] = useState<AfterglowPersistenceServerStatus>(EMPTY_AFTERGLOW_PERSISTENCE_STATUS);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [preference, library] = await Promise.all([
        jsonRequest("/api/local-afterglow/status"),
        jsonRequest("/api/local-projects/library"),
      ]);
      const next = normalizeAfterglowPersistenceStatus(preference, localProjectAvailable(library));
      setStatus(next);
      return next;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Afterglow persistence status could not be read.";
      const next = {
        ...EMPTY_AFTERGLOW_PERSISTENCE_STATUS,
        error: detail,
      };
      setStatus(next);
      return next;
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const dashboard = useMemo(
    () => deriveAfterglowDashboardState(activeProjectId, status),
    [activeProjectId, status],
  );

  const enable = useCallback(async (project: PlotPickleProject) => {
    if (!isAfterglowProjectId(project.id)) throw new Error("Load Afterglow before enabling its GitHub repository.");
    setWorking(true);
    setMessage("Verifying the Afterglow repository and persistent project folder…");
    try {
      let connection = await currentAfterglowConnection() || await selectAfterglowRepository(project);
      let next = connectedProject(project, connection);
      try {
        await jsonRequest("/api/local-github-sync/preview", "POST", { project: next });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "";
        if (!/missing plotpickle-project\.json/i.test(detail)) throw error;
        connection = await selectAfterglowRepository(project);
        next = connectedProject(project, connection);
        await jsonRequest("/api/local-github-sync/preview", "POST", { project: next });
      }
      await jsonRequest("/api/local-projects/save", "POST", {
        project: next,
        fileName: AFTERGLOW_PROJECT_FILE,
      });
      await jsonRequest("/api/local-afterglow/enable", "POST");
      await refresh();
      setMessage("Afterglow GitHub repository connected. Edits now autosave to its persistent local project folder; pull and publish remain reviewed actions.");
      window.dispatchEvent(new CustomEvent("plotpickle:connection-status-refresh"));
      return next;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Afterglow GitHub persistence could not be enabled.";
      setMessage(detail);
      throw error;
    } finally {
      setWorking(false);
    }
  }, [refresh]);

  const disable = useCallback(async (project: PlotPickleProject) => {
    setWorking(true);
    setMessage("Returning Afterglow to the default local loading mode…");
    try {
      await jsonRequest("/api/local-afterglow/disable", "POST");
      const next = isAfterglowProjectId(project.id) ? locallyLoadedProject(project) : project;
      if (isAfterglowProjectId(next.id)) {
        await jsonRequest("/api/local-projects/save", "POST", {
          project: next,
          fileName: AFTERGLOW_PROJECT_FILE,
        });
      }
      await refresh();
      setMessage("Afterglow is in local loading mode. Its persistent project and backups were kept.");
      window.dispatchEvent(new CustomEvent("plotpickle:connection-status-refresh"));
      return next;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Afterglow GitHub persistence could not be disabled.";
      setMessage(detail);
      throw error;
    } finally {
      setWorking(false);
    }
  }, [refresh]);

  const load = useCallback(async (): Promise<LoadResult | null> => {
    const current = await refresh();
    if (!current.enabled) return null;
    setWorking(true);
    setMessage("Opening the persistent Afterglow project…");
    try {
      try {
        const local = await jsonRequest(`/api/local-projects/load?file=${encodeURIComponent(AFTERGLOW_PROJECT_FILE)}`);
        const project = local.project as PlotPickleProject;
        if (!isAfterglowProjectId(project?.id)) throw new Error("The saved Afterglow folder contains a different project and was not opened.");
        const notice = current.repository.ready
          ? "The persistent Afterglow project opened. Its verified GitHub repository remains available for reviewed pull and publish."
          : "The persistent Afterglow project opened locally. GitHub is unavailable or needs repair; no local work was removed.";
        setMessage(notice);
        return { project, source: "persistent-local", message: notice };
      } catch (error) {
        const requestError = error as JsonRequestError;
        const missingLocalProject = requestError.status === 404
          || (requestError.status === 400 && /ENOENT|no such file|not found/i.test(requestError.message));
        if (!missingLocalProject) throw error;
        if (!current.repository.ready) throw new Error("The persistent Afterglow folder is not available and GitHub is not currently verified. The bundled example remains available with GitHub mode off.");
      }
      const remote = await jsonRequest("/api/local-github-sync/pull", "POST", {});
      const project = remote.project as PlotPickleProject;
      if (!isAfterglowProjectId(project?.id)) throw new Error("The Afterglow repository contains a different PlotPickle project and was not opened.");
      await jsonRequest("/api/local-projects/save", "POST", {
        project,
        fileName: AFTERGLOW_PROJECT_FILE,
      });
      await refresh();
      const notice = "Afterglow was restored from its verified GitHub repository and saved to the persistent local project folder.";
      setMessage(notice);
      return { project, source: "github", message: notice };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The persistent Afterglow project could not be opened.";
      setMessage(detail);
      throw error;
    } finally {
      setWorking(false);
    }
  }, [refresh]);

  const save = useCallback(async (project: PlotPickleProject) => {
    if (!status.enabled || !isAfterglowProjectId(project.id)) return false;
    try {
      await jsonRequest("/api/local-projects/save", "POST", {
        project,
        fileName: AFTERGLOW_PROJECT_FILE,
      });
      setMessage(status.repository.ready
        ? "Afterglow saved to its persistent project folder. GitHub publication remains a reviewed action."
        : "Afterglow saved locally. GitHub needs repair, but this local work was preserved.");
      setStatus((current) => current.localProjectAvailable
        ? current
        : { ...current, localProjectAvailable: true });
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Afterglow could not be saved to its persistent project folder.");
      return false;
    }
  }, [status.enabled, status.repository.ready]);

  return {
    dashboard,
    enabled: status.enabled,
    working,
    message,
    refresh,
    enable,
    disable,
    load,
    save,
  };
}
