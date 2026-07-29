import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { localAiGateway } from "./build/local-ai-gateway";
import { localConnectionsGateway } from "./build/local-connections-gateway";
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
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Desktop releases load the same versioned public GitHub App identity.
  // Environment values remain explicit development and self-hosting overrides.
  applyGitHubAppPublicConfig();
  applyGoogleOAuthPublicConfig();

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      localConnectionsGateway(),
      googleCalendarGateway(),
      githubAppGateway(),
      githubCommandGateway(),
      githubRepositoryRecoveryGateway(),
      githubProjectSyncGateway(),
      collaborationAccessGuard(),
      githubReviewGateway(),
      collaborationInvitationGateway(),
      afterglowProjectGateway(),
      // Folder projects are the canonical working format. Native Git operates
      // directly inside those folders and never requires a terminal.
      folderProjectGateway(),
      nativeGitGateway(),
      localStorageSafetyGateway(),
      localProjectGateway(),
      localAiGateway(),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
