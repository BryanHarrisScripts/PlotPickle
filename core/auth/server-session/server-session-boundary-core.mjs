import { createHash } from "node:crypto";
import { isIP } from "node:net";

export const SERVER_SESSION_VERSION = 1;
export const NETWORK_SESSION_COOKIE = "__Host-ppsid";
export const LOOPBACK_SESSION_COOKIE = "ppsid";
export const SAFE_HTTP_METHODS = Object.freeze(["GET", "HEAD", "OPTIONS"]);
export const DEFAULT_LOGIN_THROTTLE = Object.freeze({
  desktopLoopbackBaseDelayMs: 250,
  serverNetworkBaseDelayMs: 1_000,
  maximumDelayMs: 30_000,
  loginFailuresBeforeDelay: 3,
  recoveryFailuresBeforeDelay: 1,
  bootstrapFailuresBeforeDelay: 1,
  bucketRetentionMs: 15 * 60 * 1_000,
});

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const FORBIDDEN_SESSION_PARAMETERS = Object.freeze(["session", "sessionId", "session_id", "sid", "token", "authToken"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const POLICY_FIELDS = Object.freeze([
  "accessMode", "bindHost", "externalOrigin", "allowedOrigins", "allowedHosts", "serverNetworkEnabled",
  "tlsMode", "trustedProxyAddresses", "bootstrapComplete", "enableHsts",
]);
const REQUEST_REQUIREMENT_FIELDS = Object.freeze([
  "mutation", "profileId", "projectId", "profileSecretProfileId", "nodeAdministrator", "recentReauthentication",
]);

export class PlotPickleServerSessionError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "PlotPickleServerSessionError";
    this.code = code;
    this.publicCode = options.publicCode || code;
    this.publicMessage = options.publicMessage || message;
    this.retryAfterMs = options.retryAfterMs || 0;
  }
}

function fail(code, message, options) {
  throw new PlotPickleServerSessionError(code, message, options);
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertExactFields(value, allowed, label) {
  if (!isRecord(value)) fail("INVALID_SERVER_SESSION_CONTRACT", `${label} must be an object.`);
  const unexpected = Object.keys(value).filter((field) => !allowed.includes(field));
  if (unexpected.length) fail("INVALID_SERVER_SESSION_CONTRACT", `${label} contains unsupported fields: ${unexpected.join(", ")}.`);
}

function exactString(value, label, maximumLength = 500) {
  if (typeof value !== "string" || !value || value.length > maximumLength || value.trim() !== value || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail("INVALID_SERVER_SESSION_CONTRACT", `${label} is invalid.`);
  }
  return value;
}

function canonicalOrigin(value, label) {
  let url;
  try {
    url = new URL(exactString(value, label, 2_000));
  } catch (error) {
    fail("INVALID_SERVER_SESSION_CONTRACT", `${label} must be an absolute HTTP(S) origin.`, { cause: error });
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    fail("INVALID_SERVER_SESSION_CONTRACT", `${label} must contain only an HTTP(S) scheme and authority.`);
  }
  return url.origin;
}

function normalizedRemoteAddress(value) {
  const address = typeof value === "string" ? value.trim() : "";
  return address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;
}

function isLoopbackAddress(value) {
  const address = normalizedRemoteAddress(value).toLowerCase();
  return LOOPBACK_HOSTS.has(address);
}

function canonicalHost(value, label = "Host") {
  const candidate = exactString(value, label, 255).toLowerCase();
  if (candidate.includes("*") || candidate.includes(",") || candidate.includes("/")) fail("INVALID_SERVER_SESSION_CONTRACT", `${label} cannot be broad or ambiguous.`);
  try {
    return new URL(`http://${candidate}`).host.toLowerCase();
  } catch (error) {
    fail("INVALID_SERVER_SESSION_CONTRACT", `${label} is invalid.`, { cause: error });
  }
}

function immutableUniqueStrings(value, label, normalizer) {
  if (!Array.isArray(value) || !value.length) fail("INVALID_SERVER_SESSION_CONTRACT", `${label} must be a non-empty array.`);
  const normalized = value.map((entry) => normalizer(entry, label));
  if (new Set(normalized).size !== normalized.length) fail("INVALID_SERVER_SESSION_CONTRACT", `${label} contains duplicates.`);
  return Object.freeze(normalized);
}

function headerValue(headers, name) {
  if (headers?.get instanceof Function) return headers.get(name);
  if (!isRecord(headers)) return null;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  const value = key ? headers[key] : null;
  if (Array.isArray(value)) return value.join(",");
  return value === undefined || value === null ? null : String(value);
}

function requestMethod(request) {
  return String(request?.method || "GET").toUpperCase();
}

function requestUrl(request, policy) {
  const raw = typeof request?.url === "string" && request.url ? request.url : "/";
  try {
    return new URL(raw, policy.primaryOrigin);
  } catch (error) {
    fail("REQUEST_BOUNDARY_REJECTED", "The request URL is invalid.", { cause: error });
  }
}

function requestHost(request, url) {
  return canonicalHost(headerValue(request?.headers, "host") || url.host, "Request Host");
}

function requestOrigin(request) {
  const value = headerValue(request?.headers, "origin");
  return value === null ? null : canonicalOrigin(value, "Request Origin");
}

function safeForwardedClientAddress(request, policy) {
  const remoteAddress = normalizedRemoteAddress(request?.remoteAddress || request?.socket?.remoteAddress || "");
  const forwarded = headerValue(request?.headers, "x-forwarded-for");
  if (!forwarded) return remoteAddress || "unknown";
  if (!policy.trustedProxyAddresses.includes(remoteAddress)) return remoteAddress || "unknown";
  const chain = forwarded.split(",").map((entry) => normalizedRemoteAddress(entry.trim()));
  if (!chain.length || chain.some((entry) => !isIP(entry))) fail("REQUEST_BOUNDARY_REJECTED", "Forwarded client addressing is invalid.");
  return chain[0];
}

function requestUsesTrustedTls(request, policy) {
  if (request?.secure === true || request?.socketEncrypted === true || request?.socket?.encrypted === true) return true;
  if (policy.tlsMode !== "trusted-proxy") return false;
  const remoteAddress = normalizedRemoteAddress(request?.remoteAddress || request?.socket?.remoteAddress || "");
  if (!policy.trustedProxyAddresses.includes(remoteAddress)) return false;
  return headerValue(request?.headers, "x-forwarded-proto")?.toLowerCase() === "https";
}

function parseCookieHeader(value) {
  const cookies = new Map();
  if (!value) return cookies;
  for (const part of value.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) fail("SESSION_REJECTED", "The session cookie is malformed.");
    const name = part.slice(0, separator).trim();
    const cookieValue = part.slice(separator + 1).trim();
    if (cookies.has(name)) fail("SESSION_REJECTED", "Duplicate session cookies are not accepted.");
    cookies.set(name, cookieValue);
  }
  return cookies;
}

function extractCookieSession(request, policy, url) {
  if (headerValue(request?.headers, "authorization") || headerValue(request?.headers, "x-plotpickle-session")) {
    fail("SESSION_EXCHANGE_REJECTED", "Human sessions are accepted only through the session cookie.");
  }
  if (FORBIDDEN_SESSION_PARAMETERS.some((name) => url.searchParams.has(name))) {
    fail("SESSION_EXCHANGE_REJECTED", "Human sessions are not accepted in request URLs.");
  }
  const cookies = parseCookieHeader(headerValue(request?.headers, "cookie"));
  const value = cookies.get(policy.cookieName);
  if (!value || !BASE64URL_PATTERN.test(value) || Buffer.from(value, "base64url").byteLength !== 32) {
    fail("SESSION_REJECTED", "The Human session is invalid or expired.");
  }
  return value;
}

function validateRequestBoundary(policy, request, options = {}) {
  if (!policy.ready) fail("SERVER_NETWORK_NOT_READY", "PlotPickle server-network mode is not ready for Human authentication.");
  const url = requestUrl(request, policy);
  const host = requestHost(request, url);
  if (!policy.allowedHosts.includes(host) || canonicalHost(url.host, "Request URL Host") !== host) {
    fail("HOST_REJECTED", "The request Host is not allowed.");
  }
  const origin = requestOrigin(request);
  if ((options.requireOrigin || origin !== null) && (origin === null || !policy.allowedOrigins.includes(origin))) {
    fail("ORIGIN_REJECTED", "The request Origin is not allowed.");
  }
  const remoteAddress = normalizedRemoteAddress(request?.remoteAddress || request?.socket?.remoteAddress || "");
  if (policy.accessMode === "desktop-loopback" && (!isLoopbackAddress(remoteAddress) || !LOOPBACK_HOSTS.has(url.hostname.toLowerCase()))) {
    fail("LOOPBACK_BOUNDARY_REJECTED", "Desktop PlotPickle accepts Human sessions only from loopback.");
  }
  if (policy.accessMode === "server-network" && !requestUsesTrustedTls(request, policy)) {
    fail("TLS_REQUIRED", "Remote Human authentication requires trusted HTTPS transport.");
  }
  return Object.freeze({ url, origin, host, sourceIp: safeForwardedClientAddress(request, policy) });
}

export function createServerExposurePolicy(input = {}) {
  assertExactFields(input, POLICY_FIELDS, "Server exposure policy");
  const accessMode = input.accessMode === "server-network" ? "server-network" : input.accessMode === "desktop-loopback"
    ? "desktop-loopback"
    : fail("INVALID_SERVER_SESSION_CONTRACT", "Server access mode must be desktop-loopback or server-network.");
  const bindHost = normalizedRemoteAddress(input.bindHost || (accessMode === "desktop-loopback" ? "127.0.0.1" : ""));
  const trustedProxyAddresses = Object.freeze((input.trustedProxyAddresses || []).map((entry) => {
    const address = normalizedRemoteAddress(exactString(entry, "Trusted proxy address", 100));
    if (!isIP(address)) fail("INVALID_SERVER_SESSION_CONTRACT", "Trusted proxy addresses must be explicit IP addresses.");
    return address;
  }));
  if (new Set(trustedProxyAddresses).size !== trustedProxyAddresses.length) fail("INVALID_SERVER_SESSION_CONTRACT", "Trusted proxy addresses contain duplicates.");

  if (accessMode === "desktop-loopback") {
    const allowedOrigins = input.allowedOrigins === undefined
      ? Object.freeze(["http://127.0.0.1:4173"])
      : immutableUniqueStrings(input.allowedOrigins, "Allowed origins", canonicalOrigin);
    if (!isLoopbackAddress(bindHost) || allowedOrigins.some((origin) => !LOOPBACK_HOSTS.has(new URL(origin).hostname.toLowerCase()))) {
      fail("INVALID_SERVER_SESSION_CONTRACT", "Desktop-loopback exposure must remain entirely on loopback.");
    }
    const allowedHosts = input.allowedHosts === undefined
      ? Object.freeze(allowedOrigins.map((origin) => new URL(origin).host.toLowerCase()))
      : immutableUniqueStrings(input.allowedHosts, "Allowed hosts", canonicalHost);
    return Object.freeze({
      version: SERVER_SESSION_VERSION,
      accessMode,
      bindHost,
      primaryOrigin: allowedOrigins[0],
      allowedOrigins,
      allowedHosts,
      cookieName: LOOPBACK_SESSION_COOKIE,
      secureCookies: false,
      tlsMode: "loopback-http",
      trustedProxyAddresses: Object.freeze([]),
      enableHsts: false,
      ready: true,
      reasons: Object.freeze([]),
    });
  }

  const reasons = [];
  const externalOrigin = input.externalOrigin ? canonicalOrigin(input.externalOrigin, "External origin") : null;
  if (input.serverNetworkEnabled !== true) reasons.push("server-network-not-explicitly-enabled");
  if (!bindHost || !isIP(bindHost)) reasons.push("explicit-bind-address-required");
  if (!externalOrigin || new URL(externalOrigin).protocol !== "https:") reasons.push("https-external-origin-required");
  const allowedOrigins = input.allowedOrigins?.length ? immutableUniqueStrings(input.allowedOrigins, "Allowed origins", canonicalOrigin) : Object.freeze([]);
  if (!allowedOrigins.length || allowedOrigins.some((origin) => new URL(origin).protocol !== "https:")) reasons.push("explicit-https-origin-allowlist-required");
  if (externalOrigin && !allowedOrigins.includes(externalOrigin)) reasons.push("external-origin-must-be-allowlisted");
  const allowedHosts = input.allowedHosts?.length ? immutableUniqueStrings(input.allowedHosts, "Allowed hosts", canonicalHost) : Object.freeze([]);
  if (!allowedHosts.length) reasons.push("explicit-host-allowlist-required");
  const tlsMode = ["direct", "trusted-proxy"].includes(input.tlsMode) ? input.tlsMode : null;
  if (!tlsMode) reasons.push("tls-mode-required");
  if (tlsMode === "trusted-proxy" && !trustedProxyAddresses.length) reasons.push("trusted-proxy-addresses-required");
  if (input.bootstrapComplete !== true) reasons.push("first-run-bootstrap-incomplete");
  return Object.freeze({
    version: SERVER_SESSION_VERSION,
    accessMode,
    bindHost,
    primaryOrigin: externalOrigin || allowedOrigins[0] || "https://invalid.plotpickle",
    allowedOrigins,
    allowedHosts,
    cookieName: NETWORK_SESSION_COOKIE,
    secureCookies: true,
    tlsMode,
    trustedProxyAddresses,
    enableHsts: input.enableHsts === true,
    ready: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

function throttleDigest(value) {
  return createHash("sha256").update("plotpickle:auth-throttle:v1\0", "utf8").update(String(value)).digest("base64url");
}

export function createAuthenticationThrottle(options = {}) {
  const accessMode = options.accessMode === "server-network" ? "server-network" : "desktop-loopback";
  const now = typeof options.now === "function" ? options.now : Date.now;
  const policy = Object.freeze({ ...DEFAULT_LOGIN_THROTTLE, ...(isRecord(options.policy) ? options.policy : {}) });
  const buckets = new Map();
  const observedAt = () => {
    const value = Number(now());
    if (!Number.isFinite(value)) fail("INVALID_SERVER_SESSION_CONTRACT", "Authentication throttle clock is invalid.");
    return value;
  };
  const purposeThreshold = (purpose) => purpose === "recovery" ? policy.recoveryFailuresBeforeDelay
    : purpose === "bootstrap" ? policy.bootstrapFailuresBeforeDelay
      : policy.loginFailuresBeforeDelay;
  const keys = ({ sourceIp, locator, purpose }) => Object.freeze([
    `node:${purpose}`,
    `ip:${purpose}:${throttleDigest(sourceIp || "unknown")}`,
    `locator:${purpose}:${throttleDigest(String(locator || "unknown").toLocaleLowerCase("en-US"))}`,
  ]);
  const prune = (time) => {
    for (const [key, bucket] of buckets) if (time - bucket.lastFailureAt > policy.bucketRetentionMs) buckets.delete(key);
  };
  const retryAfter = (request) => {
    const time = observedAt();
    prune(time);
    return Math.max(0, ...keys(request).map((key) => (buckets.get(key)?.blockedUntil || 0) - time));
  };
  return Object.freeze({
    assertAllowed(request) {
      const waitMs = retryAfter(request);
      if (waitMs > 0) fail("AUTHENTICATION_THROTTLED", "Authentication is temporarily unavailable. Try again later.", {
        retryAfterMs: waitMs,
        publicCode: "AUTHENTICATION_THROTTLED",
        publicMessage: "Authentication is temporarily unavailable. Try again later.",
      });
      return true;
    },
    recordFailure(request) {
      const time = observedAt();
      const threshold = purposeThreshold(request.purpose);
      const baseDelay = accessMode === "server-network" ? policy.serverNetworkBaseDelayMs : policy.desktopLoopbackBaseDelayMs;
      let longestDelay = 0;
      for (const key of keys(request)) {
        const prior = buckets.get(key) || { failures: 0, blockedUntil: 0, lastFailureAt: time };
        const failures = prior.failures + 1;
        const exponent = Math.max(0, failures - threshold);
        const delay = failures < threshold ? 0 : Math.min(policy.maximumDelayMs, baseDelay * (2 ** exponent));
        longestDelay = Math.max(longestDelay, delay);
        buckets.set(key, { failures, blockedUntil: time + delay, lastFailureAt: time });
      }
      return longestDelay;
    },
    recordSuccess(request) {
      const requestKeys = keys(request);
      buckets.delete(requestKeys[2]);
      for (const key of requestKeys.slice(0, 2)) {
        const bucket = buckets.get(key);
        if (!bucket) continue;
        if (bucket.failures <= 1) buckets.delete(key);
        else buckets.set(key, { failures: bucket.failures - 1, blockedUntil: 0, lastFailureAt: observedAt() });
      }
    },
    retryAfter,
    inspectMetadata() {
      return Object.freeze({ activeBuckets: buckets.size, valuesLogged: false });
    },
  });
}

export function createAuthorizationGuards(options) {
  if (!options?.authService || typeof options.authService.requireRecentReauthentication !== "function") {
    fail("INVALID_SERVER_SESSION_CONTRACT", "Authorization guards require the canonical PlotPickle Auth service.");
  }
  const projectAccess = typeof options.projectAccess === "function" ? options.projectAccess : null;
  return Object.freeze({
    requireSession(authContext) {
      return options.authService.resolveSession(authContext.sessionId);
    },
    requireProfileOwner(authContext, targetProfileId) {
      if (authContext.profileId !== targetProfileId) fail("ACCESS_DENIED", "The authenticated Human does not own this profile resource.");
      return authContext;
    },
    async requireProjectAccess(authContext, projectId) {
      if (!projectAccess || await projectAccess({ authContext, projectId }) !== true) fail("ACCESS_DENIED", "The authenticated Human cannot access this project.");
      return authContext;
    },
    requireProfileSecretAccess(authContext, targetProfileId) {
      if (authContext.profileId !== targetProfileId) fail("ACCESS_DENIED", "The authenticated Human cannot access this profile secret.");
      return authContext;
    },
    requireNodeAdministrator(authContext) {
      if (!authContext.roles.includes("node-administrator")) fail("ACCESS_DENIED", "Node administrator authority is required.");
      return authContext;
    },
    requireRecentReauthentication(authContext) {
      return options.authService.requireRecentReauthentication(authContext);
    },
  });
}

function sessionCookie(policy, value, absoluteExpiresAt, now) {
  const seconds = Math.max(1, Math.floor((Date.parse(absoluteExpiresAt) - now) / 1_000));
  return `${policy.cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${policy.secureCookies ? "; Secure" : ""}`;
}

function clearedSessionCookie(policy) {
  return `${policy.cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${policy.secureCookies ? "; Secure" : ""}`;
}

function securityHeaders(policy) {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
  if (policy.accessMode === "server-network" && policy.enableHsts) headers["Strict-Transport-Security"] = "max-age=31536000";
  return Object.freeze(headers);
}

function safeSessionPresentation(request, policy) {
  const userAgent = headerValue(request?.headers, "user-agent") || "";
  const deviceLabel = /firefox/iu.test(userAgent) ? "Firefox browser"
    : /edg/iu.test(userAgent) ? "Edge browser"
      : /chrome|chromium/iu.test(userAgent) ? "Chromium browser"
        : /safari/iu.test(userAgent) ? "Safari browser"
          : "Browser session";
  return Object.freeze({
    deviceLabel,
    originLabel: policy.accessMode === "desktop-loopback" ? "This computer" : new URL(policy.primaryOrigin).hostname,
  });
}

export function toPublicServerSessionError(error) {
  if (error instanceof PlotPickleServerSessionError) {
    return Object.freeze({ code: error.publicCode, message: error.publicMessage, retryAfterMs: error.retryAfterMs || undefined });
  }
  return Object.freeze({ code: "AUTH_REQUEST_REJECTED", message: "The authentication request could not be completed.", retryAfterMs: undefined });
}

export function createServerSessionBoundary(options) {
  if (!options?.authService || typeof options.authService.authenticate !== "function" || typeof options.authService.resolveSession !== "function"
    || typeof options.authService.createBrowserSession !== "function" || typeof options.authService.validateCsrfToken !== "function") {
    fail("INVALID_SERVER_SESSION_CONTRACT", "Server sessions require the canonical PlotPickle Auth service.");
  }
  const policy = createServerExposurePolicy(options.exposure);
  if (options.authService.accessMode !== policy.accessMode) fail("INVALID_SERVER_SESSION_CONTRACT", "Auth Core and server exposure modes must match.");
  const now = typeof options.now === "function" ? options.now : Date.now;
  const throttle = options.throttle || createAuthenticationThrottle({ accessMode: policy.accessMode, now });
  const guards = createAuthorizationGuards({ authService: options.authService, projectAccess: options.projectAccess });

  const establishBrowserSession = (authContext, request) => {
    const transport = options.authService.createBrowserSession(authContext, safeSessionPresentation(request, policy));
    return Object.freeze({
      csrfToken: transport.csrfToken,
      idleExpiresAt: transport.idleExpiresAt,
      absoluteExpiresAt: transport.absoluteExpiresAt,
      headers: Object.freeze({
        ...securityHeaders(policy),
        "Set-Cookie": sessionCookie(policy, transport.cookieValue, transport.absoluteExpiresAt, Number(now())),
      }),
    });
  };

  const rateRequest = (boundary, locator, purpose) => Object.freeze({ sourceIp: boundary.sourceIp, locator, purpose });
  const authorize = async (request, requirements = {}, stream = false) => {
    assertExactFields(requirements, REQUEST_REQUIREMENT_FIELDS, "Request authorization requirements");
    const method = requestMethod(request);
    const mutation = requirements.mutation === true || !SAFE_HTTP_METHODS.includes(method);
    if (requirements.mutation === true && SAFE_HTTP_METHODS.includes(method)) fail("METHOD_REJECTED", "State-changing operations cannot use safe HTTP methods.");
    const boundary = validateRequestBoundary(policy, request, { requireOrigin: mutation || stream });
    const cookieValue = extractCookieSession(request, policy, boundary.url);
    const authContext = options.authService.resolveSession(cookieValue);
    if (mutation) {
      const csrfToken = headerValue(request?.headers, "x-plotpickle-csrf");
      if (!csrfToken || options.authService.validateCsrfToken(authContext, csrfToken) !== true) fail("CSRF_REJECTED", "The request CSRF proof is invalid.");
    }
    if (requirements.profileId !== undefined) guards.requireProfileOwner(authContext, requirements.profileId);
    if (requirements.profileSecretProfileId !== undefined) guards.requireProfileSecretAccess(authContext, requirements.profileSecretProfileId);
    if (requirements.projectId !== undefined) await guards.requireProjectAccess(authContext, requirements.projectId);
    if (requirements.nodeAdministrator === true) guards.requireNodeAdministrator(authContext);
    if (requirements.recentReauthentication === true) guards.requireRecentReauthentication(authContext);
    return Object.freeze({ authContext, boundary });
  };

  return Object.freeze({
    policy,
    readiness() {
      return Object.freeze({ ready: policy.ready, accessMode: policy.accessMode, bindHost: policy.bindHost, reasons: policy.reasons });
    },
    browserSecurityHeaders() {
      return securityHeaders(policy);
    },
    async loginWithPassword(input, request) {
      const boundary = validateRequestBoundary(policy, request, { requireOrigin: true });
      const rate = rateRequest(boundary, input?.profileId, "login");
      throttle.assertAllowed(rate);
      try {
        const result = await options.authService.authenticate(input);
        throttle.recordSuccess(rate);
        return Object.freeze({ profile: result.profile, vaultMaintenance: result.vaultMaintenance, ...establishBrowserSession(result.authContext, request) });
      } catch (error) {
        throttle.recordFailure(rate);
        fail("AUTHENTICATION_REJECTED", "Profile authentication failed.", {
          cause: error,
          publicCode: "AUTHENTICATION_REJECTED",
          publicMessage: "Profile authentication failed.",
        });
      }
    },
    async resetPasswordWithRecovery(input, request) {
      const boundary = validateRequestBoundary(policy, request, { requireOrigin: true });
      const rate = rateRequest(boundary, input?.profileId, "recovery");
      throttle.assertAllowed(rate);
      try {
        const result = await options.authService.resetPasswordWithRecovery(input);
        throttle.recordSuccess(rate);
        return Object.freeze({ profile: result.profile, recoverySecret: result.recoverySecret, ...establishBrowserSession(result.authContext, request) });
      } catch (error) {
        throttle.recordFailure(rate);
        fail("AUTHENTICATION_REJECTED", "Profile authentication failed.", {
          cause: error,
          publicCode: "AUTHENTICATION_REJECTED",
          publicMessage: "Profile authentication failed.",
        });
      }
    },
    async createFirstProfile(input, bootstrapProof, request) {
      const boundary = validateRequestBoundary(policy, request, { requireOrigin: true });
      const rate = rateRequest(boundary, "first-profile", "bootstrap");
      throttle.assertAllowed(rate);
      try {
        const result = await options.authService.createFirstProfile(input, bootstrapProof);
        throttle.recordSuccess(rate);
        return Object.freeze({ profile: result.profile, recoverySecret: result.recoverySecret, ...establishBrowserSession(result.authContext, request) });
      } catch (error) {
        throttle.recordFailure(rate);
        fail("BOOTSTRAP_PROOF_REJECTED", "The server bootstrap request was rejected.", {
          cause: error,
          publicCode: "BOOTSTRAP_PROOF_REJECTED",
          publicMessage: "The server bootstrap request was rejected.",
        });
      }
    },
    authorizeRequest(request, requirements = {}) {
      return authorize(request, requirements, false);
    },
    authorizePrivateStream(request, requirements = {}) {
      if (requestMethod(request) !== "GET") fail("METHOD_REJECTED", "Private stream setup requires GET.");
      return authorize(request, requirements, true);
    },
    async logout(request) {
      const { authContext } = await authorize(request, { mutation: true });
      options.authService.lock(authContext);
      return Object.freeze({ headers: Object.freeze({ ...securityHeaders(policy), "Set-Cookie": clearedSessionCookie(policy), "Clear-Site-Data": "\"cache\"" }) });
    },
    async listSessions(request) {
      const { authContext } = await authorize(request);
      return options.authService.listSessions(authContext);
    },
    async revokeSession(request, sessionRef) {
      const { authContext } = await authorize(request, { mutation: true, recentReauthentication: true });
      return options.authService.revokeSession(sessionRef, authContext);
    },
    async revokeOtherSessions(request) {
      const { authContext } = await authorize(request, { mutation: true, recentReauthentication: true });
      return options.authService.revokeOtherSessions(authContext);
    },
    throttleMetadata() {
      return throttle.inspectMetadata();
    },
  });
}
