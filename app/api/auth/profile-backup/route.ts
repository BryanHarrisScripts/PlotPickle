import {
  createProfileBackupBundle,
  parseProfileBackupBundle,
  restoreProfileBackupToStateStore,
  serializeProfileBackupBundle,
  verifyProfileBackupBundle,
} from "../../../../core/auth/profile-backup/profile-backup";
import {
  getProfileExperienceRuntime,
  requestBoundary,
  resetProfileExperienceRuntime,
} from "../../../../core/auth/profile-experience/profile-experience-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(value: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...headers },
  });
}

function originOf(request: Request) {
  return new URL(request.url).origin;
}

function bundleFrom(value: unknown) {
  if (typeof value === "string") return parseProfileBackupBundle(JSON.parse(value));
  return parseProfileBackupBundle(value);
}

function publicBackupError(error: unknown) {
  const code = typeof (error as { code?: unknown })?.code === "string" ? String((error as { code: string }).code) : "PROFILE_BACKUP_FAILED";
  if (code === "PROFILE_BACKUP_AUTH_REJECTED") return { status: 401, code, message: "Profile backup authentication failed." };
  if (code === "PROFILE_BACKUP_TAMPERED" || code === "PROFILE_BACKUP_SOURCE_CORRUPT") return { status: 400, code, message: "The profile backup could not be verified." };
  if (code === "PROFILE_RESTORE_CONFLICT") return { status: 409, code, message: "That Human profile already exists or conflicts with local restored data." };
  if (code === "PROFILE_RESTORE_REQUIRES_EMPTY_NODE") return { status: 409, code, message: "Portable restore currently requires a fresh PlotPickle Node with no Human profiles." };
  if (code === "RESTORE_BOOTSTRAP_REQUIRED") return { status: 403, code, message: "Server restore requires the current one-time bootstrap proof." };
  if (code === "RECENT_REAUTHENTICATION_REQUIRED" || code === "ACCESS_DENIED" || code === "SESSION_REJECTED") return { status: 403, code, message: "Recent authenticated profile access is required." };
  if (code === "INVALID_PROFILE_PASSWORD") return { status: 400, code, message: "Choose a stronger new profile password or passphrase." };
  if (code.startsWith("PROFILE_BACKUP_") || code === "INVALID_PROFILE_BACKUP" || code === "INVALID_PROFILE_BACKUP_PATH") {
    return { status: 400, code, message: "The profile backup request is invalid." };
  }
  return { status: 400, code: "PROFILE_BACKUP_FAILED", message: "The profile backup operation could not be completed." };
}

export async function POST(request: Request) {
  try {
    const runtimeState = await getProfileExperienceRuntime();
    const origin = originOf(request);
    const boundary = runtimeState.boundaryFor(origin);
    const input = await request.json() as Record<string, unknown>;
    const action = typeof input.action === "string" ? input.action : "";

    if (action === "create") {
      const { authContext } = await boundary.authorizeRequest(requestBoundary(request), {
        mutation: true,
        recentReauthentication: true,
      });
      const bundle = await createProfileBackupBundle({
        root: runtimeState.home,
        authService: runtimeState.auth,
        stateStore: runtimeState.stateStore,
        authContext,
        includeNetworkIdentity: input.includeNetworkIdentity === true,
      });
      const serialized = serializeProfileBackupBundle(bundle);
      const shortProfile = bundle.header.profileId.slice(-10);
      return new Response(serialized, {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/vnd.plotpickle.profile-backup+json; charset=utf-8",
          "Content-Disposition": `attachment; filename="plotpickle-profile-${shortProfile}.ppbackup"`,
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (action === "verify") {
      const bundle = bundleFrom(input.bundle);
      const verification = await verifyProfileBackupBundle(
        bundle,
        typeof input.recoverySecret === "string"
          ? { recoverySecret: input.recoverySecret }
          : { password: String(input.password || "") },
      );
      return json(verification);
    }

    if (action === "restore") {
      const publicStatus = runtimeState.auth.getAuthStatus();
      if (publicStatus.configured === true) {
        const error = new Error("Live portable restore into a populated Node is not supported by the v1 session-preserving boundary.");
        (error as Error & { code: string }).code = "PROFILE_RESTORE_REQUIRES_EMPTY_NODE";
        throw error;
      }
      const bundle = bundleFrom(input.bundle);
      const usingRecovery = typeof input.recoverySecret === "string" && input.recoverySecret.length > 0;
      const restored = await restoreProfileBackupToStateStore({
        root: runtimeState.home,
        stateStore: runtimeState.stateStore,
        bundle,
        password: usingRecovery ? undefined : String(input.password || ""),
        recoverySecret: usingRecovery ? input.recoverySecret as string : undefined,
        newPassword: usingRecovery ? String(input.newPassword || "") : undefined,
        bootstrapProof: typeof input.bootstrapProof === "string" ? input.bootstrapProof : undefined,
        nodeId: runtimeState.auth.nodeId,
        accessMode: runtimeState.accessMode,
      });

      await resetProfileExperienceRuntime();
      const reloaded = await getProfileExperienceRuntime();
      const password = usingRecovery ? String(input.newPassword || "") : String(input.password || "");
      const authenticated = await reloaded.auth.authenticate({ profileId: restored.profileId, password });
      const browser = reloaded.establishSession(authenticated.authContext, origin);
      return json({
        profile: authenticated.profile,
        csrfToken: browser.csrfToken,
        recoverySecret: restored.recoverySecret,
        includesNetworkIdentity: restored.includesNetworkIdentity,
      }, 200, { "Set-Cookie": browser.setCookie });
    }

    return json({ code: "UNSUPPORTED_PROFILE_BACKUP_ACTION", message: "That profile backup action is unavailable." }, 400);
  } catch (error) {
    const detail = publicBackupError(error);
    return json({ code: detail.code, message: detail.message }, detail.status);
  }
}
