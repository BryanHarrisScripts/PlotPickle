import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { localAiGateway } from "./build/local-ai-gateway";
import { localConnectionsGateway } from "./build/local-connections-gateway";
import { localSystemStatusGateway } from "./build/local-system-status-gateway";
import { buzzGateway } from "./build/buzz-gateway";
import { buzzCommunityGateway } from "./build/buzz-community-gateway";
import { buzzAgentRosterGateway } from "./build/buzz-agent-roster-gateway";
import { buzzGuildhallGateway } from "./build/buzz-guildhall-gateway";
import { buzzLiveHealthGateway } from "./build/buzz-live-health-gateway";
import { buzzBundleNormalizer } from "./build/buzz-bundle-normalizer";
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
import { afterglowProjectGateway } from "./build/afterglow-project-gateway";
import { folderProjectGateway } from "./build/folder-project-gateway";
import { nativeGitGateway } from "./build/native-git-gateway";
import { localProjectGateway } from "./build/local-project-gateway";
import { localStorageSafetyGateway } from "./build/local-storage-safety-gateway";
import { fullStoryBuilderGateway } from "./build/full-story-builder-gateway";
import { sites } from "./build/sites-vite-plugin";
import { startupAgentDiagnosticsPlugin } from "./build/startup-agent-diagnostics";
import { uatDiscoveryPlugin } from "./build/uat-discovery-plugin";

// Vite currently uses the bundled config loader for PlotPickle. Its proactive
// future-native-loader advisory is developer migration noise, not a startup
// failure, so keep it out of the user-facing local-app command window while
// CI continues to validate the real production build.
process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING ??= "true";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

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

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  applyGitHubAppPublicConfig();
  applyGoogleOAuthPublicConfig();
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    // Vinext compiles both the client and server component graphs. Inject the
    // launcher's exact per-checkout contract at transform time; reading a
    // custom process.env value directly from a component is normalized away.
    define: {
      __PLOTPICKLE_STARTUP_CONTRACT__: JSON.stringify(
        process.env.PLOTPICKLE_STARTUP_CONTRACT ?? "plotpickle-unverified-startup",
      ),
    },
    optimizeDeps: {
      // Vinext marks this RSC client shim inconsistently across the client/RSC
      // graphs. Excluding it keeps Vite from pre-optimizing one copy while
      // leaving another raw, which removes the harmless but noisy startup warning.
      exclude: ["vinext/dist/shims/internal/app-prefetch-fetch-queue.js"],
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
      localConnectionsGateway(),
      buzzBundleNormalizer(),
      buzzCommunityGateway(),
      buzzAgentRosterGateway(),
      buzzGuildhallGateway(),
      buzzLiveHealthGateway(),
      buzzGateway(),
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
      localAiGateway(),
      startupAgentDiagnosticsPlugin(),
      uatDiscoveryPlugin(),
      vinext(),
      sites(),
      cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] }, inspectorPort: false, config: localBindingConfig }),
    ],
  };
});