"use client";

/* eslint-disable @next/next/no-img-element -- ASSETS displays local project-owned media. */

import { useEffect, useState } from "react";
import { authenticatedComputeFetch } from "../../core/auth/profile-request-browser";
import AssetsCharacters from "./assets-characters";
import AssetsImageRouteSelector from "./assets-image-route-selector";
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
    <section aria-label="ASSETS project workspace" data-asset-workspace="true">
      <div className="pp-skin-v1-bbs-banner">
        <h1>ASSETS</h1>
        <button type="button" className="pp-skin-v1-return" onClick={onBackDashboard}>Back to Dashboard</button>
      </div>
      <p>Current story: <strong>{project?.title || "No Library project loaded"}</strong></p>
      {!project ? <p role="status">Load Brotherly Love or another saved story from Library to create project assets.</p> : (
        <>
          <AssetsImageRouteSelector status={route} onChanged={setRoute} />
          <nav aria-label="ASSETS folders">
            <button type="button" onClick={() => { setFolder("sounds"); setNotice(""); }}>Sounds</button>{" "}
            <button type="button" onClick={() => { setFolder("characters"); setNotice(""); }}>Characters</button>{" "}
            <button type="button" onClick={() => { setFolder("collectibles"); setNotice(""); }}>Collectibles</button>{" "}
            <button type="button" onClick={() => { setFolder("posters"); setNotice(""); }}>Posters</button>{" "}
            <button type="button" onClick={() => { setFolder("world"); setNotice(""); }}>World</button>
          </nav>
          {folder === "sounds" ? (
            <section aria-label="Sounds folder">
              <h2>Sounds</h2>
              <button type="button" onClick={() => onOpenSound("foley")}>Foley</button>{" "}
              <button type="button" onClick={() => onOpenSound("narration")}>Narration</button>{" "}
              <button type="button" onClick={() => onOpenSound("music")}>Music</button>
            </section>
          ) : null}
          {folder === "characters" ? <AssetsCharacters
            project={project}
            routeId={routeId}
            routeReady={routeReady}
            cloud={cloud}
            onSaved={(saved) => setProject(saved)}
            onManageCharacterTruth={onOpenCharacters}
          /> : null}
          {folder === "collectibles" ? <p>Collectibles authoring is planned. No creation route is active yet.</p> : null}
          {folder === "world" ? (
            <section aria-label="World visual assets" data-assets-folder="world">
              <h2>World — {project.title}</h2>
              <p>Previously saved project world images are shown here. Creating new world views will be part of the next ASSETS implementation.</p>
              {project.build.world.visualArtifacts.length ? project.build.world.visualArtifacts.map((image) => (
                <article key={image.id}>
                  <img src={image.assetUrl} alt={image.narrativeIntention || "Saved world reference"} style={{maxWidth: 220, display: "block"}} />
                  <p>{image.reviewState === "accepted" ? "Approved" : "Draft"} · {image.provider} · {image.model}</p>
                </article>
              )) : <p>No world images have been saved for this project yet.</p>}
            </section>
          ) : null}
          {folder === "posters" ? (
            <section aria-label="Posters for current screenplay" data-assets-folder="posters">
              <h2>Posters — {project.title}</h2>
              <p>Marketing artwork only. Uses the selected screenplay excerpts and saved Foundations decisions where present. Creating a candidate does not change story or character canon.</p>
              {featured ? <p>Current Library poster: <img src={featured.assetUrl} alt={project.title + " approved poster"} style={{maxWidth: 220, display: "block"}} /></p> : <p>No approved Library poster yet.</p>}
              {posters.map((poster) => (
                <article key={poster.id} data-assets-poster={poster.id}>
                  <img src={poster.assetUrl} alt={project.title + " poster candidate"} style={{maxWidth: 180, display: "block"}} />
                  <p>{poster.reviewState === "accepted" || project.build.foundations.acceptedVisualArtifactIds.includes(poster.id) ? "Approved" : "Draft"} · {poster.provider} · {poster.model}</p>
                  {!project.build.foundations.acceptedVisualArtifactIds.includes(poster.id) ? (
                    <button type="button" disabled={busy} onClick={() => void approvePoster(poster)}>Approve for Library</button>
                  ) : null}
                </article>
              ))}
              <label htmlFor="assets-poster-direction">Poster art direction</label>
              <textarea id="assets-poster-direction" value={direction} onChange={(event) => setDirection(event.currentTarget.value)} maxLength={1500} rows={3} placeholder="Describe the look you want. Existing saved Foundations decisions provide the source context." />
              <p>Image route: {routeId || "unavailable"} · {routeReady ? (cloud ? "Paid cloud" : "Local") : routeOption?.error || "not verified"}</p>
              {cloud ? <label><input type="checkbox" checked={billingAcknowledged} onChange={(event) => setBillingAcknowledged(event.currentTarget.checked)} /> I authorize one paid poster generation request.</label> : null}
              <button type="button" disabled={busy || !routeReady || (cloud && !billingAcknowledged)} onClick={() => void generatePoster()}>Generate 1 poster</button>
              {candidate ? <div>
                <img src={candidate.assetUrl} alt="Unsaved poster candidate" style={{maxWidth: 220, display: "block"}} />
                <p>Unsaved candidate. Save before navigating away.</p>
                <button type="button" disabled={busy} onClick={() => void saveCandidate()}>Save poster draft</button>
              </div> : null}
            </section>
          ) : null}
        </>
      )}
      {notice ? <p role="status" aria-live="polite">{notice}</p> : null}
    </section>
  );
}
