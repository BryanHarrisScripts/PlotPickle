export const PROJECT_LIBRARY_VERSION = 1;
export const PROJECT_LIBRARY_ACTIVE_PROFILE_KEY = "plotpickle.human-profile.active.v1";
export const DEFAULT_LOCAL_PROFILE_ID = "profile-local-primary";
export const LEGACY_ACTIVE_PROJECT_KEY = "plotpickle.foundation.project.v1";
export const PROJECT_LIBRARY_CHANGED_EVENT = "plotpickle:project-library-changed";

const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,127}$/i;

function requireStorage(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("Project Library requires a browser-compatible local storage boundary.");
  }
  return storage;
}

export function normalizeProjectLibraryProfileId(value) {
  const profileId = typeof value === "string" ? value.trim() : "";
  if (!PROFILE_ID_PATTERN.test(profileId)) {
    throw new Error("Project Library requires a valid opaque Human profile id.");
  }
  return profileId;
}

function requireProjectId(value) {
  const projectId = typeof value === "string" ? value.trim() : "";
  if (!projectId || projectId.length > 240) throw new Error("Project Library requires a stable project id.");
  return projectId;
}

export function projectLibraryRegistryKey(profileId) {
  return `plotpickle.library.profile.v1.${normalizeProjectLibraryProfileId(profileId)}.registry`;
}

export function projectLibraryProjectKey(profileId, projectId) {
  return `plotpickle.library.profile.v1.${normalizeProjectLibraryProfileId(profileId)}.projects.${encodeURIComponent(requireProjectId(projectId))}`;
}

export function projectLibraryMigrationKey(profileId) {
  return `plotpickle.library.profile.v1.${normalizeProjectLibraryProfileId(profileId)}.migration`;
}

function quarantine(storage, key, raw, now, reason) {
  if (!raw) return null;
  const quarantineKey = `${key}.quarantine.${now.replace(/[^0-9]/g, "")}`;
  storage.setItem(quarantineKey, JSON.stringify({ version: 1, reason, quarantinedAt: now, raw }));
  storage.removeItem(key);
  return quarantineKey;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseJson(raw) {
  let value = null;
  let error = null;
  if (!raw) return { value, error };
  try {
    value = JSON.parse(raw);
  } catch (cause) {
    error = errorMessage(cause);
  }
  return { value, error };
}

function validSourceKind(value) {
  return value === "user" || value === "example" || value === "preset" || value === "migrated";
}

function normalizeSummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!id || !title) return null;
  return {
    id,
    title,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    progress: Number.isFinite(value.progress) ? Math.max(0, Math.min(100, Math.round(value.progress))) : 0,
    frontier: typeof value.frontier === "string" && value.frontier.trim() ? value.frontier.trim() : "Foundations",
    thumbnail: typeof value.thumbnail === "string" ? value.thumbnail : "",
    sourceKind: validSourceKind(value.sourceKind) ? value.sourceKind : "user",
    sourceId: typeof value.sourceId === "string" ? value.sourceId : null,
    genre: typeof value.genre === "string" ? value.genre : "",
    format: typeof value.format === "string" ? value.format : "Story",
    archivedAt: typeof value.archivedAt === "string" && value.archivedAt.trim() ? value.archivedAt : null,
  };
}

function normalizeRegistry(value, profileId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (value.version !== PROJECT_LIBRARY_VERSION || value.profileId !== profileId) return null;
  const projects = Array.isArray(value.projects)
    ? value.projects.map(normalizeSummary).filter(Boolean).filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    : [];
  const requestedActiveProjectId = typeof value.activeProjectId === "string" ? value.activeProjectId : null;
  const activeProjectId = requestedActiveProjectId && projects.some((item) => item.id === requestedActiveProjectId && !item.archivedAt)
    ? requestedActiveProjectId
    : projects.find((item) => !item.archivedAt)?.id ?? null;
  return {
    version: PROJECT_LIBRARY_VERSION,
    profileId,
    activeProjectId,
    projects,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

function projectEntry(value, profileId, projectId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (value.version !== PROJECT_LIBRARY_VERSION || value.profileId !== profileId || value.projectId !== projectId) return null;
  if (!value.project || typeof value.project !== "object" || Array.isArray(value.project)) return null;
  return value;
}

function describeProject(project, describe, options = {}) {
  const detail = typeof describe === "function" ? describe(project) || {} : {};
  return normalizeSummary({
    id: requireProjectId(project.id),
    title: typeof project.title === "string" && project.title.trim() ? project.title.trim() : "Untitled Story",
    updatedAt: typeof project.updatedAt === "string" ? project.updatedAt : options.now,
    createdAt: typeof project.createdAt === "string" ? project.createdAt : options.now,
    progress: detail.progress,
    frontier: detail.frontier,
    thumbnail: detail.thumbnail,
    sourceKind: options.sourceKind,
    sourceId: options.sourceId,
    genre: options.genre,
    format: options.format,
    archivedAt: options.archivedAt,
  });
}

function writeProject(storage, profileId, project, describe, options) {
  const summary = describeProject(project, describe, options);
  const entry = {
    version: PROJECT_LIBRARY_VERSION,
    profileId,
    projectId: summary.id,
    sourceKind: summary.sourceKind,
    sourceId: summary.sourceId,
    genre: summary.genre,
    format: summary.format,
    project,
  };
  const key = projectLibraryProjectKey(profileId, summary.id);
  storage.setItem(key, JSON.stringify(entry));
  const parsed = parseJson(storage.getItem(key));
  const verified = projectEntry(parsed.value, profileId, summary.id);
  if (!verified) throw new Error(`Project Library could not verify the saved project snapshot${parsed.error ? `: ${parsed.error}` : "."}`);
  return summary;
}

function writeRegistry(storage, registry) {
  const key = projectLibraryRegistryKey(registry.profileId);
  storage.setItem(key, JSON.stringify(registry));
  const parsed = parseJson(storage.getItem(key));
  const verified = normalizeRegistry(parsed.value, registry.profileId);
  if (!verified || verified.activeProjectId !== registry.activeProjectId) {
    throw new Error(`Project Library could not verify its saved registry${parsed.error ? `: ${parsed.error}` : "."}`);
  }
  return verified;
}

function readProject(storage, profileId, projectId, normalizeProject, now) {
  const key = projectLibraryProjectKey(profileId, projectId);
  const raw = storage.getItem(key);
  const parsed = parseJson(raw);
  const entry = projectEntry(parsed.value, profileId, projectId);
  if (!entry) {
    if (raw) quarantine(storage, key, raw, now, parsed.error ? `corrupt-project-entry: ${parsed.error}` : "corrupt-project-entry");
    return null;
  }
  try {
    const project = normalizeProject(entry.project);
    return { project, entry };
  } catch (error) {
    quarantine(storage, key, raw, now, `incompatible-project-snapshot: ${errorMessage(error)}`);
    return null;
  }
}

function storedProfileProjectIds(storage, profileId, now, quarantined) {
  if (!Number.isInteger(storage.length) || typeof storage.key !== "function") return [];
  const prefix = `plotpickle.library.profile.v1.${profileId}.projects.`;
  const ids = [];
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (!key?.startsWith(prefix) || key.includes(".quarantine.")) continue;
    try {
      ids.push(decodeURIComponent(key.slice(prefix.length)));
    } catch (error) {
      const quarantineKey = quarantine(storage, key, storage.getItem(key), now, `malformed-project-key: ${errorMessage(error)}`);
      if (quarantineKey) quarantined.push(quarantineKey);
    }
  }
  return ids;
}

function newProject(createProject, now, idFactory) {
  return createProject({ id: idFactory(), now, title: "Untitled Story" });
}

function createRegistry(profileId, summary, now) {
  return {
    version: PROJECT_LIBRARY_VERSION,
    profileId,
    activeProjectId: summary.id,
    projects: [summary],
    updatedAt: now,
  };
}

function activeSummaries(registry) {
  return registry.projects.filter((item) => !item.archivedAt);
}

export function resolveProjectLibraryProfileId(storage) {
  requireStorage(storage);
  const stored = storage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY);
  try {
    const profileId = normalizeProjectLibraryProfileId(stored || DEFAULT_LOCAL_PROFILE_ID);
    if (!stored) storage.setItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, profileId);
    return profileId;
  } catch {
    storage.removeItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY);
    storage.setItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, DEFAULT_LOCAL_PROFILE_ID);
    return DEFAULT_LOCAL_PROFILE_ID;
  }
}

export function initializeProfileProjectLibrary(input) {
  const storage = requireStorage(input.storage);
  const profileId = normalizeProjectLibraryProfileId(input.profileId);
  const now = input.now();
  const registryKey = projectLibraryRegistryKey(profileId);
  const rawRegistry = storage.getItem(registryKey);
  const parsedRegistry = parseJson(rawRegistry);
  let registry = normalizeRegistry(parsedRegistry.value, profileId);
  const quarantined = [];

  if (!registry && rawRegistry) {
    const reason = parsedRegistry.error ? `corrupt-profile-registry: ${parsedRegistry.error}` : "corrupt-profile-registry";
    const key = quarantine(storage, registryKey, rawRegistry, now, reason);
    if (key) quarantined.push(key);
  }

  if (registry) {
    const available = activeSummaries(registry);
    if (!available.length && registry.projects.length) {
      registry = writeRegistry(storage, { ...registry, activeProjectId: null, updatedAt: registry.updatedAt || now });
      return { registry, activeProject: null, migrated: false, quarantined };
    }

    const orderedIds = [registry.activeProjectId, ...available.map((item) => item.id)].filter(Boolean);
    for (const projectId of [...new Set(orderedIds)]) {
      const loaded = readProject(storage, profileId, projectId, input.normalizeProject, now);
      if (!loaded) continue;
      const priorSummary = registry.projects.find((item) => item.id === projectId);
      const summary = describeProject(loaded.project, input.describeProject, {
        ...loaded.entry,
        now,
        sourceKind: loaded.entry.sourceKind,
        archivedAt: priorSummary?.archivedAt ?? null,
      });
      registry = writeRegistry(storage, {
        ...registry,
        activeProjectId: projectId,
        projects: [summary, ...registry.projects.filter((item) => item.id !== projectId)],
        updatedAt: now,
      });
      return { registry, activeProject: loaded.project, migrated: false, quarantined };
    }
  }

  const archivedIds = new Set(registry?.projects.filter((item) => item.archivedAt).map((item) => item.id) ?? []);
  for (const projectId of storedProfileProjectIds(storage, profileId, now, quarantined)) {
    if (archivedIds.has(projectId)) continue;
    const loaded = readProject(storage, profileId, projectId, input.normalizeProject, now);
    if (!loaded) continue;
    const summary = describeProject(loaded.project, input.describeProject, {
      now,
      sourceKind: loaded.entry.sourceKind,
      sourceId: loaded.entry.sourceId,
      genre: loaded.entry.genre,
      format: loaded.entry.format,
      archivedAt: null,
    });
    registry = writeRegistry(storage, createRegistry(profileId, summary, now));
    return { registry, activeProject: loaded.project, migrated: false, quarantined };
  }

  const legacyRaw = storage.getItem(LEGACY_ACTIVE_PROJECT_KEY);
  let project = null;
  let migrated = false;
  if (legacyRaw) {
    const parsed = parseJson(legacyRaw);
    if (parsed.value) {
      try {
        project = input.normalizeProject(parsed.value);
        migrated = true;
      } catch {
        project = null;
      }
    }
    if (!project) {
      const reason = parsed.error ? `unreadable-legacy-project: ${parsed.error}` : "unreadable-legacy-project";
      const key = quarantine(storage, LEGACY_ACTIVE_PROJECT_KEY, legacyRaw, now, reason);
      if (key) quarantined.push(key);
    }
  }

  project ||= newProject(input.createProject, now, input.idFactory);
  const summary = writeProject(storage, profileId, project, input.describeProject, {
    now,
    sourceKind: migrated ? "migrated" : "user",
    sourceId: migrated ? "legacy-active-project" : null,
    genre: "",
    format: "Story",
    archivedAt: null,
  });
  registry = writeRegistry(storage, createRegistry(profileId, summary, now));
  if (migrated) {
    storage.setItem(projectLibraryMigrationKey(profileId), JSON.stringify({
      version: 1,
      profileId,
      source: LEGACY_ACTIVE_PROJECT_KEY,
      projectId: summary.id,
      migratedAt: now,
      verified: true,
    }));
    storage.removeItem(LEGACY_ACTIVE_PROJECT_KEY);
  }
  return { registry, activeProject: project, migrated, quarantined };
}

export function saveProfileActiveProject(input) {
  const initialized = initializeProfileProjectLibrary(input);
  const storage = requireStorage(input.storage);
  const profileId = normalizeProjectLibraryProfileId(input.profileId);
  const now = input.now();
  const project = input.normalizeProject(input.project);
  const prior = initialized.registry.projects.find((item) => item.id === project.id);
  if (prior?.archivedAt) throw new Error("Archived stories must be restored to Library before they can be edited.");
  const summary = writeProject(storage, profileId, project, input.describeProject, {
    now,
    sourceKind: input.sourceKind || prior?.sourceKind || "user",
    sourceId: input.sourceId ?? prior?.sourceId ?? null,
    genre: input.genre ?? prior?.genre ?? "",
    format: input.format ?? prior?.format ?? "Story",
    archivedAt: null,
  });
  const registry = writeRegistry(storage, {
    ...initialized.registry,
    activeProjectId: summary.id,
    projects: [summary, ...initialized.registry.projects.filter((item) => item.id !== summary.id)],
    updatedAt: now,
  });
  return { registry, activeProject: project };
}

export function switchProfileActiveProject(input) {
  const initialized = initializeProfileProjectLibrary(input);
  if (initialized.activeProject) saveProfileActiveProject({ ...input, project: initialized.activeProject });
  const now = input.now();
  const projectId = requireProjectId(input.projectId);
  const summary = initialized.registry.projects.find((item) => item.id === projectId);
  if (summary?.archivedAt) throw new Error("Restore this story from Archive before opening it.");
  const target = readProject(input.storage, input.profileId, projectId, input.normalizeProject, now);
  if (!target) throw new Error("The selected story is unavailable. Its recoverable snapshot was quarantined.");
  const refreshed = normalizeRegistry(parseJson(input.storage.getItem(projectLibraryRegistryKey(input.profileId))).value, input.profileId)
    ?? initialized.registry;
  const registry = writeRegistry(input.storage, {
    ...refreshed,
    activeProjectId: target.project.id,
    projects: [
      refreshed.projects.find((item) => item.id === target.project.id),
      ...refreshed.projects.filter((item) => item.id !== target.project.id),
    ].filter(Boolean),
    updatedAt: now,
  });
  return { registry, activeProject: target.project };
}

export function createProfileUserProject(input) {
  const initialized = initializeProfileProjectLibrary(input);
  if (initialized.activeProject) saveProfileActiveProject({ ...input, project: initialized.activeProject });
  const now = input.now();
  const project = input.createProject({
    id: input.idFactory(),
    now,
    title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : "Untitled Story",
  });
  return saveProfileActiveProject({
    ...input,
    project,
    sourceKind: "user",
    sourceId: null,
    genre: typeof input.genre === "string" ? input.genre : "",
    format: typeof input.format === "string" && input.format.trim() ? input.format.trim() : "Story",
  });
}

export function createProfileWorkingCopy(input) {
  const initialized = initializeProfileProjectLibrary(input);
  if (initialized.activeProject) saveProfileActiveProject({ ...input, project: initialized.activeProject });
  const now = input.now();
  const source = input.normalizeProject(structuredClone(input.sourceProject));
  const project = input.normalizeProject({
    ...source,
    id: input.idFactory(),
    title: input.title || source.title,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    creativeRoom: { threadId: null },
  });
  return saveProfileActiveProject({
    ...input,
    project,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    genre: input.genre,
    format: input.format,
  });
}

export function archiveProfileProject(input) {
  const initialized = initializeProfileProjectLibrary(input);
  const now = input.now();
  const projectId = requireProjectId(input.projectId);
  const target = initialized.registry.projects.find((item) => item.id === projectId);
  if (!target) throw new Error("The selected story is not in this Library.");
  if (target.archivedAt) return { registry: initialized.registry, activeProject: initialized.activeProject };

  const projects = initialized.registry.projects.map((item) => (
    item.id === projectId ? { ...item, archivedAt: now } : item
  ));
  const nextActiveProjectId = initialized.registry.activeProjectId === projectId
    ? projects.find((item) => !item.archivedAt)?.id ?? null
    : initialized.registry.activeProjectId;
  const registry = writeRegistry(input.storage, {
    ...initialized.registry,
    activeProjectId: nextActiveProjectId,
    projects,
    updatedAt: now,
  });
  const loaded = nextActiveProjectId
    ? readProject(input.storage, input.profileId, nextActiveProjectId, input.normalizeProject, now)
    : null;
  return { registry, activeProject: loaded?.project ?? null };
}

export function restoreProfileProject(input) {
  const initialized = initializeProfileProjectLibrary(input);
  const now = input.now();
  const projectId = requireProjectId(input.projectId);
  const target = initialized.registry.projects.find((item) => item.id === projectId);
  if (!target) throw new Error("The selected archived story is not in this Library.");
  if (!target.archivedAt) return { registry: initialized.registry, activeProject: initialized.activeProject };
  const loaded = readProject(input.storage, input.profileId, projectId, input.normalizeProject, now);
  if (!loaded) throw new Error("The archived story snapshot is unavailable. Its recoverable data was quarantined.");

  const restored = { ...target, archivedAt: null };
  const activeProjectId = initialized.registry.activeProjectId || restored.id;
  const registry = writeRegistry(input.storage, {
    ...initialized.registry,
    activeProjectId,
    projects: [restored, ...initialized.registry.projects.filter((item) => item.id !== restored.id)],
    updatedAt: now,
  });
  return {
    registry,
    activeProject: activeProjectId === restored.id ? loaded.project : initialized.activeProject,
  };
}

export function listProfileProjectSummaries(input) {
  return activeSummaries(initializeProfileProjectLibrary(input).registry);
}

export function listProfileArchivedProjectSummaries(input) {
  return initializeProfileProjectLibrary(input).registry.projects.filter((item) => item.archivedAt);
}
