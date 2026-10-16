"use client";

/* eslint-disable @next/next/no-img-element -- Private local image files have no public Next image loader. */
import { useEffect, useMemo, useState } from "react";
import { authenticatedComputeFetch } from "../../core/auth/profile-request-browser";
import {
  WORLD_MAP_CHARACTER_VIEWS,
  WORLD_MAP_CHARACTER_MAX_VERSIONS,
  saveWorldMapCharacterVisualVersion,
  lockWorldMapCharacterVisualVersion,
  worldMapCharacterVisualVersions,
  worldMapCharacterVisualPackage,
  upsertWorldMapCharacterVisualPackage,
  type WorldMapCharacterView,
  type WorldMapCharacterVisualReference,
} from "../../core/contracts/world-map";
import type { LibraryPPFProject } from "../../core/storage/library-project";
import {
  loadLibraryProjectSnapshot, saveActiveLibraryProject, sessionActiveProjectId,
} from "../../core/storage/project-library-browser";
import { flushProfilePrivateWrites, persistActiveProfileProject } from "../../core/storage/profile-private-browser";
import {
  mindMapCharacterRoster,
  mindMapCharacterVisualGenerationPlan,
  mindMapCharacterVisualPrompt,
} from "../../modules/learn/model/mind-map-character-roster";
import styles from "./assets-characters.module.css";

type ImageResult = { ok?: boolean; assetUrl?: string; revisedPrompt?: string; provider?: string; model?: string; message?: string };
type Candidate = {
  projectId: string; revision: number; characterId: string; versionId: string;
  view: WorldMapCharacterView; assetUrl: string; prompt: string; provider: string; model: string;
};
type Props = {
  project: LibraryPPFProject;
  routeId: string;
  routeReady: boolean;
  cloud: boolean;
  onSaved: (project: LibraryPPFProject) => void;
  onManageCharacterTruth: () => void;
};

function validateProject(id: string, revision: number) {
  if (sessionActiveProjectId() !== id) throw new Error("The active Library story changed. Reload ASSETS before continuing.");
  if (loadLibraryProjectSnapshot(id)?.revision !== revision) {
    throw new Error("Project source changed. Reload this character before saving or locking.");
  }
}

async function verifyLocalImage(url: string) {
  if (!/^\/api\/local-ai\/assets\/[a-z0-9-]+\.(?:webp|png|jpe?g)$/iu.test(url)) {
    throw new Error("The image route returned an unsupported local character asset.");
  }
  const response = await authenticatedComputeFetch(url, { cache: "no-store" });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/") || !(await response.arrayBuffer()).byteLength) {
    throw new Error("Character image bytes are missing or unreadable. Save and Lock are blocked.");
  }
}

async function durableSave(previous: LibraryPPFProject, next: LibraryPPFProject, proof: (saved: LibraryPPFProject) => boolean) {
  validateProject(previous.id, previous.revision);
  const saved = saveActiveLibraryProject(next);
  if (saved.id !== previous.id) throw new Error("The Library did not retain the selected project identity.");
  await persistActiveProfileProject();
  await flushProfilePrivateWrites();
  if (sessionActiveProjectId() !== previous.id) throw new Error("The selected Library project changed during Save.");
  const readback = loadLibraryProjectSnapshot(previous.id);
  if (!readback || readback.revision !== next.revision || !proof(readback)) {
    throw new Error("The saved character reference did not survive exact project read-back.");
  }
  return readback;
}

export default function AssetsCharacters({ project, routeId, routeReady, cloud, onSaved, onManageCharacterTruth }: Props) {
  const roster = useMemo(() => mindMapCharacterRoster(project), [project]);
  const [characterId, setCharacterId] = useState("");
  const [selectedView, setSelectedView] = useState<WorldMapCharacterView>("front-full-body");
  const [direction, setDirection] = useState("");
  const [paidConsent, setPaidConsent] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (roster.length && !roster.some((item) => item.id === characterId)) setCharacterId(roster[0].id);
    if (!roster.length) setCharacterId("");
  }, [characterId, roster]);
  useEffect(() => { setCandidate(null); setPaidConsent(false); setStatus(""); }, [project.id]);
  const selected = roster.find((item) => item.id === characterId) ?? null;
  const versions = selected ? worldMapCharacterVisualVersions(project.worldMap, selected.id) : [];
  const lockedId = selected ? worldMapCharacterVisualPackage(project.worldMap, selected.id)?.lockedVersionId : null;
  const plan = selected ? mindMapCharacterVisualGenerationPlan(project, selected.id, new Date().toISOString()) : null;
  const selectedViewInfo = WORLD_MAP_CHARACTER_VIEWS.find((view) => view.id === selectedView);

  async function generate() {
    if (!selected || !plan?.versionId || !routeReady || saving || (cloud && !paidConsent)) return;
    setSaving(true);
    setStatus("Generating an unsaved reference for " + selected.name + "…");
    try {
      validateProject(project.id, project.revision);
      const canonicalPrompt = mindMapCharacterVisualPrompt(project, selected.id, selectedView);
      if (!canonicalPrompt) throw new Error("This character needs saved Character Truth before visual generation.");
      const directionText = direction.trim();
      const prompt = canonicalPrompt + (directionText ? "\nHuman visual direction (not story canon): " + directionText.slice(0, 1200) : "");
      const response = await authenticatedComputeFetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, characterId: selected.id,
          assetId: `assets-character-${project.id.replace(/[^a-z0-9-]/giu, "-")}-${Date.now()}`,
          aspect: "portrait", requestCount: 1,
          referenceImages: plan.approvedReferenceImages,
          identityLock: { characterId: selected.id, source: "world-map-locked-character-reference", approvedReferences: plan.approvedReferenceImages },
          billingAcknowledged: cloud && paidConsent,
        }),
      });
      const image = await response.json() as ImageResult;
      if (!response.ok || !image.ok || !image.assetUrl) throw new Error(image.message || "The configured image route returned no image.");
      await verifyLocalImage(image.assetUrl);
      validateProject(project.id, project.revision);
      setCandidate({
        projectId: project.id, revision: project.revision, characterId: selected.id,
        versionId: plan.versionId, view: selectedView, assetUrl: image.assetUrl,
        prompt: image.revisedPrompt?.trim() || prompt, provider: image.provider || routeId, model: image.model || routeId,
      });
      setStatus("Candidate generated. Review the image, then select Save view; it is not yet approved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Character visual generation failed.");
    } finally { setSaving(false); }
  }

  async function saveView() {
    if (!selected || !candidate || saving) return;
    setSaving(true);
    try {
      if (candidate.projectId !== project.id || candidate.characterId !== selected.id || candidate.revision !== project.revision) {
        throw new Error("Candidate belongs to another character, story or revision. Regenerate before saving.");
      }
      validateProject(project.id, project.revision);
      await verifyLocalImage(candidate.assetUrl);
      const freshPlan = mindMapCharacterVisualGenerationPlan(project, selected.id, new Date().toISOString());
      // A brand-new version receives a generated timestamp; its ID need not match
      // a second timestamp computed at Save. Existing partial sets must match.
      if (!freshPlan.versionId || (freshPlan.existingReferences.length && freshPlan.versionId !== candidate.versionId)
        || (versions.some((version) => version.id === candidate.versionId) && !freshPlan.existingReferences.length)) {
        throw new Error("The editable character version has changed. Regenerate before saving.");
      }
      const now = new Date().toISOString();
      const reference: WorldMapCharacterVisualReference = {
        id: globalThis.crypto.randomUUID(), versionId: candidate.versionId,
        characterId: selected.id, characterName: selected.name, view: candidate.view,
        assetUrl: candidate.assetUrl, prompt: candidate.prompt,
        provider: candidate.provider, model: candidate.model, createdAt: now, reviewState: "draft",
      };
      const worldMap = saveWorldMapCharacterVisualVersion(project.worldMap, {
        characterId: selected.id, characterName: selected.name, versionId: candidate.versionId,
        references: [...freshPlan.existingReferences.filter((item) => item.view !== candidate.view), reference],
        savedAt: now,
      });
      const next: LibraryPPFProject = { ...project, revision: project.revision + 1, updatedAt: now, worldMap };
      const saved = await durableSave(project, next, (entry) => worldMapCharacterVisualVersions(entry.worldMap, selected.id)
        .some((v) => v.id === reference.versionId && v.references.some((item) => item.id === reference.id && item.assetUrl === reference.assetUrl)));
      onSaved(saved);
      setCandidate(null);
      setStatus(`Saved ${selected.name} · ${selectedViewInfo?.label ?? candidate.view} as draft. Complete all eight views before Lock.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Character visual Save failed.");
    } finally { setSaving(false); }
  }

  async function changeLock(versionId: string, lock: boolean) {
    if (!selected || saving) return;
    setSaving(true);
    try {
      validateProject(project.id, project.revision);
      const version = versions.find((item) => item.id === versionId);
      if (!version) throw new Error("The selected character visual version is unavailable.");
      if (lock && !version.complete) throw new Error("Only complete eight-view versions can be locked.");
      for (const reference of version.references) if (reference.assetUrl.startsWith("/api/local-ai/assets/")) await verifyLocalImage(reference.assetUrl);
      const now = new Date().toISOString();
      let worldMap = project.worldMap;
      if (lock) {
        worldMap = lockWorldMapCharacterVisualVersion(worldMap, selected.id, versionId, now);
      } else {
        const pkg = worldMapCharacterVisualPackage(worldMap, selected.id);
        if (!pkg || pkg.lockedVersionId !== versionId) throw new Error("That version is not currently locked.");
        worldMap = upsertWorldMapCharacterVisualPackage(worldMap, {
          ...pkg, lockedVersionId: null, approvedAt: null, updatedAt: now,
          references: pkg.references.map((ref) => ({ ...ref, reviewState: "draft" as const })),
        });
      }
      const next: LibraryPPFProject = { ...project, revision: project.revision + 1, updatedAt: now, worldMap };
      const saved = await durableSave(project, next, (entry) =>
        (worldMapCharacterVisualPackage(entry.worldMap, selected.id)?.lockedVersionId ?? null) === (lock ? versionId : null));
      onSaved(saved);
      setCandidate(null);
      setStatus(`${selected.name} version ${lock ? "locked and approved" : "unlocked for review"}; saved and read back.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Character visual lock operation failed.");
    } finally { setSaving(false); }
  }

  return (
    <section className={styles.workspace} aria-label="Characters visual workspace" data-assets-folder="characters">
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>ASSETS / CHARACTERS · {project.title}</span>
          <h2>Character visual library</h2>
          <p>Choose a story character, develop production-reference views, save drafts and lock an eight-view identity for Storyboard reuse.</p>
        </div>
        <div className={styles.summary}>
          <strong>{roster.length}</strong><span>Story characters</span>
          <strong>{roster.filter((item) => item.lockedVersionId).length}</strong><span>Locked identities</span>
        </div>
      </header>
      {!roster.length ? <section className={styles.empty} role="status">
        <h3>No character roster found</h3>
        <p>Character visuals require a saved Character Truth roster for the loaded screenplay. Create or review the roster in Mind Map before generating; no identities will be guessed.</p>
        <button type="button" onClick={onManageCharacterTruth}>Open Mind Map · Characters</button>
      </section> : (
        <div className={styles.columns}>
          <aside className={styles.rail} aria-label="Screenplay character roster">
            <div className={styles.railHeader}><h3>Story roster</h3><button type="button" onClick={onManageCharacterTruth}>Edit roster</button></div>
            {roster.map((item) => (
              <button className={styles.person} type="button" key={item.id}
                aria-pressed={selected?.id === item.id}
                onClick={() => { setCharacterId(item.id); setCandidate(null); setPaidConsent(false); setStatus(""); }}>
                {item.previewUrl ? <img src={item.previewUrl} alt="" /> : <span className={styles.noPortrait}>—</span>}
                <span><strong>{item.name}</strong><small>{item.references.length} views · {item.visualVersions.length} versions</small></span>
                <em>{item.lockedVersionId ? "LOCKED" : "DRAFT"}</em>
              </button>
            ))}
          </aside>
          {selected ? <div className={styles.detail}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div><span className={styles.eyebrow}>SELECTED CHARACTER</span><h3>{selected.name}</h3><p>{selected.claims.filter((claim) => claim.reviewState === "human-approved").slice(0, 3).map((claim) => claim.summary).join(" · ") || "No Human-approved description; generation will preserve identity without assuming details."}</p></div>
                <span className={styles.state} data-state={lockedId ? "locked" : "draft"}>{lockedId ? "Approved identity" : "Development"}</span>
              </div>
              <div className={styles.versionRow}>
                <span>Saved sets: {versions.length}/{WORLD_MAP_CHARACTER_MAX_VERSIONS}</span>
                <span>Reference views: {WORLD_MAP_CHARACTER_VIEWS.length}</span>
                <span>Image route: {routeId || "Not configured"} · {routeReady ? cloud ? "Cloud (consent)" : "Ready" : "Unavailable"}</span>
              </div>
              {versions.length ? versions.map((version) => <div className={styles.version} key={version.id} data-character-visual-version={version.id}>
                <header>
                  <div><strong>{version.locked ? "Locked identity" : "Saved draft"}</strong><small>{version.references.length}/{WORLD_MAP_CHARACTER_VIEWS.length} views · {version.complete ? "Complete" : "In progress"}</small></div>
                  <button type="button" disabled={saving || (!version.complete && !version.locked)} onClick={() => void changeLock(version.id, !version.locked)}>
                    {version.locked ? "Unlock" : "Lock complete set"}
                  </button>
                </header>
                <div className={styles.grid}>
                  {WORLD_MAP_CHARACTER_VIEWS.map((view) => {
                    const ref = version.references.find((image) => image.view === view.id);
                    return <figure key={view.id} data-character-view={view.id}>
                      {ref ? <img src={ref.assetUrl} alt={`${selected.name} · ${view.label}`} /> : <div className={styles.missing}>Not generated</div>}
                      <figcaption>{view.label}<small>{ref ? version.locked ? "Approved" : "Saved draft" : "Missing"}</small></figcaption>
                    </figure>;
                  })}
                </div>
              </div>) : <div className={styles.empty}>No saved views yet. Start with Front full-body and develop a consistent set.</div>}
            </section>
            <section className={styles.panel} aria-label="Generate character reference">
              <div className={styles.panelHeading}><div><span className={styles.eyebrow}>IMAGE STUDIO</span><h3>Create a reference view</h3><p>Grounded in the selected character’s permitted truth. New images remain drafts until explicitly saved and locked.</p></div></div>
              <div className={styles.controls}>
                <label>View <select value={selectedView} onChange={(event) => { setSelectedView(event.target.value as WorldMapCharacterView); setCandidate(null); }}>
                  {WORLD_MAP_CHARACTER_VIEWS.map((view) => <option key={view.id} value={view.id}>{view.label}</option>)}
                </select></label>
                <label>Art direction (optional) <textarea value={direction} maxLength={1200} rows={3} onChange={(event) => setDirection(event.target.value)}
                  placeholder="Lighting, wardrobe or style direction — not automatically story canon." /></label>
              </div>
              {cloud ? <label className={styles.consent}><input type="checkbox" checked={paidConsent} onChange={(event) => setPaidConsent(event.target.checked)} /> Authorize one paid cloud image generation request</label> : null}
              <div className={styles.actions}>
                <button type="button" disabled={saving || !routeReady || !plan?.versionId || (cloud && !paidConsent)} onClick={() => void generate()}>{saving ? "Working…" : "Generate 1 view"}</button>
                {plan?.blockedReason ? <span>{plan.blockedReason}</span> : null}
              </div>
              {candidate && candidate.characterId === selected.id ? <div className={styles.candidate}>
                <img src={candidate.assetUrl} alt={`Unsaved ${selected.name} · ${candidate.view}`} />
                <div><span className={styles.eyebrow}>UNSAVED CANDIDATE</span><p>Review the generated image before saving. It is not yet a locked identity.</p>
                  <button type="button" disabled={saving} onClick={() => void saveView()}>Save this view</button>
                  <button type="button" disabled={saving} onClick={() => { setCandidate(null); setStatus("Candidate discarded without changing the PPF."); }}>Discard</button>
                </div>
              </div> : null}
              {status ? <p role="status" aria-live="polite" className={styles.message}>{status}</p> : null}
            </section>
          </div> : null}
        </div>
      )}
    </section>
  );
}
