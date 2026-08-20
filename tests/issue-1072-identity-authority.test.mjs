import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase A fixes the Person, Avatar and Node cardinality without making auth the identity authority", async () => {
  const doc = await read("docs/architecture/IDENTITY-AUTHORITY.md");
  assert.match(doc, /Person 1 ---- 1 Avatar/);
  assert.match(doc, /Person 1 ---- N Authorized Nodes/);
  assert.match(doc, /Node   1 ---- 1 local Ed25519 keypair/);
  assert.match(doc, /person_id/);
  assert.match(doc, /avatar_id/);
  assert.match(doc, /node_id/);
  assert.match(doc, /Better Auth/);
  assert.match(doc, /changing those providers must not change `person_id`/);
  assert.match(doc, /provider_subject/);
});

test("public Community authority belongs to Avatar while Node signatures preserve device provenance", async () => {
  const doc = await read("docs/architecture/IDENTITY-AUTHORITY.md");
  assert.match(doc, /Public Community moderation, public trust and public reputation attach to `avatar_id`/);
  assert.match(doc, /`node_id` plus the Node signature identifies which authorized device signed\/sent it/);
  assert.match(doc, /BUZZ remains transport and signed provenance/);
  assert.match(doc, /BUZZ.*not a second human identity authority/is);
  assert.match(doc, /No account credential, auth-provider token or private Node key belongs in a BUZZ message/);
});

test("existing #927 Studio identity is preserved as the compatibility Node identity", async () => {
  const [doc, studio] = await Promise.all([
    read("docs/architecture/IDENTITY-AUTHORITY.md"),
    read("build/studio-identity.ts"),
  ]);
  assert.match(studio, /generateKeyPairSync\("ed25519"\)/);
  assert.match(studio, /studioId: `pp_studio_\$\{idCode\}`/);
  assert.match(studio, /readCredentialJson<unknown>\(FILE\)/);
  assert.match(studio, /writeCredentialJson\(FILE, identity\)/);
  assert.match(studio, /if \(existing\) return publicIdentity\(existing, now\)/);
  assert.match(doc, /existing StudioIdentity\.studioId     -> node_id \(same opaque value\)/);
  assert.match(doc, /Existing `pp_studio_XXXXXXXX` values must not be rewritten/);
  assert.match(doc, /private key stays local/i);
});

test("renaming Studio presentation cannot rotate the existing Node signing identity", async () => {
  const source = await read("build/studio-identity.ts");
  const rename = source.match(/export async function renameStudioIdentity[\s\S]*?\n}/)?.[0] || "";
  assert.match(rename, /identity\.prefix = prefix/);
  assert.match(rename, /identity\.displayName = studioDisplayName\(prefix\)/);
  assert.doesNotMatch(rename, /generateKeyPairSync|studioId\s*=|signing\s*=/);
});

test("legacy #928 signed Studio events map to Node provenance without rewriting history", async () => {
  const [doc, federation] = await Promise.all([
    read("docs/architecture/IDENTITY-AUTHORITY.md"),
    read("build/playhouse-federation.ts"),
  ]);
  assert.match(federation, /readStudioSigningIdentity/);
  assert.match(federation, /sign\(null/);
  assert.match(federation, /studioId: identity\.studioId/);
  assert.match(doc, /legacy event studioId -> signing node_id/);
  assert.match(doc, /existing signed `studioId` history remains verifiable and is not rewritten/);
  assert.match(doc, /future event version may add explicit `avatarId` and `nodeId`/);
});

test("#1013 topology routing id remains separate from cryptographic Node identity", async () => {
  const [doc, topology] = await Promise.all([
    read("docs/architecture/IDENTITY-AUTHORITY.md"),
    read("lib/plotpickle-node-topology-core.mjs"),
  ]);
  assert.match(topology, /id: input\.id \|\| "local-desktop"/);
  assert.match(doc, /routing\/topology descriptor identifier/);
  assert.match(doc, /It is not yet cryptographic identity and must not be treated as `node_id`/);
  assert.match(doc, /Compute capability grants no canon, credential, account or moderation authority/);
});

test("Phase A includes the required schema proposal and five migration sequences", async () => {
  const doc = await read("docs/architecture/IDENTITY-AUTHORITY.md");
  for (const table of ["people", "avatars", "node_authorizations", "auth_account_links", "node_capabilities"]) {
    assert.match(doc, new RegExp(`(?:^|\\r?\\n)${table}\\r?\\n`, "u"));
  }
  for (const sequence of [
    "First install, local-only",
    "First account claim / Avatar claim",
    "Second device authorization",
    "Node revocation",
    "BUZZ send",
  ]) {
    assert.ok(doc.includes(`### ${sequence}`), `missing sequence: ${sequence}`);
  }
  assert.equal((doc.match(/```mermaid/g) || []).length, 5);
});

test("Phase A explicitly defers account, sync, mobile, public compute and remote BUILD runtime", async () => {
  const doc = await read("docs/architecture/IDENTITY-AUTHORITY.md");
  assert.match(doc, /does not implement account login, cloud synchronization, mobile UI, public compute or remote BUILD/);
  assert.match(doc, /Phase B \(#1073\)/);
  assert.match(doc, /Starting PlotPickle does not auto-publish device identity or compute capability/);
  assert.match(doc, /No Node private key is copied to another Node/);
  assert.match(doc, /No private key is stored in PPF/);
});
