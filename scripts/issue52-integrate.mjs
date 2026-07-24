import { readFile, writeFile } from "node:fs/promises";

async function replace(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) throw new Error(`Integration pattern not found in ${path}: ${before.slice(0, 90)}`);
  await writeFile(path, source.replace(before, after));
}

await replace(
  "app/github-collaboration.tsx",
  'import { applyReviewedGitHubProject, compareCollaborativeProjects } from "@/lib/github-collaboration";\nimport type { PlotPickleProject } from "@/lib/project";',
  'import { applyReviewedGitHubProject, compareCollaborativeProjects } from "@/lib/github-collaboration";\nimport { buildProposalSummary, latestProposalPacket } from "@/lib/collaboration-handbook";\nimport type { PlotPickleProject } from "@/lib/project";',
);

await replace(
  "app/github-collaboration.tsx",
  '  const comparison = useMemo(() => incoming ? compareCollaborativeProjects(project, incoming.project) : null, [incoming, project]);\n  const openProposals = proposals.filter((item) => item.state === "open" || item.state === "draft").length;',
  '  const comparison = useMemo(() => incoming ? compareCollaborativeProjects(project, incoming.project) : null, [incoming, project]);\n  const latestPacket = useMemo(() => latestProposalPacket(project), [project]);\n  const openProposals = proposals.filter((item) => item.state === "open" || item.state === "draft").length;',
);

await replace(
  "app/github-collaboration.tsx",
  '  async function loadProposals() {\n    if (!status.connected) return;',
  '  function useLatestProposalPacket() {\n    if (!latestPacket) {\n      setNotice("Create and save a proposal review packet in Working Together before loading it here.");\n      return;\n    }\n    setProposalTitle(latestPacket.title);\n    setProposalNote(buildProposalSummary(latestPacket));\n    setNotice("The latest saved proposal review packet now supplies the title and contributor note. Review both before submission.");\n  }\n\n  async function loadProposals() {\n    if (!status.connected) return;',
);

await replace(
  "app/github-collaboration.tsx",
  '      <div className={styles.status} role="status">{notice}</div>\n\n      <div className={styles.grid}>',
  '      <div className={styles.status} role="status">{notice}</div>\n\n      <section className={styles.handbookCallout}>\n        <div><p>Contributor operating agreement</p><h3>Define the relationship before connecting the repository.</h3><span>Choose the collaboration model, record roles and authority, issue a bounded contribution brief, prepare the proposal packet, categorize review notes and log the canon decision.</span></div>\n        <a href="/collaboration-handbook">Open Working Together in PlotPickle</a>\n      </section>\n\n      <div className={styles.grid}>',
);

await replace(
  "app/github-collaboration.tsx",
  '            <label className={styles.wide}><span>Contributor note</span><textarea rows={4} value={proposalNote} onChange={(event) => setProposalNote(event.target.value)} placeholder="Explain what changed, why, and anything the owner should inspect closely." /></label>\n          </div>\n          <div className={styles.baseState}',
  '            <label className={styles.wide}><span>Contributor note</span><textarea rows={8} value={proposalNote} onChange={(event) => setProposalNote(event.target.value)} placeholder="Explain what changed, why, affected areas, dependencies, rights and anything the owner should inspect closely." /></label>\n          </div>\n          {latestPacket ? <div className={styles.packetState}><span>Latest saved review packet</span><strong>{latestPacket.title}</strong><small>{latestPacket.status} · {latestPacket.affectedAreas.length} affected area{latestPacket.affectedAreas.length === 1 ? "" : "s"} · base {latestPacket.baseRevision || "not recorded"}</small></div> : <p className={styles.help}>No structured proposal packet is saved yet. The proposal can still be submitted, but Working Together provides the fuller purpose, scope, evidence, dependency and rights review.</p>}\n          <div className={styles.baseState}',
);

await replace(
  "app/github-collaboration.tsx",
  '          <div className={styles.actions}>\n            <button type="button" className={styles.primary} disabled={working || !status.connected} onClick={() => void submitProposal()}>Submit changes for owner approval</button>\n            <button type="button" disabled={!status.connected} onClick={() => void loadProposals()}>Refresh proposals</button>\n          </div>',
  '          <div className={styles.actions}>\n            <button type="button" disabled={!latestPacket} onClick={useLatestProposalPacket}>Use latest review packet</button>\n            <button type="button" className={styles.primary} disabled={working || !status.connected} onClick={() => void submitProposal()}>Submit changes for owner approval</button>\n            <button type="button" disabled={!status.connected} onClick={() => void loadProposals()}>Refresh proposals</button>\n          </div>',
);

const collaborationCss = await readFile("app/github-collaboration.module.css", "utf8");
if (!collaborationCss.includes(".handbookCallout")) {
  await writeFile("app/github-collaboration.module.css", `${collaborationCss}\n\n.handbookCallout {\n  display: flex;\n  gap: 24px;\n  align-items: center;\n  justify-content: space-between;\n  padding: 22px 24px;\n  border: 1px solid #b9d5d0;\n  border-radius: 18px;\n  background: #e8f4f1;\n}\n\n.handbookCallout p { margin: 0 0 4px; color: #33756d; font-size: 12px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }\n.handbookCallout h3 { margin: 0; color: #173d38; }\n.handbookCallout span { display: block; max-width: 900px; margin-top: 8px; color: #58736f; line-height: 1.5; }\n.handbookCallout a { flex: 0 0 auto; border: 1px solid #17685f; border-radius: 999px; padding: 11px 16px; background: #17685f; color: #fff; font-weight: 750; text-decoration: none; }\n\n.packetState { display: grid; gap: 4px; margin: 12px 0; padding: 14px 16px; border: 1px solid #c8dcd8; border-radius: 14px; background: #f4f9f8; }\n.packetState span { color: #33756d; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }\n.packetState small { color: #67807c; }\n\n@media (max-width: 760px) {\n  .handbookCallout { align-items: flex-start; flex-direction: column; }\n}\n`);
}

await replace(
  "app/pitch-review-workspace.tsx",
  '        <div className={styles.metrics}>\n          <article><strong>{counts.open}</strong><span>active review threads</span></article>\n          <article><strong>{counts.resolved}</strong><span>resolved threads</span></article>\n          <article><strong>{counts.revisions}</strong><span>revision snapshots</span></article>\n          <article><strong>{counts.candidates}</strong><span>saved loglines</span></article>\n        </div>\n      </header>',
  '        <div className={styles.metrics}>\n          <article><strong>{counts.open}</strong><span>active review threads</span></article>\n          <article><strong>{counts.resolved}</strong><span>resolved threads</span></article>\n          <article><strong>{counts.revisions}</strong><span>revision snapshots</span></article>\n          <article><strong>{counts.candidates}</strong><span>saved loglines</span></article>\n        </div>\n        <a className={styles.handbookLink} href="/collaboration-handbook#reviews"><strong>Working Together</strong><span>Open contribution briefs, categorized feedback, authority and canon decisions</span></a>\n      </header>',
);

await replace(
  "app/pitch-review-workspace.tsx",
  '          <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as ReviewPriority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label>',
  '          <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as ReviewPriority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label>\n          <p className={styles.reviewGuide}>For required, continuity, rights, craft, question, preference and praise categories—with explicit accepted, requested, deferred, declined or superseded outcomes—use the <a href="/collaboration-handbook#reviews">Working Together review method</a>.</p>',
);

const pitchCss = await readFile("app/pitch-review-workspace.module.css", "utf8");
if (!pitchCss.includes(".handbookLink")) {
  await writeFile("app/pitch-review-workspace.module.css", `${pitchCss}\n\n.handbookLink {\n  display: grid;\n  gap: 3px;\n  grid-column: 1 / -1;\n  padding: 13px 16px;\n  border: 1px solid #b9d5d0;\n  border-radius: 14px;\n  background: #e8f4f1;\n  color: #174d47;\n  text-decoration: none;\n}\n.handbookLink span { color: #58736f; font-size: 13px; }\n.reviewGuide { padding: 12px 14px; border: 1px solid #d4e3e0; border-radius: 12px; background: #f6faf9; color: #58736f; line-height: 1.5; }\n.reviewGuide a { color: #17685f; font-weight: 750; }\n`);
}

console.log("Issue 52 integration patch applied.");
