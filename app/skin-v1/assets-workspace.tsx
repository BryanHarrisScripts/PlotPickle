"use client";

/* eslint-disable @next/next/no-img-element -- ASSETS displays local project-owned media. */

import { useEffect, useState } from "react";
import { authenticatedComputeFetch } from "../../core/auth/profile-request-browser";
import AssetsCharacters from "./assets-characters";
import AssetsImageRouteSelector from "./assets-image-route-selector";
import styles from "./assets-workspace.module.css";
import { applyStoryCommand } from "../../core/project/apply-command";
import {
  lockedMarketingReference,
  marketingReferenceVersions,
  type FoundationsVisualArtifact,
} from "../../core/contracts/build-progress";
import {
  loadLibraryProjectSnapshot,
  PROJECT_LIBRARY_CHANGED_EVENT,
  saveActiveLibraryProject,
  sessionActiveProjectId,
  type LibraryPPFProject,
} from "../../core/storage/project-library-browser";
import { flushProfilePrivateWrites, persistActiveProfileProject } from "../../core/storage/profile-private-browser";
import {
  buildFoundationsMarketingPosterPrompt,
  createFirstMarketingReferenceArtifact,
  deriveMarketingContextV1,
} from "../../modules/learn/model/marquee-director";

type Folder = "sounds" | "characters" | "collectibles" | "posters" | "world";
type ImageRouteStatus = {
  choice?: { image?: string };
  image?: {
    selected?: string;
    options?: Record<string, { ready?: boolean; locality?: string; model?: string; error?: string }>;
  };
};
type ImageReply = {
  ok?: boolean;
  assetUrl?: string;
  revisedPrompt?: string;
  provider?: string;
  model?: string;
  message?: string;
};

function currentProject(): LibraryPPFProject | null {
  const id = sessionActiveProjectId();
  return id ? loadLibraryProjectSnapshot(id) : null;
}

function assertCurrentProject(projectId: string, expectedRevision?: number) {
  if (!projectId || sessionActiveProjectId() !== projectId) {
    throw new Error("The active Library story changed. Reload ASSETS before saving.");
  }
  if (expectedRevision !== undefined && loadLibraryProjectSnapshot(projectId)?.revision !== expectedRevision) {
    throw new Error("The saved Library story changed since this poster was prepared. Reload ASSETS before saving.");
  }
}

async function verifyPosterMedia(assetUrl: string) {
  if (!/^\/api\/local-ai\/assets\/[a-z0-9-]+\.(?:webp|png|jpe?g)$/i.test(assetUrl)) {
    throw new Error("The image generator did not return a project-safe local image.");
  }
  const response = await authenticatedComputeFetch(assetUrl, { cache: "no-store" });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error("The new poster's local image cannot be read. Nothing was saved.");
  }
  if (!(await response.arrayBuffer()).byteLength) throw new Error("The poster has no image bytes. Nothing was saved.");
}

/** Existing Library PPF Marketing Reference is the poster authority. No second asset store. */
export default function AssetsWorkspace({
  onBackDashboard, onOpenCharacters, onOpenSound,
}: {
  readonly onBackDashboard: () => void;
  readonly onOpenCharacters: () => void;
  readonly onOpenSound: (kind: "foley" | "narration" | "music") => void;
}) {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [route, setRoute] = useState<ImageRouteStatus | null>(null);
  const [selectedPosterId, setSelectedPosterId] = useState("");
  const [selectedWorldId, setSelectedWorldId] = useState("");
  const [direction, setDirection] = useState("");
  const [billingAcknowledged, setBillingAcknowledged] = useState(false);
  const [candidate, setCandidate] = useState<{ projectId: string; assetUrl: string; prompt: string; provider: string; model: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const refresh = () => {
      setProject(currentProject());
      setCandidate(null);
      setBillingAcknowledged(false);
    };
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    authenticatedComputeFetch("/api/ai-routing/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<ImageRouteStatus> : null)
      .then((value) => { if (!cancelled) setRoute(value); })
      .catch(() => { if (!cancelled) setRoute(null); });
    return () => { cancelled = true; };
  }, []);

  const routeId = route?.choice?.image || route?.image?.selected || "";
  const routeOption = routeId ? route?.image?.options?.[routeId] : null;
  const routeReady = routeOption?.ready === true && routeOption?.locality !== "manual";
  const cloud = routeOption?.locality === "cloud";
  const posters = project ? marketingReferenceVersions(project.build.foundations.visualArtifacts) : [];
  const featured = project
    ? lockedMarketingReference(project.build.foundations.visualArtifacts, project.build.foundations.acceptedVisualArtifactIds)
    : null;

  const selectedPoster = posters.find((item) => item.id === selectedPosterId) || featured || posters[0] || null;
  const worlds = project?.build.world.visualArtifacts ?? [];
  const selectedWorld = worlds.find((item) => item.id === selectedWorldId) || worlds[0] || null;

  async function persist(next: LibraryPPFProject, artifact: FoundationsVisualArtifact, approve = false) {
    assertCurrentProject(next.id);
    const saved = saveActiveLibraryProject(next);
    if (saved.id !== next.id) throw new Error("The Library rejected the project identity.");
    await persistActiveProfileProject();
    await flushProfilePrivateWrites();
    assertCurrentProject(next.id);
    const readback = loadLibraryProjectSnapshot(next.id);
    const matching = readback?.build.foundations.visualArtifacts.find((item) => item.id === artifact.id);
    if (!readback || matching?.assetUrl !== artifact.assetUrl
        || (approve && !readback.build.foundations.acceptedVisualArtifactIds.includes(artifact.id))) {
      throw new Error("Poster read-back did not confirm the saved image and approval.");
    }
    setProject(readback);
  }

  async function generatePoster() {
    if (!project || !routeReady || busy) return;
    if (cloud && !billingAcknowledged) {
      setNotice("Confirm the paid cloud generation request first.");
      return;
    }
    setBusy(true);
    setNotice("Generating a poster candidate for the selected story. No story canon will change.");
    try {
      assertCurrentProject(project.id, project.revision);
      const context = deriveMarketingContextV1(project);
      const passages = (project.sourceEvidence.screenplay?.passages ?? [])
        .filter((passage) => Boolean(passage.text?.trim()))
        .slice(0, 24)
        .map((passage) => passage.id + ": " + passage.text.trim().slice(0, 450));
      if (!context.foundationsBrief && !context.decisions.length && !passages.length) {
        throw new Error("The selected story has no saved screenplay or accepted Foundations material to ground a poster.");
      }
      const basePrompt = buildFoundationsMarketingPosterPrompt(context);
      const screenplayContext = passages.length
        ? "\n\nActual selected screenplay excerpts (source reference only; do not invent additional canon):\n" + passages.join("\n")
        : "";
      const humanDirection = direction.trim();
      const prompt = basePrompt + screenplayContext + (humanDirection
        ? "\n\nHuman poster direction (creative request, not accepted story canon): " + humanDirection.slice(0, 1500)
        : "");
      const response = await authenticatedComputeFetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, assetId: `assets-poster-${project.id}-${Date.now()}`,
          aspect: "portrait", requestCount: 1, billingAcknowledged: cloud && billingAcknowledged,
        }),
      });
      const result = await response.json() as ImageReply;
      if (!response.ok || !result.ok || !result.assetUrl) throw new Error(result.message || "Poster generation did not return an image.");
      await verifyPosterMedia(result.assetUrl);
      assertCurrentProject(project.id);
      setCandidate({
        projectId: project.id, assetUrl: result.assetUrl, prompt: result.revisedPrompt?.trim() || prompt,
        provider: result.provider || routeId, model: result.model || routeOption?.model || "",
      });
      setNotice("Candidate ready. Save as a draft, then approve it for the Library poster.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Poster generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCandidate() {
    if (!project || !candidate || busy) return;
    setBusy(true);
    try {
      if (candidate.projectId !== project.id) {
        throw new Error("This poster belongs to a different story. Generate a new candidate.");
      }
      assertCurrentProject(project.id, project.revision);
      await verifyPosterMedia(candidate.assetUrl);
      const now = new Date().toISOString();
      const artifact = createFirstMarketingReferenceArtifact({
        id: globalThis.crypto.randomUUID(), assetUrl: candidate.assetUrl,
        prompt: candidate.prompt, createdAt: now, provider: candidate.provider,
        model: candidate.model, context: deriveMarketingContextV1(project),
      });
      const next = applyStoryCommand(project, { type: "foundations.visual.store", artifact, occurredAt: now }) as LibraryPPFProject;
      await persist(next, artifact);
      setCandidate(null);
      setNotice("Poster draft saved and read back for " + project.title + ". Approve it to display it in Library.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Poster Save could not be confirmed.");
    } finally {
      setBusy(false);
    }
  }

  async function approvePoster(artifact: FoundationsVisualArtifact) {
    if (!project || busy) return;
    setBusy(true);
    try {
      assertCurrentProject(project.id, project.revision);
      await verifyPosterMedia(artifact.assetUrl);
      const next = applyStoryCommand(project, {
        type: "foundations.visual.accept", artifactId: artifact.id, occurredAt: new Date().toISOString(),
      }) as LibraryPPFProject;
      await persist(next, artifact, true);
      setNotice("Approved poster saved. Library will display this image for " + project.title + ".");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Poster approval could not be confirmed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.shell} aria-label="ASSETS project workspace" data-asset-workspace="true">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>PLOTPICKLE / PROJECT LIBRARY</p>
          <h1>ASSETS</h1>
          <p className={styles.subhead}>Create and manage the saved visuals and sounds that belong to your story.</p>
        </div>
        <button type="button" className="pp-skin-v1-return" onClick={onBackDashboard}>Back to Dashboard</button>
      </header>
      <section className={styles.projectStrip} aria-label="Selected story authority">
        <span>CURRENT STORY</span>
        <strong>{project?.title || "No Library project loaded"}</strong>
        <small>{project ? "Assets belong to this Library PPF" : "Load a story from Library before saving assets"}</small>
      </section>
      {!project ? <p className={styles.empty} role="status">Load Brotherly Love or another saved story from Library to create project assets.</p> : (
        <>
          <nav className={styles.tabs} aria-label="ASSETS folders">
            {(["sounds","characters","collectibles","posters","world"] as const).map((id) => (
              <button type="button" key={id} aria-current={folder === id ? "page" : undefined}
                data-selected={folder === id ? "true" : "false"}
                onClick={() => { setFolder(id); setNotice(""); }}>
                {id === "sounds" ? "Sounds" : id === "characters" ? "Characters" : id === "collectibles" ? "Collectibles" : id === "posters" ? "Posters" : "World"}
              </button>
            ))}
          </nav>
          <details className={styles.routing}>
            <summary>IMAGE ROUTE · {routeId || "Unavailable"} · {routeReady ? "Verified" : "Needs setup / test"} <span>Change provider</span></summary>
            <AssetsImageRouteSelector status={route} onChanged={setRoute} />
          </details>
          {!folder ? <div className={styles.overview} aria-label="ASSETS project overview">
            <h2>Choose an asset folder</h2>
            <p>Your approved images remain in the same saved project after returning to Library.</p>
            <div className={styles.overviewGrid}>
              <button type="button" onClick={() => setFolder("posters")}><strong>Posters</strong><span>{posters.length} saved versions · {featured ? "Library artwork approved" : "No featured poster yet"}</span></button>
              <button type="button" onClick={() => setFolder("characters")}><strong>Characters</strong><span>Character Truth, eight reference views, sheets and portraits</span></button>
              <button type="button" onClick={() => setFolder("world")}><strong>World</strong><span>{worlds.length} retained environment references</span></button>
              <button type="button" onClick={() => setFolder("sounds")}><strong>Sounds</strong><span>Foley, Narration and Music</span></button>
              <button type="button" onClick={() => setFolder("collectibles")}><strong>Collectibles</strong><span>Creation workspace pending</span></button>
            </div>
          </div> : null}
          {folder === "sounds" ? <section className={styles.panel} aria-label="Sounds folder">
            <div className={styles.sectionHeading}><h2>Sounds</h2><p>Build the soundscape for {project.title}.</p></div>
            <div className={styles.overviewGrid}>
              <button type="button" onClick={() => onOpenSound("foley")}><strong>Foley</strong><span>Room tone, actions and environmental sound</span></button>
              <button type="button" onClick={() => onOpenSound("narration")}><strong>Narration</strong><span>Voice-over and spoken story</span></button>
              <button type="button" onClick={() => onOpenSound("music")}><strong>Music</strong><span>Score, music and ambient cues</span></button>
            </div>
          </section> : null}
          {folder === "characters" ? <AssetsCharacters
            project={project}
            routeId={routeId}
            routeReady={routeReady}
            cloud={cloud}
            onSaved={(saved) => setProject(saved)}
            onManageCharacterTruth={onOpenCharacters}
          /> : null}
          {folder === "collectibles" ? <section className={styles.panel} aria-label="Collectibles folder">
            <div className={styles.sectionHeading}><h2>Collectibles</h2><p>Reusable story and game objects, bound to the loaded project.</p></div>
            <div className={styles.empty} role="status">Collectibles authoring is planned. No creation route is active yet; no objects will be invented or saved automatically.</div>
          </section> : null}
          {folder === "world" ? <section className={styles.panel} aria-label="World visual assets" data-assets-folder="world">
            <div className={styles.sectionHeading}><h2>World — {project.title}</h2><p>Reference environments saved from story-world development. New world-view generation is a later #3019 gate.</p></div>
            {selectedWorld ? <div className={styles.viewer}>
              <figure className={styles.focusImage}><img src={selectedWorld.assetUrl} alt={selectedWorld.narrativeIntention || "Saved world reference"} /><figcaption>{selectedWorld.narrativeIntention || "Story world image"}</figcaption></figure>
              <div className={styles.focusDetails}><span className={styles.eyebrow}>SELECTED WORLD IMAGE</span><strong>{selectedWorld.reviewState === "accepted" ? "Approved" : "Draft / review"}</strong>
                <p>{selectedWorld.provider} · {selectedWorld.model}</p><small>World Map continues to own approved story facts; ASSETS shows its retained images.</small></div>
            </div> : <p className={styles.empty}>No world images have been saved for this project yet.</p>}
            {worlds.length ? <div className={styles.gallery} aria-label="Saved world image gallery">{worlds.map(image => <button type="button" className={styles.thumb} key={image.id}
              aria-pressed={selectedWorld?.id === image.id} onClick={() => setSelectedWorldId(image.id)}>
              <img src={image.assetUrl} alt={image.narrativeIntention || "World reference thumbnail"} />
              <span>{image.reviewState === "accepted" ? "Approved" : "Draft"}</span></button>)}</div> : null}
          </section> : null}
          {folder === "posters" ? <section className={styles.panel} aria-label="Posters for current screenplay" data-assets-folder="posters">
            <div className={styles.sectionHeading}><h2>Posters — {project.title}</h2><p>Production artwork derived from this screenplay and accepted Foundations material, never automatic story canon.</p></div>
            {selectedPoster ? <div className={styles.viewer} data-selected-poster={selectedPoster.id}>
              <figure className={styles.focusImage}><img src={selectedPoster.assetUrl} alt={project.title + " selected poster"} /><figcaption>{project.title} · {selectedPoster.provider}</figcaption></figure>
              <div className={styles.focusDetails}>
                <span className={styles.eyebrow}>SELECTED POSTER</span>
                <strong>{project.build.foundations.acceptedVisualArtifactIds.includes(selectedPoster.id) ? "Approved for Library" : "Saved draft"}</strong>
                <p>{selectedPoster.provider} · {selectedPoster.model}</p>
                {!project.build.foundations.acceptedVisualArtifactIds.includes(selectedPoster.id) ? <button type="button" disabled={busy} onClick={() => void approvePoster(selectedPoster)}>Approve for Library</button> : <p>Current Library poster: this approved image is available on the story card.</p>}
              </div>
            </div> : <p className={styles.empty}>No approved Library poster yet. Create a candidate below.</p>}
            {posters.length ? <div className={styles.gallery} aria-label="Saved poster variations">{posters.map(poster =>
              <button type="button" className={styles.thumb} key={poster.id} data-assets-poster={poster.id}
                aria-pressed={selectedPoster?.id === poster.id} onClick={() => setSelectedPosterId(poster.id)}>
                <img src={poster.assetUrl} alt={project.title + " poster candidate"} />
                <span>{project.build.foundations.acceptedVisualArtifactIds.includes(poster.id) ? "Approved" : "Draft"}</span>
              </button>
            )}</div> : null}
            <section className={styles.creation} aria-label="Poster creation studio">
              <div className={styles.sectionHeading}><h3>Create a poster</h3><p>Generate, review, Save as draft, then Approve for Library.</p></div>
              <label htmlFor="assets-poster-direction">Poster art direction</label>
              <textarea id="assets-poster-direction" value={direction} onChange={(event) => setDirection(event.currentTarget.value)}
                maxLength={1500} rows={3} placeholder="Describe the poster composition, typography or mood. Saved screenplay decisions remain the source." />
              <p>Image route: {routeId || "unavailable"} · {routeReady ? cloud ? "Cloud (paid consent)" : "Verified Local" : routeOption?.error || "Needs provider verification"}</p>
              {cloud ? <label className={styles.consent}><input type="checkbox" checked={billingAcknowledged}
                onChange={(event) => setBillingAcknowledged(event.currentTarget.checked)} /> I authorize one paid poster generation request.</label> : null}
              <button type="button" disabled={busy || !routeReady || (cloud && !billingAcknowledged)} onClick={() => void generatePoster()}>
                {busy ? "Generating…" : "Generate 1 poster"}</button>
              {candidate ? <div className={styles.viewer}>
                <figure className={styles.focusImage}><img src={candidate.assetUrl} alt="Unsaved poster candidate" /><figcaption>Unsaved candidate</figcaption></figure>
                <div className={styles.focusDetails}><span className={styles.eyebrow}>UNSAVED CANDIDATE</span><strong>Review before saving</strong><p>Generated art never becomes approved automatically.</p>
                  <button type="button" disabled={busy} onClick={() => void saveCandidate()}>Save poster draft</button></div>
              </div> : null}
            </section>
          </section> : null}
        </>
      )}
      {notice ? <p className={styles.notice} role="status" aria-live="polite">{notice}</p> : null}
    </section>
  );
}
