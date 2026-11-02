import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAgentMission, readLatestAgentMission }
  from "../scripts/engineering-team/gateway/agent-mission-store.mjs";
import { dispatchAgentMissionRequest }
  from "../scripts/engineering-team/gateway/agent-mission-http.mjs";

const HEAD = "a".repeat(40);
const NEXT = "b".repeat(40);
const source = { channel: "main", head: HEAD };
const scope = label => createHash("sha256").update(label).digest("hex");
const auth = (label = "alpha", now = 1_800_000_000_000,
  operations = ["mission.create", "mission.read"]) => ({
  verified: true, profileScopeDigest: scope(label),
  sourceHead: HEAD, sourceChannel: "main", expiresAt: now + 30_000,
  permittedOperations: operations,
});
const root = async fn => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "plotpickle-mission-3355-"));
  try { await fn(temp); } finally { await rm(temp, { recursive: true, force: true }); }
};

test("one local Human creates a durable non-delegated mission and reads it back", async () => root(async folder => {
  const now = 1_800_000_000_000;
  const a = auth("alpha", now);
  const goal = "Review the first Agent Workspace acceptance evidence";
  const created = await createAgentMission({ root: folder, source, authorization: a, goal, now });
  assert.equal(created.code, "MISSION_DRAFT");
  assert.match(created.missionId, /^[a-f0-9]{32}$/);
  assert.equal(created.state, "DRAFT_NOT_DELEGATED");
  assert.equal(created.specialist, "NOT_ASSIGNED");
  assert.equal(created.delegated, false);
  assert.equal(created.releaseAuthorized, false);
  assert.equal(created.modelInvoked, false);
  const recorded = await readLatestAgentMission({
    root: folder, source, authorization: a, now,
  });
  assert.deepEqual(recorded, created);
  const files = await readdir(path.join(folder, "agent-workspace", scope("alpha")));
  assert.deepEqual(files, [created.missionId + ".json"]);
  const bytes = await readFile(path.join(folder, "agent-workspace",
    scope("alpha"), files[0]), "utf8");
  assert.equal(JSON.parse(bytes).goal, goal);
}));

test("profile scope and permission checks refuse reads and writes", async () => root(async folder => {
  const now = 1_800_000_000_000;
  const a = auth("alpha", now);
  assert.equal((await readLatestAgentMission({
    root: folder, source, authorization: a, now,
  })).code, "MISSION_NONE");
  assert.equal((await createAgentMission({ root: folder, source,
    authorization: { ...a, verified: false }, goal: "One safe goal", now
  })).code, "MISSION_AUTHORITY_UNVERIFIED");
  assert.equal((await createAgentMission({ root: folder, source,
    authorization: { ...a, permittedOperations: ["mission.read"] },
    goal: "One safe goal", now
  })).code, "MISSION_AUTHORITY_UNVERIFIED");
  assert.equal((await createAgentMission({ root: folder, source,
    authorization: { ...a, sourceHead: NEXT },
    goal: "One safe goal", now
  })).code, "MISSION_AUTHORITY_UNVERIFIED");
  assert.equal((await createAgentMission({ root: folder, source,
    authorization: { ...a, expiresAt: now - 1 },
    goal: "One safe goal", now
  })).code, "MISSION_AUTHORITY_UNVERIFIED");
  const created = await createAgentMission({
    root: folder, source, authorization: a, goal: "One safe goal", now,
  });
  assert.equal(created.code, "MISSION_DRAFT");
  assert.equal((await readLatestAgentMission({
    root: folder, source, authorization: auth("bravo", now), now,
  })).code, "MISSION_NONE");
}));

test("new source or expiry never silently reauthorizes an old mission", async () => root(async folder => {
  const now = 1_800_000_000_000;
  const created = await createAgentMission({
    root: folder, source, authorization: auth("alpha", now),
    goal: "Document a future specialist grant", now,
  });
  assert.equal(created.code, "MISSION_DRAFT");
  const laterSource = { channel: "main", head: NEXT };
  const laterAuth = { ...auth("alpha", now + 3_000),
    sourceHead: NEXT };
  assert.equal((await readLatestAgentMission({
    root: folder, source: laterSource, authorization: laterAuth,
    now: now + 3_000,
  })).code, "MISSION_SOURCE_REVIEW_REQUIRED");
  assert.equal((await readLatestAgentMission({
    root: folder, source, authorization: auth("alpha", now + 86_400_001),
    now: now + 86_400_001,
  })).code, "MISSION_EXPIRED");
}));

test("forged contents and redirected storage fail closed", async () => root(async folder => {
  const now = 1_800_000_000_000;
  const created = await createAgentMission({
    root: folder, source, authorization: auth("alpha", now),
    goal: "Review and retain exact evidence", now,
  });
  const file = path.join(folder, "agent-workspace", scope("alpha"),
    created.missionId + ".json");
  const stored = JSON.parse(await readFile(file, "utf8"));
  stored.state = "MERGED";
  await writeFile(file, JSON.stringify(stored));
  assert.equal((await readLatestAgentMission({ root: folder, source,
    authorization: auth("alpha", now), now })).code,
    "MISSION_READ_UNVERIFIED");
}));
test("symlinked mission folder cannot be a write target", async () => root(async folder => {
  const other = await mkdtemp(path.join(os.tmpdir(), "plotpickle-mission-outside-"));
  try {
    await symlink(other, path.join(folder, "agent-workspace"), "dir");
    const result = await createAgentMission({ root: folder, source,
      authorization: auth(), goal: "This must not escape the gateway",
      now: 1_800_000_000_000 });
    assert.equal(result.code, "MISSION_WRITE_UNVERIFIED");
    assert.deepEqual(await readdir(other), []);
  } finally { await rm(other, { recursive: true, force: true }); }
}));

test("unreviewed input, secrets and source mismatch are never accepted", async () => root(async folder => {
  const now = 1_800_000_000_000;
  for(const goal of ["", "  not trimmed  ", "sk-12345678901234567890",
    "line\nbreak", "x".repeat(181)]) {
    const res = await createAgentMission({ root: folder, source,
      authorization: auth("alpha", now), goal, now });
    assert.equal(res.code, "MISSION_GOAL_INVALID");
  }
  assert.equal((await createAgentMission({ root: folder, source: {channel:"candidate",head:HEAD},
    authorization: auth("alpha",now), goal:"One safe goal", now })).code,
    "MISSION_AUTHORITY_UNVERIFIED");
}));

const request = (method, body, origin = "http://127.0.0.1:4173") =>
  new Request("http://127.0.0.1:4173/api/factory/mission", {
    method,
    headers: method === "POST" ? {
      origin, "content-type": "application/json", "sec-fetch-site": "same-origin",
    } : {},
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
const observedMission = async (folder, req, principal = {
  profileId: "profile-test-alpha", nodeId: "local-node-test",
}) => dispatchAgentMissionRequest({
  root: folder, request: req, platform: "win32", now: 1_800_000_000_000,
  source: async () => source, authorize: async () => principal,
});

test("profile-authenticated local HTTP draft creates durable source-bound readback", async () => root(async folder => {
  const before = await observedMission(folder, request("GET"));
  assert.equal(before.status, 200);
  assert.equal((await before.json()).code, "MISSION_NONE");
  const created = await observedMission(folder, request("POST", {
    action: "create-draft", goal: "Record a mission before specialist delegation",
  }));
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.code, "MISSION_DRAFT");
  assert.equal(body.delegated, false);
  assert.equal(body.releaseAuthorized, false);
  const later = await observedMission(folder, request("GET"));
  assert.equal(later.status, 200);
  assert.equal((await later.json()).missionId, body.missionId);
  assert.equal((await observedMission(folder, request("GET"),{
    profileId:"another-profile",nodeId:"local-node-test",
  }).then(x=>x.json())).code, "MISSION_NONE");
}));

test("HTTP boundary rejects unauthorized, cross-origin and executable actions", async () => root(async folder => {
  const deniedRequest = request("POST", {action:"create-draft",goal:"One safe goal"});
  const unauth = await dispatchAgentMissionRequest({
    root: folder, request: deniedRequest, platform: "win32",
    now: 1_800_000_000_000, source:async()=>source,
    authorize: async()=>{throw Error("locked");},
  });
  assert.equal(unauth.status,403);
  assert.equal((await unauth.json()).code,"PROFILE_SESSION_REQUIRED");
  const cross = await observedMission(folder, request("POST", {
    action:"create-draft",goal:"One safe goal",
  },"http://evil.example"));
  assert.equal(cross.status,403);
  const executable = await observedMission(folder, request("POST",{
    action:"run-agent",goal:"One safe goal",
  }));
  assert.equal(executable.status,400);
  assert.equal((await executable.json()).code,"MISSION_ACTION_NOT_AUTHORIZED");
  const badIdentity = await observedMission(folder, request("POST",{
    action:"create-draft",goal:"One safe goal",
  }), { profileId:"",nodeId:"local-node-test" });
  assert.equal(badIdentity.status,403);
  const none = await observedMission(folder,request("GET"));
  assert.equal((await none.json()).code,"MISSION_NONE");
}));

test("HTTP route uses live profile authorization and no alternate mission issuer", async () => {
  const [route,gateway] = await Promise.all([
    readFile(new URL("../app/api/factory/mission/route.ts", import.meta.url),"utf8"),
    readFile(new URL("../build/local-profile-auth-gateway.ts", import.meta.url),"utf8"),
  ]);
  assert.match(route,/getProfileExperienceRuntime/);
  assert.match(route,/authorizeRequest/);
  assert.match(route,/recentReauthentication: true/);
  assert.match(route,/authContext.profileId/);
  assert.match(gateway,/\["\/api\/factory\/mission"/);
  assert.match(gateway,/maximumBodyBytes: 512/);
});
