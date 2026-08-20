import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

export const PROFILE_PRIVATE_STORAGE_VERSION = 1;
export const PROFILE_PRIVATE_OBJECT_FORMAT = "plotpickle-profile-private-object";
export const NODE_SECRET_FORMAT = "plotpickle-node-secret";

const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,127}$/i;
const OBJECT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,239}$/i;
const CREDENTIAL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*\.json$/;
const PROFILE_DOMAINS = new Set(["projects", "library", "memory", "indexes", "assets", "buzz", "credentials", "settings", "cache"]);
const PROFILE_DIRECTORIES = Object.freeze(["vault", ...PROFILE_DOMAINS]);
const MAX_STRUCTURED_BYTES = 16 * 1024 * 1024;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

function fail(message, code = "PROFILE_STORAGE_REJECTED", cause) {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.code = code;
  throw error;
}

function requireAbsoluteRoot(root) {
  if (typeof root !== "string" || !path.isAbsolute(root)) fail("PlotPickle storage root must be an absolute path.", "INVALID_STORAGE_CONTRACT");
  return path.resolve(root);
}

export function normalizeProfileStorageId(value) {
  const profileId = typeof value === "string" ? value.trim() : "";
  if (!PROFILE_ID_PATTERN.test(profileId)) fail("Profile storage requires a valid opaque profile id.", "INVALID_PROFILE_ID");
  return profileId;
}

function normalizeObjectId(value, label = "Object") {
  const objectId = typeof value === "string" ? value.trim() : "";
  if (!OBJECT_ID_PATTERN.test(objectId) || objectId === "." || objectId === "..") fail(`${label} id is invalid.`, "INVALID_OBJECT_ID");
  return objectId;
}

function normalizeCredentialName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!CREDENTIAL_NAME_PATTERN.test(name)) fail("Profile credential name is invalid.", "INVALID_CREDENTIAL_NAME");
  return name;
}

function normalizeDomain(value) {
  if (!PROFILE_DOMAINS.has(value)) fail("Profile storage domain is not allowlisted.", "INVALID_STORAGE_DOMAIN");
  return value;
}

function contained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function fixedPath(root, ...segments) {
  const candidate = path.resolve(root, ...segments);
  if (!contained(root, candidate)) fail("Profile storage path escaped its fixed root.", "PATH_ESCAPE_REJECTED");
  return candidate;
}

async function ensureDirectoryChain(root, segments) {
  let current = root;
  await mkdir(root, { recursive: true, mode: 0o700 });
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) fail("PlotPickle storage root must be a real directory.", "SYMLINK_ESCAPE_REJECTED");
  for (const segment of segments) {
    current = fixedPath(root, path.relative(root, current), segment);
    try {
      const information = await lstat(current);
      if (information.isSymbolicLink() || !information.isDirectory()) fail("Profile storage directory cannot be a symbolic link.", "SYMLINK_ESCAPE_REJECTED");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await mkdir(current, { mode: 0o700 });
      const information = await lstat(current);
      if (information.isSymbolicLink() || !information.isDirectory()) fail("Profile storage directory creation was redirected.", "SYMLINK_ESCAPE_REJECTED");
    }
  }
  return current;
}

async function assertRegularFile(filePath) {
  const information = await lstat(filePath);
  if (information.isSymbolicLink() || !information.isFile()) fail("Profile storage object is not a regular file.", "SYMLINK_ESCAPE_REJECTED");
  return information;
}

export function profileStoragePaths(root, candidateProfileId) {
  const home = requireAbsoluteRoot(root);
  const profileId = normalizeProfileStorageId(candidateProfileId);
  const profileRoot = fixedPath(home, "profiles", profileId);
  return Object.freeze({
    home,
    profileId,
    profileRoot,
    vault: fixedPath(profileRoot, "vault"),
    projects: fixedPath(profileRoot, "projects"),
    library: fixedPath(profileRoot, "library"),
    memory: fixedPath(profileRoot, "memory"),
    indexes: fixedPath(profileRoot, "indexes"),
    assets: fixedPath(profileRoot, "assets"),
    buzz: fixedPath(profileRoot, "buzz"),
    credentials: fixedPath(profileRoot, "credentials"),
    settings: fixedPath(profileRoot, "settings"),
    cache: fixedPath(profileRoot, "cache"),
  });
}

export function nodeStoragePaths(root) {
  const home = requireAbsoluteRoot(root);
  const nodeRoot = fixedPath(home, "node");
  return Object.freeze({
    home,
    nodeRoot,
    identity: fixedPath(nodeRoot, "identity"),
    runtime: fixedPath(nodeRoot, "runtime"),
    secrets: fixedPath(nodeRoot, "secrets"),
  });
}

function encodedObject(value) {
  let serialized;
  try {
    serialized = `${JSON.stringify(value)}\n`;
  } catch (error) {
    fail("Profile storage accepts only JSON-serializable structured values.", "INVALID_STRUCTURED_VALUE", error);
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_STRUCTURED_BYTES) fail("Structured profile object exceeds the bounded encrypted-object limit.", "PROFILE_OBJECT_TOO_LARGE");
  return textEncoder.encode(serialized);
}

function decodedObject(bytes) {
  try {
    return JSON.parse(textDecoder.decode(bytes));
  } catch (error) {
    fail("Encrypted profile object is not valid structured JSON.", "PROFILE_OBJECT_CORRUPT", error);
  }
}

function objectSecretId(domain, objectId) {
  return `profile-storage:v${PROFILE_PRIVATE_STORAGE_VERSION}:${domain}:${objectId}`;
}

function parsePrivateRecord(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Profile object record is invalid.", "PROFILE_OBJECT_CORRUPT");
  const keys = Object.keys(value).sort();
  const expectedKeys = ["domain", "envelope", "format", "objectId", "profileId", "version"].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)
    || value.format !== PROFILE_PRIVATE_OBJECT_FORMAT
    || value.version !== PROFILE_PRIVATE_STORAGE_VERSION
    || value.profileId !== expected.profileId
    || value.domain !== expected.domain
    || value.objectId !== expected.objectId) fail("Profile object ownership metadata does not match its authoritative path.", "PROFILE_OBJECT_CORRUPT");
  return value;
}

async function syncDirectory(directory) {
  let handle;
  try {
    handle = await open(directory, "r");
    await handle.sync();
  } catch (error) {
    const code = error?.code || "";
    if (!new Set(["EACCES", "EPERM", "EISDIR", "EINVAL", "ENOSYS", "ENOTSUP"]).has(code)) throw error;
    return false;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function atomicWrite(filePath, serialized, verify) {
  const directory = path.dirname(filePath);
  const temporary = fixedPath(directory, `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  const previous = `${filePath}.previous`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(serialized, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await verify(temporary);
    try {
      await assertRegularFile(filePath);
      await rm(previous, { force: true });
      await rename(filePath, previous);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await rename(temporary, filePath);
    try { await chmod(filePath, 0o600); } catch (error) {
      const code = error?.code || "";
      if (!new Set(["EACCES", "EPERM", "ENOSYS", "ENOTSUP", "EINVAL"]).has(code)) throw error;
    }
    await syncDirectory(directory);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function quarantine(filePath, source, reason) {
  const digest = createHash("sha256").update(source).digest("hex").slice(0, 16);
  const target = `${filePath}.quarantine.${reason}.${digest}`;
  try {
    await rename(filePath, target);
    return target;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function projectSummary(project, supplied, now) {
  const title = typeof supplied?.title === "string" && supplied.title.trim()
    ? supplied.title.trim()
    : typeof project?.title === "string" && project.title.trim()
      ? project.title.trim()
      : "Untitled Story";
  return Object.freeze({
    projectId: normalizeObjectId(project?.id, "Project"),
    title,
    updatedAt: typeof supplied?.updatedAt === "string" ? supplied.updatedAt : typeof project?.updatedAt === "string" ? project.updatedAt : now,
    createdAt: typeof supplied?.createdAt === "string" ? supplied.createdAt : typeof project?.createdAt === "string" ? project.createdAt : now,
    progress: Number.isFinite(supplied?.progress) ? Math.max(0, Math.min(100, Math.round(supplied.progress))) : 0,
    frontier: typeof supplied?.frontier === "string" && supplied.frontier.trim() ? supplied.frontier.trim() : "Foundations",
    thumbnailRef: typeof supplied?.thumbnailRef === "string" ? supplied.thumbnailRef : "",
  });
}

function emptyLibrary(profileId, now) {
  return { version: 1, profileId, activeProjectId: null, projects: [], updatedAt: now };
}

function normalizeLibrary(value, profileId) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1 || value.profileId !== profileId || !Array.isArray(value.projects)) {
    fail("Profile Library registry is invalid.", "PROFILE_LIBRARY_CORRUPT");
  }
  const projects = value.projects.map((item) => projectSummary({ id: item?.projectId }, item, item?.updatedAt || ""));
  if (new Set(projects.map((item) => item.projectId)).size !== projects.length) fail("Profile Library contains duplicate project ids.", "PROFILE_LIBRARY_CORRUPT");
  const activeProjectId = value.activeProjectId === null ? null : normalizeObjectId(value.activeProjectId, "Project");
  if (activeProjectId !== null && !projects.some((item) => item.projectId === activeProjectId)) fail("Profile Library active project is unavailable.", "PROFILE_LIBRARY_CORRUPT");
  return { version: 1, profileId, activeProjectId, projects, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "" };
}

export function createProfilePrivateStorageService(options) {
  const home = requireAbsoluteRoot(options?.root);
  if (!options?.authService || typeof options.authService.createProfileVaultCapability !== "function"
    || typeof options.authService.registerVaultCleanupHook !== "function" || typeof options.authService.resolveSession !== "function") {
    fail("Profile-private storage requires the canonical PlotPickle Auth service.", "INVALID_STORAGE_CONTRACT");
  }
  const now = typeof options.now === "function" ? options.now : () => new Date().toISOString();
  const activeProjects = new Map();
  const mutationQueues = new Map();

  const cleanup = options.authService.registerVaultCleanupHook((event) => {
    for (const [sessionId, active] of activeProjects) {
      if (active.profileId !== event.profileId) continue;
      try {
        options.authService.resolveSession(sessionId, { touch: false });
      } catch (error) {
        if (error?.code !== "SESSION_REJECTED") throw error;
        activeProjects.delete(sessionId);
      }
    }
  });

  const authority = async (authContext) => {
    const capability = options.authService.createProfileVaultCapability(authContext);
    const profileId = normalizeProfileStorageId(capability.profileId);
    const locations = profileStoragePaths(home, profileId);
    await ensureDirectoryChain(home, ["profiles", profileId]);
    for (const directory of PROFILE_DIRECTORIES) await ensureDirectoryChain(home, ["profiles", profileId, directory]);
    return { capability, profileId, locations, authContext };
  };

  const objectPath = (access, domain, objectId) => {
    const normalizedDomain = normalizeDomain(domain);
    const normalizedObjectId = normalizeObjectId(objectId);
    return {
      domain: normalizedDomain,
      objectId: normalizedObjectId,
      filePath: fixedPath(access.locations[normalizedDomain], `${normalizedObjectId}.json`),
    };
  };

  const readObject = async (access, domain, objectId) => {
    const target = objectPath(access, domain, objectId);
    let source;
    try {
      await assertRegularFile(target.filePath);
      source = await readFile(target.filePath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
    try {
      const record = parsePrivateRecord(JSON.parse(source), { profileId: access.profileId, ...target });
      const clear = await access.capability.unwrapSecret({ envelope: record.envelope, secretId: objectSecretId(target.domain, target.objectId) });
      try {
        return decodedObject(clear);
      } finally {
        clear.fill(0);
      }
    } catch (error) {
      await quarantine(target.filePath, source, "invalid").catch(() => undefined);
      fail("Profile object could not be verified and was quarantined without replacement.", "PROFILE_OBJECT_CORRUPT", error);
    }
  };

  const writeObject = async (access, domain, objectId, value) => {
    const target = objectPath(access, domain, objectId);
    const clear = encodedObject(value);
    let envelope;
    try {
      envelope = await access.capability.wrapSecret({ secretId: objectSecretId(target.domain, target.objectId), secret: clear });
    } finally {
      clear.fill(0);
    }
    const record = {
      format: PROFILE_PRIVATE_OBJECT_FORMAT,
      version: PROFILE_PRIVATE_STORAGE_VERSION,
      profileId: access.profileId,
      domain: target.domain,
      objectId: target.objectId,
      envelope,
    };
    const serialized = `${JSON.stringify(record, null, 2)}\n`;
    await atomicWrite(target.filePath, serialized, async (candidate) => {
      const parsed = parsePrivateRecord(JSON.parse(await readFile(candidate, "utf8")), { profileId: access.profileId, ...target });
      const verified = await access.capability.unwrapSecret({ envelope: parsed.envelope, secretId: objectSecretId(target.domain, target.objectId) });
      try { decodedObject(verified); } finally { verified.fill(0); }
    });
    return value;
  };

  const serialize = (profileId, operation) => {
    const previous = mutationQueues.get(profileId) || Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    mutationQueues.set(profileId, current);
    return current.finally(() => {
      if (mutationQueues.get(profileId) === current) mutationQueues.delete(profileId);
    });
  };

  const withMutation = async (authContext, operation) => {
    const access = await authority(authContext);
    return serialize(access.profileId, () => operation(access));
  };

  const readLibrary = async (access) => {
    const stored = await readObject(access, "library", "registry");
    return stored === null ? emptyLibrary(access.profileId, now()) : normalizeLibrary(stored, access.profileId);
  };

  const writeLibrary = (access, value) => writeObject(access, "library", "registry", normalizeLibrary(value, access.profileId));

  const saveProjectInternal = async (access, input) => {
    const project = typeof options.normalizeProject === "function" ? options.normalizeProject(input.project) : structuredClone(input.project);
    if (!project || typeof project !== "object" || Array.isArray(project)) fail("Profile project is invalid.", "INVALID_PROJECT");
    const summary = projectSummary(project, input.summary, now());
    const library = await readLibrary(access);
    await writeObject(access, "projects", summary.projectId, project);
    const next = {
      ...library,
      activeProjectId: input.activate === false ? library.activeProjectId : summary.projectId,
      projects: [summary, ...library.projects.filter((item) => item.projectId !== summary.projectId)],
      updatedAt: now(),
    };
    await writeLibrary(access, next);
    if (input.activate !== false) activeProjects.set(access.authContext.sessionId, { profileId: access.profileId, projectId: summary.projectId });
    return { project, summary, library: next };
  };

  const service = {
    async initializeProfile(authContext) {
      const access = await authority(authContext);
      return Object.freeze({ profileId: access.profileId, paths: profileStoragePaths(home, access.profileId) });
    },
    async readPrivateJson(authContext, input) {
      const access = await authority(authContext);
      return readObject(access, input.domain, input.objectId);
    },
    async writePrivateJson(authContext, input) {
      return withMutation(authContext, (access) => writeObject(access, input.domain, input.objectId, input.value));
    },
    async saveProject(authContext, input) {
      return withMutation(authContext, (access) => saveProjectInternal(access, input));
    },
    async loadProject(authContext, projectId) {
      const access = await authority(authContext);
      const project = await readObject(access, "projects", normalizeObjectId(projectId, "Project"));
      return project === null || typeof options.normalizeProject !== "function" ? project : options.normalizeProject(project);
    },
    async listProjects(authContext) {
      const access = await authority(authContext);
      return Object.freeze((await readLibrary(access)).projects.map((item) => Object.freeze({ ...item })));
    },
    async activateProject(authContext, projectId) {
      return withMutation(authContext, async (access) => {
        const normalizedProjectId = normalizeObjectId(projectId, "Project");
        if (await readObject(access, "projects", normalizedProjectId) === null) fail("Project is unavailable for this Human profile.", "PROJECT_NOT_FOUND");
        const library = await readLibrary(access);
        if (!library.projects.some((item) => item.projectId === normalizedProjectId)) fail("Project is unavailable for this Human profile.", "PROJECT_NOT_FOUND");
        await writeLibrary(access, { ...library, activeProjectId: normalizedProjectId, updatedAt: now() });
        activeProjects.set(authContext.sessionId, { profileId: access.profileId, projectId: normalizedProjectId });
        return normalizedProjectId;
      });
    },
    async loadActiveProject(authContext) {
      const access = await authority(authContext);
      const active = activeProjects.get(authContext.sessionId);
      if (!active || active.profileId !== access.profileId) return null;
      const project = await readObject(access, "projects", active.projectId);
      return project === null || typeof options.normalizeProject !== "function" ? project : options.normalizeProject(project);
    },
    async writeCredential(authContext, name, value) {
      return withMutation(authContext, (access) => writeObject(access, "credentials", normalizeCredentialName(name).slice(0, -5), value));
    },
    async readCredential(authContext, name) {
      const access = await authority(authContext);
      return readObject(access, "credentials", normalizeCredentialName(name).slice(0, -5));
    },
    async exportProject(authContext, projectId) {
      const access = await authority(authContext);
      const normalizedProjectId = normalizeObjectId(projectId, "Project");
      const project = await readObject(access, "projects", normalizedProjectId);
      if (project === null) fail("Project is unavailable for explicit export.", "PROJECT_NOT_FOUND");
      return Object.freeze({ format: "plotpickle-explicit-project-export", version: 1, ownerProfileId: access.profileId, project: structuredClone(project), exportedAt: now() });
    },
    async migrateLegacyProfile(authContext, source) {
      return withMutation(authContext, async (access) => {
        if (!source || typeof source !== "object" || typeof source.setReadOnly !== "function" || typeof source.createSnapshot !== "function"
          || typeof source.listProjects !== "function" || typeof source.listCredentials !== "function") fail("Legacy migration source contract is invalid.", "INVALID_MIGRATION_SOURCE");
        const sourceId = normalizeObjectId(source.sourceId, "Migration source");
        const journalId = `migration-${sourceId}`;
        let journal = await readObject(access, "settings", journalId);
        if (journal?.complete === true) return Object.freeze({ sourceId, resumed: true, complete: true, projectCount: journal.projectIds.length, credentialCount: journal.credentialNames.length, snapshotId: journal.snapshotId });
        const resumed = journal !== null;
        await source.setReadOnly(true);
        const projects = await source.listProjects();
        const credentials = await source.listCredentials();
        if (!Array.isArray(projects) || !Array.isArray(credentials)) fail("Legacy migration inventory is invalid.", "INVALID_MIGRATION_SOURCE");
        const projectIds = projects.map((item) => normalizeObjectId(item?.id, "Project"));
        const credentialNames = credentials.map((item) => normalizeCredentialName(item?.name));
        if (new Set(projectIds).size !== projectIds.length || new Set(credentialNames).size !== credentialNames.length) fail("Legacy migration inventory contains duplicate ids.", "INVALID_MIGRATION_SOURCE");
        if (!journal) {
          const snapshotId = normalizeObjectId(await source.createSnapshot(), "Migration snapshot");
          journal = { version: 1, profileId: access.profileId, sourceId, snapshotId, projectIds, credentialNames, migratedProjects: [], migratedCredentials: [], complete: false, startedAt: now(), completedAt: null };
          await writeObject(access, "settings", journalId, journal);
        } else if (JSON.stringify(journal.projectIds) !== JSON.stringify(projectIds) || JSON.stringify(journal.credentialNames) !== JSON.stringify(credentialNames)) {
          fail("Legacy migration inventory changed after the source became read-only.", "MIGRATION_SOURCE_CHANGED");
        }
        const log = (event) => options.migrationLog?.(Object.freeze({ profileId: access.profileId, sourceId, ...event }));
        for (const item of projects) {
          const projectId = normalizeObjectId(item.id, "Project");
          if (journal.migratedProjects.includes(projectId)) continue;
          try {
            if (!item.value || typeof item.value !== "object" || item.value.id !== projectId) fail("Legacy project id does not match its canonical project value.", "INVALID_MIGRATION_SOURCE");
            await saveProjectInternal(access, { project: item.value, summary: item.summary, activate: false });
            const verified = await readObject(access, "projects", projectId);
            if (verified === null) fail("Migrated project verification failed.", "MIGRATION_VERIFY_FAILED");
            journal = { ...journal, migratedProjects: [...journal.migratedProjects, projectId] };
            await writeObject(access, "settings", journalId, journal);
            log({ event: "project-migrated", recordId: projectId });
          } catch (error) {
            log({ event: "migration-failed", recordId: projectId, stage: "project" });
            throw error;
          }
        }
        for (const item of credentials) {
          const name = normalizeCredentialName(item.name);
          if (journal.migratedCredentials.includes(name)) continue;
          try {
            await writeObject(access, "credentials", name.slice(0, -5), item.value);
            if (await readObject(access, "credentials", name.slice(0, -5)) === null) fail("Migrated credential verification failed.", "MIGRATION_VERIFY_FAILED");
            journal = { ...journal, migratedCredentials: [...journal.migratedCredentials, name] };
            await writeObject(access, "settings", journalId, journal);
            log({ event: "credential-migrated", recordId: name });
          } catch (error) {
            log({ event: "migration-failed", recordId: name, stage: "credential" });
            throw error;
          }
        }
        journal = { ...journal, complete: true, completedAt: now() };
        await writeObject(access, "settings", journalId, journal);
        await source.complete?.({ profileId: access.profileId, snapshotId: journal.snapshotId });
        log({ event: "migration-complete", projectCount: projectIds.length, credentialCount: credentialNames.length });
        return Object.freeze({ sourceId, resumed, complete: true, projectCount: projectIds.length, credentialCount: credentialNames.length, snapshotId: journal.snapshotId });
      });
    },
    close() {
      activeProjects.clear();
      cleanup();
    },
  };
  return Object.freeze(service);
}

export function createNodeSecretStore(options) {
  const locations = nodeStoragePaths(options?.root);
  const protector = options?.protector;
  if (!protector || typeof protector.protection !== "string" || !protector.protection.trim()
    || typeof protector.protect !== "function" || typeof protector.unprotect !== "function") {
    fail("NodeSecretStore requires an explicit operator-managed protection adapter.", "INVALID_NODE_SECRET_CONTRACT");
  }

  const secretPath = (name) => fixedPath(locations.secrets, normalizeCredentialName(name));
  const prepare = () => ensureDirectoryChain(locations.home, ["node", "secrets"]);

  return Object.freeze({
    scope: "node",
    protection: protector.protection,
    path: locations.secrets,
    async write(name, value) {
      await prepare();
      const safeName = normalizeCredentialName(name);
      const clear = encodedObject(value);
      let protectedValue;
      try { protectedValue = await protector.protect({ name: safeName, clear }); } finally { clear.fill(0); }
      const record = { format: NODE_SECRET_FORMAT, version: 1, scope: "node", name: safeName, protection: protector.protection, protected: protectedValue };
      const serialized = `${JSON.stringify(record, null, 2)}\n`;
      await atomicWrite(secretPath(safeName), serialized, async (candidate) => {
        const parsed = JSON.parse(await readFile(candidate, "utf8"));
        if (parsed.format !== NODE_SECRET_FORMAT || parsed.scope !== "node" || parsed.name !== safeName || parsed.protection !== protector.protection) fail("Node secret record failed verification.", "NODE_SECRET_CORRUPT");
        const cleartext = await protector.unprotect({ name: safeName, protected: parsed.protected });
        try { decodedObject(cleartext); } finally { cleartext.fill(0); }
      });
    },
    async read(name) {
      await prepare();
      const safeName = normalizeCredentialName(name);
      let source;
      try {
        await assertRegularFile(secretPath(safeName));
        source = await readFile(secretPath(safeName), "utf8");
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw error;
      }
      try {
        const parsed = JSON.parse(source);
        if (parsed.format !== NODE_SECRET_FORMAT || parsed.version !== 1 || parsed.scope !== "node" || parsed.name !== safeName || parsed.protection !== protector.protection) fail("Node secret record is invalid.", "NODE_SECRET_CORRUPT");
        const clear = await protector.unprotect({ name: safeName, protected: parsed.protected });
        try { return decodedObject(clear); } finally { clear.fill(0); }
      } catch (error) {
        await quarantine(secretPath(safeName), source, "invalid").catch(() => undefined);
        fail("Node secret could not be verified and was quarantined.", "NODE_SECRET_CORRUPT", error);
      }
    },
    async remove(name) {
      await prepare();
      await rm(secretPath(name), { force: true });
    },
    async inventory() {
      await prepare();
      const entries = await readdir(locations.secrets, { withFileTypes: true });
      return Object.freeze(entries.filter((entry) => entry.isFile() && CREDENTIAL_NAME_PATTERN.test(entry.name)).map((entry) => entry.name).sort());
    },
  });
}
