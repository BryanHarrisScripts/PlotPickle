import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("BUZZ browser mutations inherit the active Human CSRF proof without weakening session authorization", async () => {
  const [helper, settings, liveHealth, workspace, social, storyAccess, agentRoster] = await Promise.all([
    read("core/auth/profile-request-browser.ts"),
    read("app/buzz-settings-panel.tsx"),
    read("app/buzz-live-health-card.tsx"),
    read("app/community-workspace.tsx"),
    read("modules/community/community-buzz-social.tsx"),
    read("app/_components/community/community-story-room-access.tsx"),
    read("app/community-agent-roster.tsx"),
  ]);

  assert.match(helper, /fetch\("\/api\/auth\/profile"[\s\S]*credentials:\s*"same-origin"/u);
  assert.match(helper, /SAFE_HTTP_METHODS[\s\S]*headers\.set\("X-PlotPickle-CSRF", await activeHumanCsrfToken\(\)\)/u);
  assert.match(helper, /body\.authenticated !== true \|\| !token/u);

  for (const [label, source] of [
    ["BUZZ Settings", settings],
    ["BUZZ live health", liveHealth],
    ["Community workspace", workspace],
    ["Community conversation", social],
    ["Story Room access", storyAccess],
    ["Community Agent specialist", agentRoster],
  ]) {
    assert.match(source, /authenticatedProfileFetch/u, `${label} must use the authenticated Human request helper.`);
  }

  assert.match(social, /authenticatedProfileFetch\(`\$\{BUZZ_API\}\/messages`[\s\S]*method:\s*"POST"/u);
  assert.match(liveHealth, /authenticatedProfileFetch\("\/api\/local-buzz\/live-health", \{ method: "POST"/u);
  assert.match(settings, /authenticatedProfileFetch\(`\$\{API\}\$\{path\}`/u);
  assert.match(workspace, /authenticatedProfileFetch\(`\$\{BUZZ_API\}\$\{path\}`/u);
});

test("BUZZ profile authorization reports missing or expired CSRF proof clearly in development", async () => {
  const [context, boundary] = await Promise.all([
    read("build/profile-request-context.ts"),
    read("core/auth/server-session/server-session-boundary-core.mjs"),
  ]);
  assert.match(boundary, /CSRF_REJECTED[\s\S]*The request CSRF proof is invalid/u);
  assert.match(context, /code === "CSRF_REJECTED"[\s\S]*active Human session proof is missing or expired/u);
  assert.match(context, /process\.env\.NODE_ENV !== "production"/u);
  assert.match(context, /authCode[\s\S]*detail/u);
  assert.match(context, /boundary\.authorizeRequest\(sessionRequest\(request, origin\)\)/u);
});
