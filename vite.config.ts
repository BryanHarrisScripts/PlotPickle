import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { localAiGateway } from "./build/local-ai-gateway";
import { localConnectionsGateway } from "./build/local-connections-gateway";
import { localSystemStatusGateway } from "./build/local-system-status-gateway";
import { localProfileAuthGateway } from "./build/local-profile-auth-gateway";
import { writerInResidenceGateway } from "./build/writer-in-residence-gateway";
import { profileScopedBuzzRequestContext } from "./build/auth/profile-request-context";
import { autonomousGuestReferenceTaskGateway } from "./build/autonomous-guest/reference/reference-task-gateway";
import { buzzProfileMigrationGateway } from "./build/buzz/buzz-profile-migration-gateway";
import { buzzProfileIdentityGateway } from "./build/buzz-profile-identity-gateway";
import { buzzGateway } from "./build/buzz-gateway";
import { buzzCommunityGateway } from "./build/buzz-community-gateway";
import { buzzAgentRosterGateway } from "./build/buzz-agent-roster-gateway";
import { buzzGuildhallGateway } from "./build/buzz-guildhall-gateway";
import { buzzHumanIdentityGuard } from "./build/buzz-human-identity-guard";
import { buzzLiveHealthGateway } from "./build/buzz-live-health-gateway";
import { buzzStoryRoomIdentityGateway } from "./build/buzz-story-room-identity-gateway";
import { buzzStoryRoomListingGateway } from "./build/buzz-story-room-listing-gateway";
import { buzzStoryRoomAccessGateway } from "./build/buzz-story-room-access-gateway";
import { buzzStoryRoomDirectoryGateway } from "./build/buzz-story-room-directory-gateway";
import { buzzSpecialistGateway } from "./build/buzz/buzz-specialist-gateway";
import { buzzBundleNormalizer } from "./build/buzz/buzz-bundle-normalizer";
import { storyWorkflowBuzzBridgeGateway } from "./build/story-workflow-buzz-bridge-gateway";
import { loadLocalBuzzAgentIdentityBindings } from "./build/buzz/buzz-agent-identity-binding-loader";
import { googleCalendarGateway } from "./build/google-calendar-gateway";
import { githubAppGateway } from "./build/github-app-gateway";
import { applyGitHubAppPublicConfig } from "./build/github-app-public-config";
import { applyGoogleOAuthPublicConfig } from "./build/google-oauth-public-config";
import { githubCommandGateway } from "./build/github-command-gateway";
import { githubRepositoryRecoveryGateway } from "./build/github-repository-recovery-gateway";
import { githubProjectSyncGateway } from "./build/github-project-sync-gateway";
import { githubReviewGateway } from "./build/github-review-gateway";
import { collaborationAccessGuard } from "./build/collaboration-access-guard";
import { collaborationInvitationGateway } from "./build/collaboration-invitation-gateway";
import { afterglowProjectGateway } from "./build/projects/afterglow-project-gateway";
import { folderProjectGateway } from "./build/folder-project-gateway";
import { nativeGitGateway } from "./build/native-git-gateway";
import { localProjectGateway } from "./build/local-project-gateway";
import { localBackupGateway } from "./build/local-backup-gateway";
import { localStorageSafetyGateway } from "./build/local-storage-safety-gateway";
import { fullStoryBuilderGateway } from "./build/full-story-builder-gateway";
import { responsibilityRunGateway } from "./build/responsibility-run-gateway";
import { runTelemetryGateway } from "./build/run-telemetry-gateway";
import { sites } from "./build/sites-vite-plugin";
import { startupAgentDiagnosticsPlugin } from "./build/startup-agent-diagnostics";
import { uatDiscoveryPlugin } from "./build/uat-discovery-plugin";
import { localInstanceProofGateway } from "./build/local-instance-proof-gateway";
import { launcherLivenessGateway } from "./build/startup/launcher-liveness-gateway";
import {
  VINEXT_LINK_SHIM,
  VINEXT_NAVIGATION_SHIM,
  VINEXT_PACKAGE,
  VINEXT_PREFETCH_QUEUE_SHIM,
  installVinextRequestTimingOutputGuard,
  vinextRscOptimizationCompatibilityPlugin,
} from "./build/startup/vite-compatibility";

// Vite currently uses the bundled config loader for PlotPickle. Its proactive
// future-native-loader advisory is developer migration noise, not a startup
// failure, so keep it out of the user-facing local-app command window while
// CI continues to validate the real production build.
process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING ??= "true";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";
const UI_EXPERIENCE_LAB_DEV_GATE = fileURLToPath(
  new URL("./build/ui-experience-lab-gate.dev.ts", import.meta.url),
);

const { d1, r2 } = hostingConfig;
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const ignoredWatchPaths = [
  "**/reports/visual-audit/**",
  "**/plotpickle-visual-audit-*/**",
  "**/plotpickle-visual-audit-*.zip",
];

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1 ? [{ binding: d1, database_name: "site-creator-d1", database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID }] : [],
  r2_buckets: r2 ? [{ binding: r2, bucket_name: "site-creator-r2" }] : [],
};

export default defineConfig(async ({ command }) => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  if (command === "serve") installVinextRequestTimingOutputGuard();
  applyGitHubAppPublicConfig();
  applyGoogleOAuthPublicConfig();
  const localBuzzAgentIdentities = command === "serve" ? await loadLocalBuzzAgentIdentityBindings() : {};
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    define: {
      __PLOTPICKLE_STARTUP_CONTRACT__: JSON.stringify(
        process.env.PLOTPICKLE_STARTUP_CONTRACT ?? "plotpickle-unverified-startup",
      ),
      __PLOTPICKLE_BUZZ_AGENT_IDENTITIES__: JSON.stringify(localBuzzAgentIdentities),
    },
    resolve: {
      alias: command === "serve"
        ? [{ find: "../../build/ui-experience-lab-gate", replacement: UI_EXPERIENCE_LAB_DEV_GATE }]
        : [],
    },
    optimizeDeps: {
      exclude: [
        VINEXT_PACKAGE,
        VINEXT_LINK_SHIM,
        VINEXT_NAVIGATION_SHIM,
        VINEXT_PREFETCH_QUEUE_SHIM,
      ],
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      watch: {
        ignored: ignoredWatchPaths,
        ...(isCodexSeatbeltSandbox ? { useFsEvents: false, usePolling: true } : {}),
      },
    },
    plugins: [
      localInstanceProofGateway(),
      autonomousGuestReferenceTaskGateway(),
      localProfileAuthGateway(),
      localConnectionsGateway(),
      writerInResidenceGateway(),
      profileScopedBuzzRequestContext(),
      buzzProfileMigrationGateway(),
      buzzProfileIdentityGateway(),
      buzzBundleNormalizer(),
      buzzSpecialistGateway(),
      buzzCommunityGateway(),
      buzzAgentRosterGateway(),
      buzzGuildhallGateway(),
      buzzHumanIdentityGuard(),
      buzzLiveHealthGateway(),
      buzzStoryRoomIdentityGateway(),
      buzzStoryRoomListingGateway(),
      buzzStoryRoomAccessGateway(),
      buzzStoryRoomDirectoryGateway(),
      buzzGateway(),
      storyWorkflowBuzzBridgeGateway(),
      localSystemStatusGateway(),
      googleCalendarGateway(),
      githubAppGateway(),
      githubCommandGateway(),
      githubRepositoryRecoveryGateway(),
      githubProjectSyncGateway(),
      collaborationAccessGuard(),
      githubReviewGateway(),
      collaborationInvitationGateway(),
      afterglowProjectGateway(),
      folderProjectGateway(),
      nativeGitGateway(),
      localStorageSafetyGateway(),
      fullStoryBuilderGateway(),
      localProjectGateway(),
      localBackupGateway(),
      responsibilityRunGateway(),
      runTelemetryGateway(),
      localAiGateway(),
      startupAgentDiagnosticsPlugin(),
      uatDiscoveryPlugin(),
      launcherLivenessGateway(),
      vinext(),
      vinextRscOptimizationCompatibilityPlugin(),
      sites(),
      cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] }, inspectorPort: false, config: localBindingConfig }),
    ],
  };
});