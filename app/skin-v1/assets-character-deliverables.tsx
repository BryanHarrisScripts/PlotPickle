"use client";

/* eslint-disable @next/next/no-img-element -- preview of private authenticated local media. */
import { useState } from "react";
import { authenticatedComputeFetch } from "../../core/auth/profile-request-browser";
import {
  registerProjectAssetSource, normalizeProjectAssetRegistry,
  type ProjectAssetRegistry, type ProjectAssetVariation,
} from "../../lib/projects/persistence/project-assets";
import type { LibraryPPFProject } from "../../core/storage/library-project";
import { loadLibraryProjectSnapshot, saveActiveLibraryProject, sessionActiveProjectId } from "../../core/storage/project-library-browser";
import { flushProfilePrivateWrites, persistActiveProfileProject } from "../../core/storage/profile-private-browser";
import { mindMapCharacterVisualPrompt, mindMapCharacterVisualGenerationPlan } from "../../modules/learn/model/mind-map-character-roster";
import styles from "./assets-character-deliverables.module.css";

export type CharacterDeliverableKind = "character-sheet" | "character-portrait";
type Candidate = {
  projectId: string; revision: number; characterId: string; kind: CharacterDeliverableKind;
  source: string; prompt: string; provider: string; model: string; bytes: number; contentHash: string;
};
type Props = {
  project: LibraryPPFProject; characterId: string; characterName: string;
  routeId: string; routeReady: boolean; cloud: boolean;
  onSaved: (value: LibraryPPFProject) => void;
};
const MEDIA = /^\/api\/local-ai\/assets\/[a-z0-9-]+\.(?:webp|png|jpe?g)$/iu;
const typeLabel = (kind: CharacterDeliverableKind) => kind === "character-sheet" ? "Full Character Sheet" : "1:1 Portrait";
const targetId = (characterId: string, kind: CharacterDeliverableKind) => `character-deliverable:${characterId}:${kind}`;

function guard(project: LibraryPPFProject) {
  if (sessionActiveProjectId() !== project.id || loadLibraryProjectSnapshot(project.id)?.revision !== project.revision) {
    throw new Error("The loaded Library story changed. Reopen ASSETS before changing character assets.");
  }
}

async function readVerified(source: string, square: boolean) {
  if (!MEDIA.test(source)) throw new Error("Image route did not return a trusted local media reference.");
  const response = await authenticatedComputeFetch(source, { cache: "no-store" });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error("The saved image bytes are not readable from the configured provider.");
  }
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) throw new Error("The image has no bytes.");
  if (square && typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: response.headers.get("content-type") || "image/webp" }));
    const valid = bitmap.width === bitmap.height;
    bitmap.close();
    if (!valid) throw new Error("The provider did not return an actual 1:1 square image. Nothing was saved.");
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const contentHash = "sha256:" + [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2,"0")).join("");
  return { bytes: bytes.byteLength, contentHash };
}

async function saveAndReadback(before: LibraryPPFProject, registry: ProjectAssetRegistry, proof: (reg: ProjectAssetRegistry) => boolean) {
  guard(before);
  const next: LibraryPPFProject = {
    ...before, assetRegistry: registry, revision: before.revision + 1, updatedAt: new Date().toISOString(),
  };
  const saved = saveActiveLibraryProject(next);
  if (saved.id !== before.id) throw new Error("Library project ownership changed during Save.");
  await persistActiveProfileProject();
  await flushProfilePrivateWrites();
  if (sessionActiveProjectId() !== before.id) throw new Error("The active story changed during Save.");
  const readback = loadLibraryProjectSnapshot(before.id);
  if (!readback || readback.revision !== next.revision || !proof(readback.assetRegistry)) {
    throw new Error("PPF read-back did not confirm this exact character asset.");
  }
  return readback;
}

export default function AssetsCharacterDeliverables({ project, characterId, characterName, routeId, routeReady, cloud, onSaved }: Props) {
  const [kind, setKind] = useState<CharacterDeliverableKind>("character-sheet");
  const [direction, setDirection] = useState("");
  const [paidConsent, setPaidConsent] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const allAssets = project.assetRegistry?.assets ?? [];
  const items = allAssets.filter(asset => asset.targets.some(target =>
    target.kind === "other" && target.id === targetId(characterId, kind)));
  const currentTarget = targetId(characterId, kind);

  async function generate() {
    if (busy || !routeReady || (cloud && !paidConsent)) return;
    setBusy(true);
    setMessage("Preparing a source-grounded " + typeLabel(kind) + " preview.");
    try {
      guard(project);
      const base = mindMapCharacterVisualPrompt(project, characterId, "front-full-body");
      if (!base) throw new Error("The selected character needs saved Character Truth first.");
      const references = mindMapCharacterVisualGenerationPlan(project, characterId, new Date().toISOString()).approvedReferenceImages;
      const composition = kind === "character-sheet"
        ? "Create ONE coherent, production-ready multi-panel CHARACTER SHEET for exactly this character. Clearly separate front, rear and three-quarter depictions, expression studies, poses, wardrobe and props in a labeled board; consistent face and costume. This is one composite image, NOT eight independently verified views. Use a landscape canvas."
        : "Create ONE square 1:1 portrait of exactly this character, center-composed with breathing room for a reusable profile card. No montage or multiple characters.";
      const prompt = [base, composition, direction.trim() ? "Human art direction (not canon): " + direction.trim().slice(0,1200) : ""].filter(Boolean).join("\n\n");
      const aspect = kind === "character-portrait" ? "square" : "landscape";
      const response = await authenticatedComputeFetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, aspect, requestCount: 1, characterId,
          assetId: `asset-${project.id.replace(/[^a-z0-9-]/giu,"-")}-${Date.now()}`,
          referenceImages: references, billingAcknowledged: cloud && paidConsent,
        }),
      });
      const result = await response.json() as {ok?:boolean; assetUrl?:string; revisedPrompt?:string; provider?:string; model?:string; message?:string};
      if (!response.ok || !result.ok || !result.assetUrl) throw new Error(result.message || "Image generation returned no candidate.");
      const { bytes, contentHash } = await readVerified(result.assetUrl, kind === "character-portrait");
      guard(project);
      setCandidate({
        projectId: project.id, revision: project.revision, characterId, kind, source: result.assetUrl,
        provider: result.provider || routeId, model: result.model || routeId, prompt: result.revisedPrompt || prompt,
        bytes, contentHash,
      });
      setMessage("Preview ready. Save this draft or discard it. No image was automatically approved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate a reference.");
    } finally { setBusy(false); }
  }

  async function saveDraft() {
    if (!candidate || busy) return;
    setBusy(true);
    try {
      guard(project);
      if (candidate.projectId !== project.id || candidate.revision !== project.revision
        || candidate.characterId !== characterId || candidate.kind !== kind) {
        throw new Error("This image belongs to an older project or character selection.");
      }
      const verified = await readVerified(candidate.source, kind === "character-portrait");
      if (verified.contentHash !== candidate.contentHash || verified.bytes !== candidate.bytes) {
        throw new Error("Image content has changed since preview. Draft not saved.");
      }
      const now = new Date().toISOString();
      const registered = registerProjectAssetSource(project.assetRegistry, {
        kind: "image", target: { kind: "other", id: currentTarget }, source: candidate.source,
        label: `${characterName} — ${typeLabel(kind)}`,
        provider: candidate.provider, model: candidate.model, prompt: candidate.prompt,
        mediaType: candidate.source.endsWith(".png") ? "image/png" : candidate.source.endsWith(".jpg") || candidate.source.endsWith(".jpeg") ? "image/jpeg" : "image/webp",
        bytes: candidate.bytes, contentHash: candidate.contentHash, generatedAt: now, updatedAt: now,
        approval: "unreviewed",
        provenanceIds: [`character-truth:${characterId}`],
        variationExtensions: { outputType: kind, characterId, requestedAspect: kind === "character-portrait" ? "1:1" : "landscape",
          compositeSheet: kind === "character-sheet", independentWorldMapViews: 0 },
      });
      const ref = registered.reference;
      if (!ref) throw new Error("Could not assign a durable asset identity.");
      const saved = await saveAndReadback(project, registered.registry, registry => registry.assets.some(asset =>
        asset.id === ref.assetId && asset.variations.some(v => v.id === ref.variationId
          && v.source === candidate.source && v.contentHash === candidate.contentHash && v.approval === "unreviewed")));
      onSaved(saved);
      setCandidate(null);
      setMessage("Draft saved with verified media hash; approve it separately to make it reusable.");
    } catch(error) { setMessage(error instanceof Error ? error.message : "Draft Save failed."); }
    finally { setBusy(false); }
  }

  async function approve(assetId: string, variation: ProjectAssetVariation, shouldApprove: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      guard(project);
      const confirmed = await readVerified(variation.source, kind === "character-portrait");
      if (confirmed.contentHash !== variation.contentHash || confirmed.bytes !== variation.bytes) {
        throw new Error("Saved image bytes do not match the PPF hash; approval blocked.");
      }
      const next = normalizeProjectAssetRegistry({
        ...project.assetRegistry,
        assets: project.assetRegistry.assets.map(asset => asset.id !== assetId ? asset : ({
          ...asset, approvedVariationId: shouldApprove ? variation.id : "",
          updatedAt: new Date().toISOString(),
          variations: asset.variations.map(v => ({
            ...v, approval: v.id === variation.id
              ? (shouldApprove ? "approved" : "unreviewed")
              : (v.approval === "approved" ? "unreviewed" : v.approval),
          })),
        })),
      });
      const saved = await saveAndReadback(project, next, reg => reg.assets.some(asset =>
        asset.id === assetId && asset.approvedVariationId === (shouldApprove ? variation.id : "")));
      onSaved(saved);
      setMessage(shouldApprove ? typeLabel(kind) + " approved and saved." : "Approval released; saved asset retained as draft.");
    } catch(error) { setMessage(error instanceof Error ? error.message : "Approval failed."); }
    finally { setBusy(false); }
  }

  return <section className={styles.studio} aria-label="Character Sheet and Portrait studio">
    <header><h3>Character deliverables</h3><p>Independent images stored in the PPF asset registry. Composite sheets never count as eight verified World Map views.</p></header>
    <div className={styles.types} role="group" aria-label="Choose character asset type">
      <button type="button" aria-pressed={kind === "character-sheet"} disabled={busy}
        onClick={() => { setKind("character-sheet"); setCandidate(null); setMessage(""); }}>Full Character Sheet</button>
      <button type="button" aria-pressed={kind === "character-portrait"} disabled={busy}
        onClick={() => { setKind("character-portrait"); setCandidate(null); setMessage(""); }}>1:1 Portrait</button>
    </div>
    <p>{kind === "character-sheet" ? "One labeled, multi-angle composition (landscape), separate from the eight individual reference views." : "One genuine 1:1 square character portrait, checked before Save."}</p>
    <label>Art direction <textarea value={direction} rows={3} maxLength={1200}
      onChange={event => setDirection(event.target.value)} placeholder="Optional style or wardrobe direction, not automatic story canon" /></label>
    {cloud ? <label className={styles.consent}><input type="checkbox" checked={paidConsent} onChange={event => setPaidConsent(event.target.checked)} /> Authorize one paid cloud image generation request</label> : null}
    <p>Selected image route: {routeId || "Not available"} · {routeReady ? "Ready" : "Needs verification"}</p>
    <button type="button" disabled={busy || !routeReady || (cloud && !paidConsent)} onClick={() => void generate()}>
      {busy ? "Working…" : "Generate " + typeLabel(kind)}</button>
    {candidate && candidate.projectId === project.id && candidate.characterId === characterId && candidate.kind === kind ? <article className={styles.preview}>
      <img src={candidate.source} alt={`Unsaved ${characterName} ${typeLabel(kind)}`} />
      <div><strong>Unsaved preview</strong><p>{candidate.provider} · {candidate.model} · {candidate.bytes} bytes</p>
        <button type="button" disabled={busy} onClick={() => void saveDraft()}>Save draft</button>{" "}
        <button type="button" disabled={busy} onClick={() => setCandidate(null)}>Discard</button>
      </div>
    </article> : null}
    <div className={styles.gallery} aria-label={typeLabel(kind) + " saved versions"}>
      {items.flatMap(item => item.variations.map(variation => <article key={variation.id} className={styles.tile}>
        <img src={variation.source} alt={`${characterName} ${typeLabel(kind)} version`} />
        <div><strong>{item.approvedVariationId === variation.id ? "Approved" : "Saved draft"}</strong>
          <small>{variation.provider} · {variation.generatedAt}</small>
          <button type="button" disabled={busy} onClick={() => void approve(item.id, variation, item.approvedVariationId !== variation.id)}>
            {item.approvedVariationId === variation.id ? "Unlock" : "Approve"}
          </button></div>
      </article>))}
      {!items.length ? <p>No saved {typeLabel(kind).toLowerCase()} versions yet.</p> : null}
    </div>
    {message ? <p role="status" aria-live="polite">{message}</p> : null}
  </section>;
}
