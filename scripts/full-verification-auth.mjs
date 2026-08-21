import { createHash, randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const AUTH_MODE = "synthetic-human";
const SYNTHETIC_ROOT_SEGMENTS = ["PlotPickle", "full-verification", "synthetic-humans"];

function localDataRoot(env = process.env, platform = process.platform) {
  if (env.LOCALAPPDATA) return env.LOCALAPPDATA;
  if (platform === "win32") return path.join(os.homedir(), "AppData", "Local");
  return env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "share");
}

function opaqueJobRef(jobId) {
  return createHash("sha256").update(String(jobId || "verification-job")).digest("hex").slice(0, 24);
}

export function verificationSyntheticRoot(options = {}) {
  return path.join(localDataRoot(options.env, options.platform), ...SYNTHETIC_ROOT_SEGMENTS);
}

export function verificationSyntheticHome(jobId, options = {}) {
  return path.join(verificationSyntheticRoot(options), `fv-${opaqueJobRef(jobId)}`);
}

export function verificationSyntheticRuntime(jobId, options = {}) {
  const home = verificationSyntheticHome(jobId, options);
  return Object.freeze({
    home,
    runtimeEnv: Object.freeze({
      PLOTPICKLE_HOME: home,
      PLOTPICKLE_AUTH_STATE_PATH: path.join(home, "auth", "state.json"),
      PLOTPICKLE_ACCESS_MODE: "desktop-loopback",
      PLOTPICKLE_SERVER_NETWORK_ENABLED: "false",
      PLOTPICKLE_BIND_HOST: "",
      PLOTPICKLE_EXTERNAL_ORIGIN: "",
      PLOTPICKLE_ALLOWED_ORIGINS: "",
      PLOTPICKLE_ALLOWED_HOSTS: "",
      PLOTPICKLE_BOOTSTRAP_COMPLETE: "false",
      PLOTPICKLE_NODE_ID: `full-verification-${opaqueJobRef(jobId)}`,
    }),
  });
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function prepareVerificationSyntheticHome(home, options = {}) {
  const root = verificationSyntheticRoot(options);
  if (!isInside(root, home) || path.resolve(root) === path.resolve(home)) {
    throw new Error("Full Verification refused a synthetic Human home outside its isolated runtime root.");
  }
  await rm(home, { recursive: true, force: true });
  await mkdir(home, { recursive: true, mode: 0o700 });
  return home;
}

export async function cleanupVerificationSyntheticHome(home, options = {}) {
  if (!home) return false;
  const root = verificationSyntheticRoot(options);
  if (!isInside(root, home) || path.resolve(root) === path.resolve(home)) {
    throw new Error("Full Verification refused to clean a path outside its synthetic Human runtime root.");
  }
  await rm(home, { recursive: true, force: true });
  return true;
}

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const diagnostic = typeof body?.syntheticDiagnostic === "string" ? ` [${body.syntheticDiagnostic}]` : "";
    throw new Error(`${body?.message || `PlotPickle synthetic authentication returned HTTP ${response.status}.`}${diagnostic}`);
  }
  return body;
}

async function profileGet(baseUrl, headers, fetchImpl) {
  const response = await fetchImpl(`${baseUrl}/api/auth/profile`, {
    method: "GET",
    headers: { Accept: "application/json", ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  return readJson(response);
}

async function profilePost(baseUrl, payload, fetchImpl) {
  const response = await fetchImpl(`${baseUrl}/api/auth/profile`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: new URL(baseUrl).origin,
      "X-PlotPickle-Synthetic-Diagnostic": "profile-bootstrap-v1",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJson(response);
  return { body, setCookie: String(response.headers.get("set-cookie") || "") };
}

function sessionCookie(setCookie) {
  const first = String(setCookie || "").split(";", 1)[0].trim();
  const match = first.match(/^(ppsid)=([^;\s]+)$/u);
  if (!match) throw new Error("Full Verification login did not return the expected desktop HttpOnly session cookie.");
  return Object.freeze({ name: match[1], value: match[2], header: `${match[1]}=${match[2]}` });
}

export async function establishVerificationSyntheticHuman({ baseUrl, home, fetchImpl = fetch, now = Date.now } = {}) {
  const normalizedBaseUrl = String(baseUrl || "").replace(/\/$/, "");
  if (!/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/u.test(normalizedBaseUrl)) {
    throw new Error("Full Verification synthetic Human authentication requires an explicit loopback HTTP endpoint.");
  }
  if (!home) throw new Error("Full Verification synthetic Human authentication requires its isolated home.");

  const initial = await profileGet(normalizedBaseUrl, {}, fetchImpl);
  if (initial.configured !== false || initial.authenticated !== false || initial.accessMode !== "desktop-loopback") {
    throw new Error("Full Verification synthetic Human home was not a fresh desktop-loopback Auth boundary.");
  }

  const password = `fv-${randomBytes(32).toString("base64url")}`;
  const created = await profilePost(normalizedBaseUrl, {
    action: "create-first-profile",
    displayName: "PlotPickle Verification Human",
    password,
  }, fetchImpl);
  const profileId = String(created.body?.profile?.profileId || "");
  if (!profileId) throw new Error("Full Verification synthetic Human creation returned no profile identity.");

  const signedIn = await profilePost(normalizedBaseUrl, {
    action: "login",
    locator: profileId,
    password,
  }, fetchImpl);
  const cookie = sessionCookie(signedIn.setCookie);
  const csrfToken = String(signedIn.body?.csrfToken || "");
  if (!csrfToken) throw new Error("Full Verification synthetic Human login returned no CSRF proof.");

  const verified = await profileGet(normalizedBaseUrl, { Cookie: cookie.header }, fetchImpl);
  if (verified.authenticated !== true || verified.profile?.profileId !== profileId) {
    throw new Error("Full Verification synthetic Human session did not verify through the real profile API.");
  }

  const storageDirectory = path.join(home, "verification-browser");
  const storageStatePath = path.join(storageDirectory, "storage-state.json");
  await mkdir(storageDirectory, { recursive: true, mode: 0o700 });
  const hostname = new URL(normalizedBaseUrl).hostname.replace(/^\[|\]$/g, "");
  const storageState = {
    cookies: [{
      name: cookie.name,
      value: cookie.value,
      domain: hostname,
      path: "/",
      expires: Math.floor(Number(now()) / 1_000) + 8 * 60 * 60,
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
    }],
    origins: [],
  };
  await writeFile(storageStatePath, `${JSON.stringify(storageState)}\n`, { encoding: "utf8", mode: 0o600 });

  return Object.freeze({
    profileId,
    home,
    storageStatePath,
    environment: Object.freeze({
      PLOTPICKLE_VERIFICATION_AUTH_MODE: AUTH_MODE,
      PLOTPICKLE_VERIFICATION_AUTH_HOME: home,
      PLOTPICKLE_VERIFICATION_AUTH_COOKIE: cookie.header,
      PLOTPICKLE_VERIFICATION_AUTH_CSRF: csrfToken,
      PLOTPICKLE_VERIFICATION_STORAGE_STATE: storageStatePath,
    }),
  });
}

export function verificationAuthRequestHeaders(baseUrl, method = "GET", env = process.env) {
  if (env.PLOTPICKLE_VERIFICATION_AUTH_MODE !== AUTH_MODE) return {};
  const cookie = String(env.PLOTPICKLE_VERIFICATION_AUTH_COOKIE || "").trim();
  if (!/^ppsid=[^;\s]+$/u.test(cookie)) throw new Error("Full Verification synthetic Human session cookie is missing or invalid.");
  const headers = { Cookie: cookie };
  const verb = String(method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(verb)) {
    const csrf = String(env.PLOTPICKLE_VERIFICATION_AUTH_CSRF || "").trim();
    if (!csrf) throw new Error("Full Verification synthetic Human CSRF proof is missing.");
    headers.Origin = new URL(baseUrl).origin;
    headers["X-PlotPickle-CSRF"] = csrf;
  }
  return headers;
}

export function verificationPlaywrightArgs(args, env = process.env) {
  const values = [...args];
  if (env.PLOTPICKLE_VERIFICATION_AUTH_MODE !== AUTH_MODE) return values;
  if (!values.some((value) => /^@playwright\/mcp(?:@|$)/u.test(String(value)))) return values;

  const home = String(env.PLOTPICKLE_VERIFICATION_AUTH_HOME || "").trim();
  const storageState = String(env.PLOTPICKLE_VERIFICATION_STORAGE_STATE || "").trim();
  if (!home || !storageState || !path.isAbsolute(home) || !path.isAbsolute(storageState) || !isInside(home, storageState)) {
    throw new Error("Full Verification refused an invalid Playwright synthetic-auth storage-state path.");
  }
  const existingIndex = values.findIndex((value) => String(value) === "--storage-state" || String(value).startsWith("--storage-state="));
  if (existingIndex >= 0) throw new Error("Full Verification refuses a competing Playwright storage-state argument.");
  return [...values, "--storage-state", storageState];
}
