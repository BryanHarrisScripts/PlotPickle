"use client";

/* eslint-disable @next/next/no-img-element -- Local generated assets are served by PlotPickle's loopback gateway. */

import { useMemo, useState } from "react";
import type { Character, PlotPickleProject } from "@/lib/project";
import {
  approvePendingVisualIdentity,
  buildCharacterIdentityPrompt,
  characterVisualIdentityDiagnostic,
  getCharacterVisualIdentity,
  lockCharacterVisualIdentity,
  reviewCharacterVisualIdentity,
  saveVisualIdentityDraft,
  setCharacterVisualIdentity,
  type CharacterReferenceAngle,
  type CharacterVisualIdentity,
  type CharacterVisualTraits,
  type CharacterWithVisualIdentity,
} from "@/lib/character-visual-identity";
import styles from "./character-image-generator.module.css";

type ImageResponse = { assetUrl?: string; revisedPrompt?: string; message?: string };

const traitFields: Array<[keyof CharacterVisualTraits, string, string]> = [
  ["ageRange", "Apparent age", "Example: early 40s"],
  ["heightBuild", "Height and build", "Example: tall, lean, narrow shoulders"],
  ["postureMovement", "Posture and movement", "How the silhouette carries itself"],
  ["faceShape", "Facial structure", "Jaw, cheekbones, nose, brow, proportions"],
  ["skin", "Skin", "Tone, texture and stable details"],
  ["eyes", "Eyes", "Colour, shape, spacing and expression"],
  ["hair", "Hair", "Colour, texture, cut and hairline"],
  ["facialHair", "Facial hair", "Style, colour and density"],
  ["distinguishingMarks", "Distinguishing marks", "Scars, freckles, tattoos or asymmetry"],
  ["defaultWardrobe", "Default wardrobe", "Signature silhouette, materials and fit"],
  ["accessories", "Fixed accessories", "Glasses, jewellery, watch or carried item"],
  ["colourCues", "Character colour cues", "Recurring colours that identify this character"],
];

function cloneIdentity(identity: CharacterVisualIdentity): CharacterVisualIdentity {
  return JSON.parse(JSON.stringify(identity)) as CharacterVisualIdentity;
}

function masterReference(identity: CharacterVisualIdentity) {
  return identity.references.find((reference) => reference.angle === "master")?.src || "";
}

export default function CharacterImageGenerator({ project, character, onImage }: { project: PlotPickleProject; character: Character; onImage: (value: string) => void }) {
  const visualCharacter = character as CharacterWithVisualIdentity;
  const initial = useMemo(() => getCharacterVisualIdentity(visualCharacter), [visualCharacter]);
  const [identity, setIdentity] = useState<CharacterVisualIdentity>(initial);
  const [angle, setAngle] = useState<CharacterReferenceAngle>("master");
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState("");
  const diagnostic = characterVisualIdentityDiagnostic({ ...visualCharacter, visualIdentity: identity });

  function persist(next: CharacterVisualIdentity, notice: string, approvedThumbnail?: string) {
    setIdentity(next);
    setCharacterVisualIdentity(visualCharacter, next);
    onImage(approvedThumbnail ?? character.image ?? masterReference(next));
    setMessage(notice);
  }

  function updateTrait(key: keyof CharacterVisualTraits, value: string) {
    setIdentity((current) => ({ ...current, traits: { ...current.traits, [key]: value } }));
  }

  function rebuildPrompt() {
    const next = cloneIdentity(identity);
    next.draftPrompt = buildCharacterIdentityPrompt({ ...visualCharacter, visualIdentity: next }, project.world.visualLanguage, project.world.period);
    setIdentity(next);
    setMessage("Draft prompt rebuilt from the character and visual identity fields. Review it before saving.");
  }

  function saveDraft() {
    const next = saveVisualIdentityDraft(visualCharacter, identity, "Writer edited the visual identity package");
    persist(next, identity.status === "locked" ? "The locked identity was not changed. A reviewable version is waiting for approval." : "Visual identity draft saved in the canonical project.");
  }

  function markReviewed() {
    const next = reviewCharacterVisualIdentity(identity);
    persist(next, "Visual identity marked reviewed. Lock it when the prompt and references are ready to become canon.");
  }

  function lockIdentity() {
    const prepared = identity.draftPrompt.trim() ? identity : { ...identity, draftPrompt: buildCharacterIdentityPrompt({ ...visualCharacter, visualIdentity: identity }, project.world.visualLanguage, project.world.period) };
    const next = lockCharacterVisualIdentity(prepared);
    persist(next, `Visual identity locked at version ${next.version}. Storyboard prompts will now use this exact approved identity.`, masterReference(next) || character.image);
  }

  function approveReplacement() {
    const next = approvePendingVisualIdentity(identity);
    persist(next, `The pending visual identity was approved and locked as version ${next.version}.`, masterReference(next) || character.image);
  }

  async function generate() {
    if (!identity.draftPrompt.trim() || state === "working") return;
    setState("working");
    setMessage(`Generating the ${angle.replace("-", " ")} reference and saving it locally…`);
    try {
      const prompt = [
        identity.draftPrompt,
        `Reference view: ${angle.replace("-", " ")}.`,
        angle === "full-body" ? "Show the complete body and readable silhouette." : "Clear face and production-reference lighting.",
        identity.negativePrompt && `Identity exclusions: ${identity.negativePrompt}`,
        "Single character only, neutral background, no text, no border.",
      ].filter(Boolean).join(" ");
      const response = await fetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          characterId: character.id,
          assetId: `character-${character.id}-${angle}-v${identity.version}`,
          aspect: "portrait",
          referenceImages: identity.references.filter((reference) => reference.approved).map((reference) => reference.src),
          identityLock: { characterId: character.id, version: identity.version, status: identity.status, approvedPrompt: identity.approvedPrompt },
        }),
      });
      const result = await response.json() as ImageResponse;
      if (!response.ok || !result.assetUrl) throw new Error(result.message || "The image provider returned no image.");
      const now = new Date().toISOString();
      const reference = { id: `character-${character.id}-${angle}-${Date.now()}`, angle, src: result.assetUrl, prompt: result.revisedPrompt || prompt, approved: false, createdAt: now };
      const proposed = {
        ...identity,
        draftPrompt: result.revisedPrompt || identity.draftPrompt,
        references: [...identity.references.filter((item) => item.angle !== angle), reference],
      };
      if (identity.status === "locked") {
        const next = saveVisualIdentityDraft(visualCharacter, proposed, `Generated a new ${angle.replace("-", " ")} reference`);
        persist(next, "The locked identity and thumbnail remain unchanged. The new reference is waiting in a proposed version for writer approval.");
      } else {
        persist(proposed, "Reference generated and attached as a draft. Review the complete identity package before locking it.", angle === "master" ? result.assetUrl : character.image);
      }
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Character image generation is unavailable.");
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.heading}>
        <div>
          <span>Character Visual Identity Lock</span>
          <h3>Keep {character.name} recognizably the same in every image.</h3>
          <p>The locked identity prompt and approved reference views travel into Visual Bible, storyboard and production image requests. Scene emotion, injuries and wardrobe variants remain separate continuity choices.</p>
        </div>
        {character.image ? <img src={character.image} alt={`${character.name} master reference`} /> : null}
      </div>

      <div className={styles.statusRow}>
        <strong>{identity.status}</strong><span>Version {identity.version}</span><span className={diagnostic.severity === "clear" ? styles.clear : diagnostic.severity === "review" ? styles.review : styles.blocked}>{diagnostic.message}</span>
      </div>

      <details open={identity.status !== "locked"}>
        <summary>Stable visual traits</summary>
        <div className={styles.traitGrid}>
          {traitFields.map(([key, label, placeholder]) => <label key={key}><span>{label}</span><input value={identity.traits[key]} placeholder={placeholder} onChange={(event) => updateTrait(key, event.target.value)} /></label>)}
        </div>
        <div className={styles.twoColumns}>
          <label><span>Wardrobe variants</span><textarea rows={3} value={identity.wardrobeVariants} onChange={(event) => setIdentity((current) => ({ ...current, wardrobeVariants: event.target.value }))} placeholder="Scene-specific costume options that may change without changing identity" /></label>
          <label><span>Scene continuity notes</span><textarea rows={3} value={identity.sceneContinuityNotes} onChange={(event) => setIdentity((current) => ({ ...current, sceneContinuityNotes: event.target.value }))} placeholder="Injuries, ageing, weathering or temporary appearance changes" /></label>
        </div>
      </details>

      <label><span>Identity prompt</span><textarea rows={7} value={identity.draftPrompt} onChange={(event) => setIdentity((current) => ({ ...current, draftPrompt: event.target.value }))} /></label>
      <label><span>Negative identity prompt — details that must not drift</span><textarea rows={4} value={identity.negativePrompt} onChange={(event) => setIdentity((current) => ({ ...current, negativePrompt: event.target.value }))} /></label>

      <div className={styles.referenceControls}>
        <label><span>Reference view</span><select value={angle} onChange={(event) => setAngle(event.target.value as CharacterReferenceAngle)}><option value="master">Master three-quarter portrait</option><option value="front">Front</option><option value="profile">Profile</option><option value="three-quarter">Three-quarter</option><option value="full-body">Full body</option></select></label>
        <button type="button" className={styles.generate} disabled={state === "working" || !identity.draftPrompt.trim()} onClick={generate}>{state === "working" ? "Generating…" : `Generate ${angle.replace("-", " ")} reference`}</button>
      </div>

      {identity.references.length ? <div className={styles.references}>{identity.references.map((reference) => <article key={reference.id}><img src={reference.src} alt={`${character.name} ${reference.angle} reference`} /><div><strong>{reference.angle.replace("-", " ")}</strong><span>{reference.approved ? "Approved" : "Draft"}</span></div></article>)}</div> : <p className={styles.empty}>No visual references yet. The identity prompt can still be locked, but at least one approved image is recommended.</p>}

      {identity.pendingRevision ? <div className={styles.pending}><strong>Version {identity.pendingRevision.version} waiting for approval</strong><p>{identity.pendingRevision.reason}</p><button type="button" onClick={approveReplacement}>Approve and replace locked identity</button></div> : null}

      <div className={styles.actions}>
        <button type="button" onClick={rebuildPrompt}>Rebuild from character</button>
        <button type="button" onClick={saveDraft}>{identity.status === "locked" ? "Save as proposed version" : "Save draft"}</button>
        {identity.status === "draft" ? <button type="button" onClick={markReviewed}>Mark reviewed</button> : null}
        {identity.status !== "locked" ? <button type="button" className={styles.lock} onClick={lockIdentity}>Approve and lock identity</button> : null}
      </div>
      {message ? <p className={state === "error" ? styles.error : styles.status} role="status">{message}</p> : null}
      <small>AI is optional. Prompts and identity decisions remain editable manually; nothing becomes the approved identity without the writer choosing to lock it.</small>
    </section>
  );
}
