import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");

test("#1212 exposes one editable Human presentation and exactly three unconfigured BUZZ choices", async () => {
  const [panel, overlay, layout] = await Promise.all([
    read("app/profile-access/profile-identity-panel.tsx"),
    read("app/profile-access/profile-identity-overlay.tsx"),
    read("app/layout.tsx"),
  ]);

  assert.equal(panel.match(/<span>Display name<\/span>/gu)?.length, 1);
  assert.equal(panel.match(/<span>Avatar<\/span>/gu)?.length, 1);
  assert.equal(panel.match(/<span>Public bio \/ description<\/span>/gu)?.length, 1);
  assert.match(panel, /data-buzz-setup-choices="true"[\s\S]*Create BUZZ Identity[\s\S]*Connect Existing Identity[\s\S]*Not Now/u);
  assert.match(panel, /Leave blank to use the PlotPickle lore glyph/u);
  assert.match(panel, /A custom secure image is published to BUZZ when connected/u);
  assert.match(panel, /data-default-lore-glyph="true"/u);
  assert.match(panel, /The same bio is published to BUZZ when connected/u);
  assert.match(panel, /BUZZ Identity[\s\S]*View identity details/u);

  assert.match(overlay, /ProfileIdentityPanel/u);
  assert.match(overlay, /plotpickle:profile-action/u);
  for (const action of ["add-profile", "lock", "switch-profile", "logout"]) assert.ok(overlay.includes(`dispatch("${action}")`), `Profile must preserve the ${action} Auth action`);
  assert.match(layout, /<ProfileAccessBoundary>\{children\}<\/ProfileAccessBoundary>[\s\S]*<ProfileIdentityOverlay \/>/u);
});

test("#1212 saves the Human Profile locally before optional BUZZ publication and keeps presentation on the canonical local Auth gateway", async () => {
  const [panel, route, localGateway] = await Promise.all([
    read("app/profile-access/profile-identity-panel.tsx"),
    read("app/api/auth/profile-presentation/route.ts"),
    read("build/local-profile-auth-gateway.ts"),
  ]);

  const saveStart = panel.indexOf("async function savePresentation");
  const saveEnd = panel.indexOf("async function finishBuzzSetup");
  const save = panel.slice(saveStart, saveEnd);
  assert.ok(saveStart >= 0 && saveEnd > saveStart);
  assert.ok(save.indexOf("/api/auth/profile-presentation") < save.indexOf("publishToBuzz(result.profile)"));
  assert.match(save, /local Profile was not rolled back/u);

  assert.match(route, /PRESENTATION_OBJECT_ID = "human-presentation"/u);
  assert.match(route, /updateProfilePresentation/u);
  assert.match(route, /writePrivateJson\(authContext, \{ domain: "settings", objectId: PRESENTATION_OBJECT_ID/u);
  assert.doesNotMatch(route, /local-buzz|BUZZ_PRIVATE_KEY|buzz-connection/u);
  assert.match(route, /localSaved: true/u);

  assert.match(localGateway, /PROFILE_PRESENTATION_API = "\/api\/auth\/profile-presentation"/u);
  assert.match(localGateway, /profilePresentationGet/u);
  assert.match(localGateway, /profilePresentationPost/u);
  assert.match(localGateway, /handlers: Object\.freeze\(\{ GET: profilePresentationGet, POST: profilePresentationPost \}\)/u);
});

test("#1212 BUZZ identity gateway creates, imports, disconnects and publishes only through the active Human credential seam", async () => {
  const [gateway, credentials, vite] = await Promise.all([
    read("build/buzz-profile-identity-gateway.ts"),
    read("build/local-credentials.ts"),
    read("vite.config.ts"),
  ]);

  assert.match(gateway, /createECDH\("secp256k1"\)/u);
  assert.match(gateway, /action === "create"/u);
  assert.match(gateway, /action === "import"/u);
  assert.match(gateway, /action === "disconnect"/u);
  assert.match(gateway, /action === "publish-profile"/u);
  assert.match(gateway, /recoveryPrivateKey: privateKey/u);
  assert.match(gateway, /"users", "set-profile", "--name", displayName, "--about", bio/u);
  assert.match(gateway, /args\.push\("--avatar", picture\)/u);
  assert.match(gateway, /BUZZ_PRIVATE_KEY: connection\.privateKey/u);
  assert.doesNotMatch(gateway, /--private-key|--nsec/u);
  assert.match(gateway, /identitySource === "imported"[\s\S]*agentIdForDisplayName/u);
  assert.match(gateway, /A PlotPickle agent BUZZ identity cannot be connected as the Human Profile/u);
  assert.match(gateway, /writeCredentialJson\(CONNECTION_FILE/u);

  assert.match(credentials, /PROFILE_SCOPED_BUZZ_CREDENTIAL = "buzz-connection\.json"/u);
  assert.match(credentials, /privateStorage\.readCredential\(profileContext\.authContext, safeName\)/u);
  assert.match(credentials, /privateStorage\.writeCredential\(profileContext\.authContext, safeName, value\)/u);

  const context = vite.indexOf("profileScopedBuzzRequestContext()");
  const profileIdentity = vite.indexOf("buzzProfileIdentityGateway()");
  const humanGuard = vite.indexOf("buzzHumanIdentityGuard()");
  assert.ok(context >= 0 && profileIdentity > context && humanGuard > profileIdentity, "the authenticated Human scope must wrap BUZZ identity mutation and Community verification");
});

test("#1212 Profile keeps Node, agent and Guest authority separate from the Human BUZZ signer", async () => {
  const [panel, guard, boundary] = await Promise.all([
    read("app/profile-access/profile-identity-panel.tsx"),
    read("build/buzz-human-identity-guard.ts"),
    read("app/profile-access/profile-access-boundary.tsx"),
  ]);

  assert.match(panel, /BUZZ is optional/u);
  assert.match(panel, /PlotPickle continues normally/u);
  assert.match(guard, /kind: "agent"/u);
  assert.match(guard, /humanCommunityAllowed: false/u);
  assert.match(boundary, /Guest cannot see Human profiles, projects, recent items, credentials, agents, or BUZZ identities/u);
  assert.match(boundary, /Use isolated Guest/u);
});
