/** Total source-registered agent census: profiles, role-only Mastra specialists,
 * process workers, developer adapters and BUZZ directories. This is NOT a
 * readiness test or evidence of any completed LLM/BUZZ response.
 */
export function buildAgentHealthCensus({ profiles, roleIds, workers, developers, guildhallActorIds, playhouseIds, dynamicPeers = [] }) {
  const entries = new Map();
  const append = (key, item, source) => {
    const original = entries.get(key);
    if (original) {
      original.sources.push(source);
      if (item.roleId && !original.roleId) original.roleId = item.roleId;
      return;
    }
    entries.set(key, { ...item, id: key, sources: [source] });
  };
  const profileList = Array.isArray(profiles) ? profiles : [];
  const roleList = Array.isArray(roleIds) ? roleIds : [];
  const workerList = Array.isArray(workers) ? workers : [];
  const developerList = Array.isArray(developers) ? developers : [];
  const actorList = Array.isArray(guildhallActorIds) ? guildhallActorIds : [];
  const directory = Array.isArray(playhouseIds) ? playhouseIds : [];
  const profileRoleIds = new Set();
  for (const profile of profileList) {
    if (!profile?.id || !profile?.displayName || !profile?.execution?.kind) continue;
    const roleId = profile.execution.kind === "embedded-mastra" ? profile.execution.roleId : null;
    if (roleId) profileRoleIds.add(roleId);
    append(profile.id, {
      name: profile.displayName, owner: profile.execution.kind,
      roleId, profileId: profile.id,
      testMode: roleId ? "mastra" : "not-callable",
    }, "profile");
  }
  for (const role of roleList) {
    if (typeof role !== "string" || !role) continue;
    const existing = [...entries.values()].find(x => x.roleId === role);
    if (existing) { existing.sources.push("mastra-role"); continue; }
    append("mastra-role:" + role, { name: role, owner: "embedded-mastra", roleId: role, profileId: null, testMode: "mastra" }, "mastra-role");
  }
  for (const worker of workerList) {
    if (typeof worker?.agentId !== "string" || !worker.agentId) continue;
    append("production-worker:" + worker.agentId, { name: worker.agentId, owner: "production-worker", roleId: null, testMode: "not-callable" }, "production-supervisor");
  }
  append("production-supervisor", { name: "Production Supervisor", owner: "production-supervisor", roleId: null, testMode: "not-callable" }, "production-supervisor");
  for (const developer of developerList) {
    if (typeof developer?.id !== "string" || !developer.id) continue;
    append("external-developer:" + developer.id, { name: developer.label || developer.id, owner: "external-developer", roleId: null, testMode: "not-callable" }, "developer-stack");
  }
  for (const actor of actorList) {
    if (typeof actor !== "string" || !actor) continue;
    if (entries.has(actor)) entries.get(actor).sources.push("guildhall");
    else append("buzz-actor:" + actor, { name: actor, owner: "buzz-actor", roleId: null, testMode: "not-callable" }, "guildhall");
  }
  for (const id of directory) {
    if (typeof id !== "string" || !id) continue;
    if (entries.has(id)) entries.get(id).sources.push("playhouse");
    else append("playhouse-only:" + id, { name: id, owner: "community-directory", roleId: null, testMode: "not-callable" }, "playhouse");
  }
  // Only verified identities from authenticated BUZZ discovery may enter this input.
  for (const peer of Array.isArray(dynamicPeers) ? dynamicPeers : []) {
    if (typeof peer?.id !== "string" || !/^[a-z0-9-]{3,80}$/.test(peer.id)) continue;
    append("buzz-peer:" + peer.id, { name: peer.name || peer.id, owner: "external-buzz-peer", roleId: null, testMode: "not-callable" }, "buzz-discovered");
  }
  const warnings = [];
  for (const p of profileList) {
    if (p?.execution?.kind === "buzz-managed" && !actorList.includes(p.buzzBinding?.actorId))
      warnings.push("BUZZ managed profile " + p.id + " has no Guildhall actor entry; live identity and I/O unproven.");
  }
  for (const role of roleList) if (!profileRoleIds.has(role)) warnings.push("Mastra role " + role + " has no named profile; retained as a role-only entry.");
  return {
    entries: [...entries.values()],
    sources: { profiles: profileList.length, mastraRoles: roleList.length, guildhallActors: actorList.length, playhouseDirectory: directory.length,
      productionWorkers: workerList.length, externalDevelopers: developerList.length, discoveredPeers: (dynamicPeers || []).length },
    warnings,
    dynamicBuzzDiscovery: "not-available-in-current-official-roster-api",
  };
}
