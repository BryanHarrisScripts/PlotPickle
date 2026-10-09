"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { plotPickleCurriculum } from "../../../adapters/curriculum/current-catalog";
import { buildStoryDevelopmentFields } from "../../learn/model/story-development-fields";
import { LEARN_TOPIC_SPINE } from "../../learn/model/story-learning-context";
import { relevantProjectContextForField } from "../../learn/model/relevant-project-context";
import { summarizeAfterglowSavedVersion, type AfterglowSavedVersionSummary } from "../afterglow-version-summary.mjs";
import { isAfterglowRecoverySnapshot, summarizeAfterglowRecoverySnapshot,
  type AfterglowRecoverySnapshotSummary } from "../afterglow-recovery-snapshot.mjs";
import { mindMapCharacterRoster } from "../../learn/model/mind-map-character-roster";
import { collectAfterglowReviewSources } from "../afterglow-review-sources.mjs";
import type { LibraryPPFProject } from "../../../core/storage/library-project";
import type { StoryDevelopmentFieldDefinition } from "../../learn/model/story-development-fields";
import packagedAfterglowManifest from "../../../data/afterglow-packaged-current/manifest.json";
import type { AfterglowMediaVerification } from "../afterglow-media-integrity.mjs";
import { afterglowRecoveryItemPath, type AfterglowRecoveredWork } from "../afterglow-work-recovery.mjs";
import { partitionAfterglowChoices } from "../afterglow-creative-choice-boundary.mjs";
import { afterglowReviewProgress, afterglowImageSlotKey, selectAfterglowImageOption, resetAfterglowImageSlot } from "../afterglow-review-progress.mjs";
import { listAfterglowImageChoices, applyAfterglowImageChoices, imageIncludedInCandidate,
  type AfterglowImageChoice } from "../afterglow-image-review.mjs";
import type { AfterglowMasterSavePreflight, AfterglowSavedSnapshotProof } from "../afterglow-master-save-preflight.mjs";
import {
  PROJECT_LIBRARY_ACTIVE_PROFILE_KEY,
  PROJECT_LIBRARY_CHANGED_EVENT,
  listAfterglowExampleProjects,
  listArchivedLibraryProjects,
  loadLibraryProjectSnapshot,
  libraryProjectSnapshotText,
  type ProjectLibrarySummary,
} from "../../../core/storage/project-library-browser";
import { profilePrivateBrowserReadyFor, listProfileRecoveryPoints,
  commitConsolidatedAfterglow,lastAfterglowMasterSaveAttempt,
  type AfterglowMasterSaveAudit,type ConsolidatedAfterglowReceipt,
  type ProfileRecoveryPoint } from "../../../core/storage/profile-private-browser";
import { describeAfterglowConsolidationConflict, reviewAfterglowConsolidationDecisions } from "../afterglow-consolidation.mjs";
import type {
  AfterglowConsolidationPlan,
  AfterglowConflictChoice,
  AfterglowConsolidationChange,
  AfterglowConsolidationConflict,
  AfterglowConsolidationReview,
} from "../afterglow-consolidation.mjs";
import styles from "./afterglow-management-panel.module.css";

type RecoverySourcePreview = Readonly<{
  key: string;
  kind: "recovery-point" | "archived-copy";
  date: string;
  revision: number;
  description: string;
  creative: AfterglowRecoverySnapshotSummary;
  fields: AfterglowSavedVersionSummary;
}>;
function describeRecoveredSnapshot(project: LibraryPPFProject, key: string,
  kind: RecoverySourcePreview["kind"], date: string, fields: readonly StoryDevelopmentFieldDefinition[],
  description: string): RecoverySourcePreview {
  const roster = mindMapCharacterRoster(project);
  const ids = project.sourceEvidence?.characterTruth?.principalCharacterIds ?? [];
  return {
    key, kind, date, revision: project.revision, description,
    creative: summarizeAfterglowRecoverySnapshot({project, characters:roster}),
    fields: summarizeAfterglowSavedVersion({
      project, fields,
      contextForField: (field, act) => field.topicId === "character" && ids.length
        ? ids.flatMap(characterId=>relevantProjectContextForField(project,field,act,characterId))
        : relevantProjectContextForField(project,field,act,null),
    }),
  };
}
type Preview = Readonly<{
  plan: AfterglowConsolidationPlan;
  recovery: AfterglowRecoveredWork;
  imageOptions: readonly AfterglowImageChoice[];
  initialProofs: readonly AfterglowSavedSnapshotProof[];
  sources: AfterglowConsolidationPlan["sources"];
  sourceInventory: string;
  includedHistoricalSources: number;
  sourceWarnings: readonly string[];
  appliedCount: number;
  reconciledVisualCount: number;
  questionEvidence: AfterglowConsolidationPlan["questionEvidence"];
  sampleChanges: readonly AfterglowConsolidationChange[];
  conflictCount: number;
  reviewCount: number;
  conflicts: readonly AfterglowConsolidationConflict[];
  needsReview: readonly AfterglowConsolidationReview[];
  localAssetCount: number;
  sourceMediaCount: number;
  mergeShapeConsistent: boolean;
}>;

function AfterglowWebpThumbnail({item}:{readonly item:AfterglowImageChoice}) {
  const [unavailable,setUnavailable] = useState(false);
  return <div className={styles.imagePreview}>
    {!unavailable ? <img src={item.url}
      loading="lazy" alt={item.characterName+" — "+item.view}
      onError={()=>setUnavailable(true)}/> : (
      <div className={styles.missingImage}>
        Local image unavailable. Open the original or inspect the packaged comparison below.
      </div>
    )}
    {unavailable && item.packagedPublicUrl ? <>
      <img src={item.packagedPublicUrl} loading="lazy"
        alt={"Packaged comparison only: "+item.characterName+" — "+item.view}/>
      <small>Packaged comparison only — not proof of the original saved bytes</small>
    </> : null}
  </div>;
}
function profileReady() {
  const profileId = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) || "";
  return profilePrivateBrowserReadyFor(profileId);
}
function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Date unavailable" :
    new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function canonicalQuestionForPath(path: string, questions: ReadonlyMap<string, string>) {
  const match = /^\/storyDevelopment\/fields\/([^/]+)(?:\/(?:value|updatedAt))?$/.exec(path);
  if (!match) return null;
  const storedFieldId = match[1].replace(/~1/g, "/").replace(/~0/g, "~");
  return questions.get(storedFieldId) ?? null;
}
function inventoryFingerprint(sources: readonly ProjectLibrarySummary[]) {
  return JSON.stringify(sources.map(item => [item.id, item.updatedAt]));
}
function archivedAfterglowSummaries() {
  return listArchivedLibraryProjects().filter(item =>
    item.sourceKind === "example" && item.sourceId === "afterglow-v9");
}
function reviewSourceInventoryFingerprint() {
  // Include content in the historical snapshot identity, not merely its
  // parent project ID or a date. Saving a new recovery point invalidates review.
  return JSON.stringify({
    active:inventoryFingerprint(listAfterglowExampleProjects()),
    archived:inventoryFingerprint(archivedAfterglowSummaries()),
    points:listProfileRecoveryPoints().filter(point=>isAfterglowRecoverySnapshot(point.project))
      .map(point=>[point.id,point.projectId,point.createdAt,point.project]),
  });
}

async function exactSavedSnapshotProofs(items: readonly {readonly project: {
  readonly id: string; readonly revision: number; readonly updatedAt: string;
}}[]): Promise<AfterglowSavedSnapshotProof[]> {
  return Promise.all(items.map(async ({project}) => {
    const raw = libraryProjectSnapshotText(project.id);
    if (!raw) throw new Error("The saved Library bytes are unavailable. Reopen this profile and review again.");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    const hex = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2,"0")).join("");
    return {id:project.id,revision:project.revision,updatedAt:project.updatedAt,digest:"sha256:"+hex};
  }));
}
function readableCreativeChoice(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item=value as Record<string, unknown>;
  if (typeof item.value === "string" && item.value.trim()) return item.value;
  if (typeof item.text === "string" && item.text.trim()) return item.text;
  if (item.noText === true) return "Approved: no caption or dialogue";
  if (typeof item.narration === "string" && item.narration.trim()) return item.narration;
  if (Array.isArray(item.bubbles)) {
    const dialogue=item.bubbles.map(bubble => {
      if (!bubble || typeof bubble !== "object") return "";
      const text=bubble as {text?: unknown; dialogue?:unknown; content?:unknown};
      return [text.text,text.dialogue,text.content].find(part=>typeof part==="string" && part.trim()) ?? "";
    }).filter(Boolean);
    if (dialogue.length) return dialogue.join("\n");
  }
  return null;
}
function summarizeHumanValue(value: unknown, path = "") {
  if (Array.isArray(value) && path.endsWith("/acceptedVisualArtifactIds")) {
    return value.length + " accepted artwork IDs; lock and media proof required";
  }
  if (Array.isArray(value) && path.includes("graphicNovelTextApprovals")) {
    return value.length + " Graphic Novel panel approvals";
  }
  if (value && typeof value === "object" && !Array.isArray(value)
      && "anchorRef" in value && "position" in value) {
    const a = value as { position?: number; narration?: string; noText?: boolean };
    const label = a.noText ? "Human approved no text" : (a.narration || "Approved dialogue bubbles");
    return "Shot " + (a.position ?? "?") + " — " + label.slice(0, 140);
  }
  if (path.startsWith("/storyDevelopment/fields/") && value && typeof value === "object"
      && !Array.isArray(value) && "value" in value) {
    const state = value as { value?: string; acceptedSource?: string | null };
    return (typeof state.value === "string" ? state.value.slice(0, 145) : "No saved answer")
      + (state.acceptedSource ? " · source: " + state.acceptedSource : "");
  }
  if (path.endsWith("/updatedAt") && typeof value === "string") return displayDate(value);
  if (typeof value === "string") return value.length > 160 ? value.slice(0, 160) + "…" : value;
  let result = "";
  try { result = JSON.stringify(value); }
  catch { return "Complex value — review saved version"; }
  return result && result.length > 160 ? result.slice(0, 160) + "…" : result || "Empty";
}

/**
 * Phase 2B lets the Human review competing values without any mutation.
 * The account-owned durable commit, ambiguous deletion/ordering decisions,
 * verified media reads, pinned-baseline reset and designated-publisher release
 * remain independent pending acceptance gates.
 */
export default function AfterglowManagementPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [sources, setSources] = useState<readonly ProjectLibrarySummary[]>([]);
  const [recoveryPoints, setRecoveryPoints] = useState<readonly ProfileRecoveryPoint[]>([]);
  const [archivedAfterglow, setArchivedAfterglow] = useState<readonly ProjectLibrarySummary[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, AfterglowConflictChoice>>({});
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [imageChoices, setImageChoices] = useState<Record<string,"keep"|"exclude">>({});
  const [confirmedCurrent, setConfirmedCurrent] = useState<Record<string,boolean>>({});
  const [expandedImageSlots, setExpandedImageSlots] = useState<Record<string,boolean>>({});
  const [conflictPage, setConflictPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaState, setMediaState] = useState<{
    readonly report: AfterglowMediaVerification;
    readonly sources: string;
    readonly choices: string;
  } | null>(null);
  const [mediaNotice, setMediaNotice] = useState("");
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [preflightState, setPreflightState] = useState<{
    readonly report: AfterglowMasterSavePreflight;
    readonly sources: string;
    readonly choices: string;
  } | null>(null);
  const [preflightNotice, setPreflightNotice] = useState("");
  const [notice, setNotice] = useState("");
  const [saveReceipt,setSaveReceipt] = useState<ConsolidatedAfterglowReceipt|null>(null);
  const [saveError,setSaveError] = useState("");
  const [lastSaveAudit,setLastSaveAudit] = useState<AfterglowMasterSaveAudit|null>(null);
  const canonicalFields = useMemo(() => buildStoryDevelopmentFields(plotPickleCurriculum), []);
  // Library is the source of truth. Each brief describes one complete saved
  // snapshot (not a guessed difference against the latest version).
  const sourceSummaries = useMemo(() => {
    const summaries = new Map<string, AfterglowSavedVersionSummary | null>();
    for (const source of sources) {
      try {
        const project = loadLibraryProjectSnapshot(source.id);
        if (!project || project.id !== source.id) {
          summaries.set(source.id, null);
          continue;
        }
        const characterIds = project.sourceEvidence?.characterTruth?.principalCharacterIds ?? [];
        summaries.set(source.id, summarizeAfterglowSavedVersion({
          project,
          fields: canonicalFields,
          contextForField: (field, act) => field.topicId === "character" && characterIds.length
            ? characterIds.flatMap(characterId => relevantProjectContextForField(project, field, act, characterId))
            : relevantProjectContextForField(project, field, act, null),
        }));
      } catch {
        summaries.set(source.id, null);
      }
    }
    return summaries;
  }, [sources, canonicalFields]);
  const recoverySourceAudit = useMemo(() => {
    const found: RecoverySourcePreview[] = [];
    const warnings: string[] = [];
    for (const point of recoveryPoints) {
      // A recovery point can reference the SAME underlying project ID as an
      // active copy: its independent key must be the recovery-point ID.
      if (!isAfterglowRecoverySnapshot(point.project)) continue;
      if (point.project.id !== point.projectId) {
        warnings.push("Recovery point from "+displayDate(point.createdAt)+" has mismatched project identity.");
        continue;
      }
      try {
        found.push(describeRecoveredSnapshot(point.project, "point:"+point.id,
          "recovery-point", point.createdAt, canonicalFields,
          point.reason === "unload" ? "Saved before unloading"
            : point.reason === "pre-restore" ? "Saved before a restore" : "Manual recovery point"));
      } catch (error) {
        warnings.push("Recovery point from "+displayDate(point.createdAt)
          +" cannot be inspected: "+(error instanceof Error ? error.message : "invalid saved content"));
      }
    }
    for (const archived of archivedAfterglow) {
      const project=loadLibraryProjectSnapshot(archived.id);
      if (!isAfterglowRecoverySnapshot(project) || project.id !== archived.id) {
        warnings.push("Archived Afterglow copy from "+displayDate(archived.updatedAt)
          +" is unavailable or has invalid project identity.");
        continue;
      }
      try {
        found.push(describeRecoveredSnapshot(project, "archived:"+archived.id,
          "archived-copy", archived.updatedAt, canonicalFields, "Archived working copy"));
      } catch (error) {
        warnings.push("Archived Afterglow copy from "+displayDate(archived.updatedAt)
          +" cannot be inspected: "+(error instanceof Error ? error.message : "invalid saved content"));
      }
    }
    return {found:found.sort((a,b)=>b.date.localeCompare(a.date)||a.key.localeCompare(b.key)),warnings};
  }, [recoveryPoints, archivedAfterglow, canonicalFields]);
  const questionByField = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const field of canonicalFields) {
      lookup.set(field.canonicalId, field.prompt);
      if (field.scope !== "project-wide") {
        for (const act of field.validActs) lookup.set(field.canonicalId + "::act-" + act, field.prompt);
      }
    }
    return lookup;
  }, [canonicalFields]);
  const textReviewed = useMemo(() => preview
    ? reviewAfterglowConsolidationDecisions(preview.plan, decisions, exclusions)
    : null, [preview, decisions, exclusions]);
  const imageReview=useMemo(()=>preview && textReviewed
    ? applyAfterglowImageChoices({
        candidate:textReviewed.candidate,items:preview.imageOptions,choices:imageChoices,
      })
    : null,[preview,textReviewed,imageChoices]);
  const reviewed=useMemo(()=>{
    if(!textReviewed || !imageReview) return null;
    const media = new Set<string>();
    const visit = (value:unknown) => {
      if(typeof value==="string" && value.startsWith("/api/local-ai/assets/")) media.add(value);
      else if(Array.isArray(value))value.forEach(visit);
      else if(value && typeof value==="object")Object.values(value).forEach(visit);
    };
    // Never subtract a URL because an image reference was excluded if another
    // approved Storyboard/narration surface still uses those same bytes.
    visit(imageReview.candidate);
    return {...textReviewed,candidate:imageReview.candidate,
      localAssetsToVerify:[...media].sort()};
  },[textReviewed,imageReview]);
  const selectionFingerprint = JSON.stringify({ decisions, exclusions, imageChoices, confirmedCurrent });
  const recoveryPaths = useMemo(() => new Set(preview?.recovery.groups.flatMap(group =>
    group.items.map(item=>afterglowRecoveryItemPath(item,canonicalFields)).filter((value): value is string => Boolean(value))
  ) ?? []), [preview, canonicalFields]);
  const creativeChoices=useMemo(()=>partitionAfterglowChoices(preview?.conflicts ?? [],
    [...recoveryPaths]),[preview,recoveryPaths]);

  const reviewProgress=useMemo(()=>afterglowReviewProgress({
    groups:preview?.recovery.groups.map(group=>({
      id:group.id,label:group.label,items:group.items.map(item=>({
        id:item.id,label:item.label,kind:item.kind,
        reviewPath:afterglowRecoveryItemPath(item,canonicalFields),
      })),
    }))??[],
    candidatePaths:preview?.plan.applied.map(item=>item.path)??[],
    conflictPaths:[...creativeChoices.human,...creativeChoices.inRecovered].map(item=>item.path),
    confirmations:confirmedCurrent,exclusions,decisions,
    extraConflicts:creativeChoices.human.map(item=>({
      path:item.path,label:describeAfterglowConsolidationConflict(item.path).label,
    })),
    imageOptions:preview?.imageOptions??[],imageChoices,
  }),[preview,canonicalFields,creativeChoices,confirmedCurrent,exclusions,decisions,imageChoices]);
  const pendingHumanChoices=reviewProgress.pending;

  const refresh = useCallback(() => {
    const ready = profileReady();
    setAuthenticated(ready);
    setLastSaveAudit(ready ? lastAfterglowMasterSaveAttempt() : null);
    setSources(ready ? listAfterglowExampleProjects() : []);
    // Data Recovery remains the owner of restore operations. Afterglow only
    // reads its matching, account-owned recovery and archived snapshots.
    setRecoveryPoints(ready ? listProfileRecoveryPoints() : []);
    setArchivedAfterglow(ready ? archivedAfterglowSummaries() : []);
    setPreview(null);
    setDecisions({});
    setExclusions([]);
    setImageChoices({});
    setConfirmedCurrent({});
    setExpandedImageSlots({});
    setMediaState(null);
    setMediaNotice("");
    setPreflightState(null);
    setPreflightNotice("");
    setConflictPage(0);
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
  }, [refresh]);

  async function reviewConsolidation() {
    if (busy || mediaBusy || preflightBusy) return;
    setBusy(true);
    setPreview(null);
    setDecisions({});
    setExclusions([]);
    setImageChoices({});
    setConfirmedCurrent({});
    setExpandedImageSlots({});
    setMediaState(null);
    setMediaNotice("");
    setPreflightState(null);
    setPreflightNotice("");
    setConflictPage(0);
    setNotice("");
    setSaveReceipt(null);
    setSaveError("");
    try {
      if (!profileReady()) throw new Error("Unlock your PlotPickle profile before reviewing Afterglow.");
      const start = listAfterglowExampleProjects();
      const startingInventory=reviewSourceInventoryFingerprint();
      const {sources:complete,warnings:sourceWarnings} = collectAfterglowReviewSources({
        active:start,archived:archivedAfterglowSummaries(),
        recoveryPoints:listProfileRecoveryPoints(),load:loadLibraryProjectSnapshot,
      });
      if (!complete.length) {
        setNotice("No eligible saved Afterglow or profile recovery snapshots could be read. Original work was not changed.");
        return;
      }
      // Exact browser Library-byte proofs are applicable only to active
      // working copies. Historical private recovery cache is not falsely
      // presented as containing original-save byte fingerprints.
      const initialProofs = await exactSavedSnapshotProofs(complete.filter(
        source=>source.sourceKind==="working-copy"));
      const [{ createAfterglowPackagedCurrentReference }, { planAfterglowConsolidation },
        { inventoryAfterglowRecoveredWork }] = await Promise.all([
        import("../reference/afterglow-packaged-current"),
        import("../afterglow-consolidation.mjs"),
        import("../afterglow-work-recovery.mjs"),
      ]);
      // A save or account switch during an asynchronous review invalidates
      // the results. Never publish a preview for a different hydrated profile.
      if (!profileReady() ||
        startingInventory !== reviewSourceInventoryFingerprint()
        || JSON.stringify(initialProofs) !== JSON.stringify(await exactSavedSnapshotProofs(
          complete.filter(source=>source.sourceKind==="working-copy")))) {
        throw new Error("Afterglow changed during review. Refresh and review the complete current list.");
      }
      const baseline = createAfterglowPackagedCurrentReference();
      const result = planAfterglowConsolidation({
        baseline,
        sources: complete,
        questions: Object.fromEntries(questionByField),
      });
      const recovery = inventoryAfterglowRecoveredWork({
        baseline,
        sources: complete,
        fields: canonicalFields,
      });
      const imageOptions = listAfterglowImageChoices({
        sources:[{project:baseline,sourceKey:"provided-example"},...complete],
        manifest:packagedAfterglowManifest,
      });
      setPreview({
        plan: result,
        recovery,
        imageOptions,
        initialProofs,
        sources: result.sources,
        sourceInventory:startingInventory,
        sourceWarnings,
        includedHistoricalSources:complete.filter(source=>source.sourceKind!=="working-copy").length,
        appliedCount: result.applied.length,
        reconciledVisualCount: result.reconciledVisuals.length,
        questionEvidence: result.questionEvidence,
        sampleChanges: result.applied.slice(0, 35),
        conflictCount: result.conflicts.length,
        reviewCount: result.needsReview.length,
        conflicts: result.conflicts,
        needsReview: result.needsReview.slice(0, 35),
        localAssetCount: result.localAssetsToVerify.length,
        sourceMediaCount: result.sourceMediaReferences.length,
        mergeShapeConsistent: result.mergeShapeConsistent,
      });
      setNotice("Read-only review includes saved working copies and eligible older recovery states. No project, approval, image, or provided example was changed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Afterglow could not be reviewed. Your saved work is unchanged.");
    } finally {
      setBusy(false);
    }
  }

  const mediaMatches = mediaState !== null && preview !== null
    && mediaState.sources === preview.sourceInventory
    && mediaState.sources === reviewSourceInventoryFingerprint()
    && mediaState.choices === selectionFingerprint;
  const mediaReport = mediaMatches ? mediaState.report : null;

  async function verifyMediaEvidence() {
    if (!preview || mediaBusy || busy || preflightBusy) return;
    setMediaBusy(true);
    setMediaState(null);
    setMediaNotice("");
    setPreflightState(null);
    setPreflightNotice("");
    const profileId = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) || "";
    const startingInventory = preview.sourceInventory;
    const choices = selectionFingerprint;
    const guard = () => {
      if (!profileId || window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) !== profileId
        || !profilePrivateBrowserReadyFor(profileId)
        || startingInventory !== reviewSourceInventoryFingerprint()) {
        throw new Error("Afterglow account or saved versions changed during inspection. Refresh and review again.");
      }
    };
    try {
      guard();
      const collected=collectAfterglowReviewSources({
        active:listAfterglowExampleProjects(),archived:archivedAfterglowSummaries(),
        recoveryPoints:listProfileRecoveryPoints(),load:loadLibraryProjectSnapshot,
      }).sources;
      const byKey=new Map(collected.map(source=>[source.sourceKey??source.project.id,source]));
      const snapshots=preview.sources.map(item=>{
        const source=byKey.get(item.id);
        if(!source || source.project.id!==item.projectId
          ||source.project.revision!==item.revision || source.project.updatedAt!==item.updatedAt) {
          throw new Error("A saved historical snapshot or working version changed. Review again.");
        }
        return source;
      });
      if(snapshots.length!==collected.length)throw new Error("Afterglow source inventory changed. Review again.");
      const indexResponse = await fetch("/api/local-ai/assets", {
        credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: {Accept: "application/json"},
      });
      if (!indexResponse.ok) throw new Error("Local asset inventory is not available. No media verified.");
      const localAssetIndex = await indexResponse.json() as {assets?: {url:string;contentHash:string}[]};
      guard();
      const {verifyAfterglowMedia} = await import("../afterglow-media-integrity.mjs");
      const candidate = reviewed?.candidate ?? preview.plan.candidate;
      const result = await verifyAfterglowMedia({
        candidate, sources:snapshots, packagedManifest:packagedAfterglowManifest,
        localAssetIndex,
        beforeRead: guard,
        read: async (url, maximum) => {
          guard();
          const response = await fetch(url, {
            credentials:"same-origin",cache:"no-store",redirect:"error",
            signal:AbortSignal.timeout(20_000),
          });
          if (!response.ok || !response.body) return {ok:false};
          const length = Number(response.headers.get("content-length") || 0);
          if (length > maximum) return {ok:false};
          const reader = response.body.getReader();
          const parts:Uint8Array[] = [];
          let total=0;
          try {
            while(true) {
              const {done,value} = await reader.read();
              guard();
              if(done) break;
              if(!value) continue;
              total+=value.byteLength;
              if(total>maximum) {await reader.cancel();return {ok:false};}
              parts.push(value);
            }
          } finally {reader.releaseLock();}
          const bytes=new Uint8Array(total);
          let offset=0;
          for(const part of parts){bytes.set(part,offset);offset+=part.length;}
          return {ok:true,bytes};
        },
        hash: async bytes => {
          const digest=await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
          return "sha256:"+Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
        },
        decode: async (bytes,url) => {
          const type = url.toLowerCase().endsWith(".png") ? "image/png"
            : /\.jpe?g$/i.test(url) ? "image/jpeg" : "image/webp";
          const image = await createImageBitmap(new Blob([bytes.slice()], {type}));
          try {if(image.width<1 || image.height<1) throw new Error("Decoded image has no dimensions.");}
          finally {image.close();}
        },
      });
      guard();
      if (JSON.stringify(await exactSavedSnapshotProofs(
        snapshots.filter(source=>source.sourceKind==="working-copy"))) !== JSON.stringify(preview.initialProofs)) {
        throw new Error("Saved source bytes changed during inspection. Refresh and repeat the review.");
      }
      if (choices !== selectionFingerprint) {
        throw new Error("Conflict choices changed during media inspection. Inspect the new selection again.");
      }
      setMediaState({report:result,sources:startingInventory,choices});
      setMediaNotice("Read-only byte and image-decoder check completed. No source or example was modified.");
    } catch (error) {
      setMediaNotice(error instanceof Error ? error.message : "Media verification could not complete; previous work is unchanged.");
    } finally {setMediaBusy(false);}
  }

  const preflightReport = preflightState !== null && mediaMatches
    && preflightState.sources === preview?.sourceInventory
    && preflightState.choices === selectionFingerprint ? preflightState.report : null;
  async function checkMasterSavePreflight() {
    if (!preview || !reviewed || !mediaReport || busy || mediaBusy || preflightBusy) return;
    if(preview.includedHistoricalSources || preview.sourceWarnings.length) {
      setPreflightNotice("Historical recovery states are now included in the draft. Durable master save readiness requires independent encrypted snapshot provenance and cannot yet be authorized.");
      return;
    }
    setPreflightBusy(true);
    setPreflightState(null);
    setPreflightNotice("");
    try {
      if (!profileReady()) throw new Error("Unlock your profile before checking master save readiness.");
      const profileId = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) || "";
      const inventory = reviewSourceInventoryFingerprint();
      if (inventory !== preview.sourceInventory) {
        throw new Error("Saved versions changed; review again before checking readiness.");
      }
      const snapshots = preview.sources.map(source => {
        const project = loadLibraryProjectSnapshot(source.id);
        if (!project || project.id !== source.id || project.revision !== source.revision ||
          project.updatedAt !== source.updatedAt) throw new Error("A saved source revision changed. Refresh the review.");
        return {project};
      });
      const currentProofs = await exactSavedSnapshotProofs(snapshots);
      const [{preflightAfterglowMasterSave},{normalizeLibraryProject}] = await Promise.all([
        import("../afterglow-master-save-preflight.mjs"),
        import("../../../core/storage/library-project"),
      ]);
      const normalizedCandidate = normalizeLibraryProject(reviewed.candidate);
      const result = preflightAfterglowMasterSave({
        plan:preview.plan, reviewed,
        initialProofs:preview.initialProofs,currentProofs,
        sourceSnapshots:snapshots,mediaReport,normalizedCandidate,
      });
      const finalProofs = await exactSavedSnapshotProofs(snapshots);
      if (!profileId || window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) !== profileId
        || !profileReady() || inventory !== reviewSourceInventoryFingerprint()
        || JSON.stringify(finalProofs) !== JSON.stringify(currentProofs)
        || selectionFingerprint !== (mediaState?.choices ?? "")) {
        throw new Error("Profile, saved bytes or selected story decisions changed. Re-run the review.");
      }
      setPreflightState({report:result,sources:inventory,choices:selectionFingerprint});
      setPreflightNotice("Read-only save-preparation check completed. No new master was created.");
    } catch(error) {
      setPreflightNotice(error instanceof Error ? error.message : "The save-preparation proof could not complete.");
    } finally {setPreflightBusy(false);}
  }

  async function saveConsolidatedMaster() {
    if(!preview || !reviewed || busy || mediaBusy || preflightBusy
      || !reviewProgress.allCreativeDecided || reviewProgress.needsIndependentReview.length
      || preview.sourceWarnings.length) {
      setSaveError("Decide every required creative choice and resolve preservation blockers before saving.");
      return;
    }
    setBusy(true);
    setSaveError("");
    setSaveReceipt(null);
    try {
      if(!profileReady()||reviewSourceInventoryFingerprint()!==preview.sourceInventory){
        throw new Error("The signed-in Afterglow source inventory changed. Start a new review.");
      }
      const collected=collectAfterglowReviewSources({
        active:listAfterglowExampleProjects(),archived:archivedAfterglowSummaries(),
        recoveryPoints:listProfileRecoveryPoints(),load:loadLibraryProjectSnapshot,
      });
      if(collected.warnings.length || collected.sources.length!==preview.sources.length)
        throw new Error("Some saved recovery sources are unavailable. No master was saved.");
      const expectedSources=await Promise.all(collected.sources.map(async source=>{
        const bytes=new TextEncoder().encode(JSON.stringify(source.project));
        const hash=await crypto.subtle.digest("SHA-256",bytes);
        return {key:source.sourceKey??source.project.id,
          digest:"sha256:"+Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("")};
      }));
      if(!profileReady() || preview.sourceInventory!==reviewSourceInventoryFingerprint() ||
        selectionFingerprint!==JSON.stringify({decisions,exclusions,imageChoices,confirmedCurrent})) {
        throw new Error("Source snapshots or creative decisions changed while preparing to save.");
      }
      const receipt=await commitConsolidatedAfterglow({
        selections:{decisions,exclusions,confirmedCurrent,imageChoices},
        expectedSources,
      });
      setSaveReceipt(receipt);
      setLastSaveAudit(lastAfterglowMasterSaveAttempt());
      setPreview(null);
      setNotice("");
    } catch(error) {
      setSaveError(error instanceof Error?error.message:
        "The consolidated story was not confirmed. The original saved work remains untouched.");
      // Do not clear the reviewed choices on a rejected Save. The inline
      // failure appears at the same Save button the Human just pressed.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.workspace} data-afterglow-management="phase2-preview">
      <section className={styles.panel} aria-labelledby="afterglow-personal-heading">
        <div className={styles.heading}>
          <div><p className={styles.eyebrow}>Every authenticated PlotPickle user</p>
            <h2 id="afterglow-personal-heading">My Afterglow</h2></div>
          <span className={styles.status}>Review, confirm, save</span>
        </div>
        <p>Your personal Afterglow is a continuing working story: future edits should build on the same saved version.
          Find earlier Mind Map, Ask Agent, Story Bible and character work before creating one current master.
          The provided Afterglow distributed to other users is a separate, publisher-approved release.</p>
        {!authenticated ? (
          <p role="status">Your encrypted profile is not ready. Sign in and unlock your profile before reviewing your saved Afterglow.</p>
        ) : (
          <>
            <div className={styles.metric}><strong>{sources.length}</strong><span>saved working version{sources.length === 1 ? "" : "s"} found in this profile</span></div>
            {sources.length ? (
              <ol className={styles.sourceList}>
                {sources.map(source => {
                  const summary = sourceSummaries.get(source.id);
                  return <li key={source.id} className={styles.sourceRow}>
                    <div className={styles.sourceHeading}>
                      <strong>{displayDate(source.updatedAt)}</strong>
                      <span>Saved working copy · {source.id.slice(0, 8)}</span>
                    </div>
                    {summary ? (
                      <>
                        <p className={styles.sourceBrief}>
                          <strong>{summary.completedFields} / {summary.possibleFields}</strong> Mind Map fields with saved answers
                          {" · "}<strong>{summary.contextCount}</strong> distinct context references
                          {summary.noteCount ? <>{" · "}{summary.noteCount} notes</> : null}
                          {summary.suggestionCount ? <>{" · "}{summary.suggestionCount} Agent suggestions</> : null}
                        </p>
                        <p className={styles.sourceTopics}>
                          {summary.topicBreakdown.length
                            ? "Includes: "+summary.topicBreakdown.slice(0, 4).map(topic => (
                              (LEARN_TOPIC_SPINE.find(item => item.id === topic.topicId)?.label ?? topic.topicId)
                              + " " + topic.count
                            )).join(" · ")
                            : "No authored Mind Map answers yet"}
                        </p>
                      </>
                    ) : <p className={styles.sourceBrief}>Summary unavailable — review or refresh this saved copy.</p>}
                  </li>;
                })}
              </ol>
            ) : <p>No saved Afterglow working versions were found. The provided example remains available in Library.</p>}
            <section aria-label="Other Afterglow recovery sources" className={styles.recoverySourceArea}>
              <h3>Older Afterglow states found in Data Recovery</h3>
              <p>These sources are separate from the {sources.length} active Library copies.
                They can contain missing character images, locks, Mind Map work or narration.
                This is a read-only inventory, not a restore or a completed merge.</p>
              {recoverySourceAudit.found.length ? (
                <ul className={styles.recoverySourceList}>
                  {recoverySourceAudit.found.map(source => <li key={source.key}>
                    <div className={styles.sourceHeading}>
                      <strong>{displayDate(source.date)}</strong>
                      <span>{source.description} · revision {source.revision}</span>
                    </div>
                    <p><strong>{source.fields.completedFields} / {source.fields.possibleFields}</strong> Mind Map fields
                      {" · "}{source.creative.characterCount} characters
                      {" · "}{source.creative.characterImageReferences} character image references
                      {" · "}{source.creative.lockedCharacterVersions} character versions locked</p>
                    <p>{source.creative.storyboardImages} Storyboard images
                      {" · "}{source.creative.lockedStoryboardImages} locked
                      {" · "}{source.creative.approvedNarrationCount} narration approvals</p>
                    {source.creative.characterNames.length ? <p>Characters: {source.creative.characterNames.join(", ")}</p> : null}
                    <p className={styles.recoverySourceNotice}>
                      {preview?.sources.some(item=>item.id===source.key)
                        ? "Included in current draft comparison — not saved or media-verified."
                        : "Will be included in Review consolidation — not yet saved or media-verified."}
                    </p>
                  </li>)}
                </ul>
              ) : <p>No additional readable Afterglow recovery snapshots were found in this signed-in profile.</p>}
              {recoverySourceAudit.warnings.length ? <ul className={styles.recoverySourceWarnings}>
                {recoverySourceAudit.warnings.map((warning,index)=><li key={index}>{warning}</li>)}
              </ul> : null}
              <p>Operations → Data Recovery remains the place to preview or intentionally restore
                a whole saved state. Legacy disk backups must be separately inspected and imported before
                Afterglow can treat them as merge sources. Nothing is restored here.</p>
            </section>
            <div className={styles.actions}>
              <button type="button" disabled={busy || mediaBusy || preflightBusy} onClick={refresh}>Refresh saved versions</button>
              <button type="button" disabled={busy || mediaBusy || preflightBusy || (!sources.length && !recoverySourceAudit.found.length)} onClick={() => void reviewConsolidation()}>
                {busy ? "Reviewing…" : "Review consolidation"}
              </button>
            </div>
          </>
        )}
        {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
        {lastSaveAudit?.status === "blocked" && !saveReceipt && !saveError ? (
          <section role="alert" className={styles.saveFailure} aria-label="Previous Afterglow save was blocked">
            <strong>NOT SAVED — last consolidation attempt was blocked</strong>
            <p>{lastSaveAudit.message || "The independent master verification did not complete."}</p>
            <p>Verification stage: {lastSaveAudit.stage}. Attempt: {displayDate(lastSaveAudit.at)}.
              Your earlier saved copies were not replaced.</p>
          </section>
        ) : null}
        {lastSaveAudit?.status === "started" && !saveReceipt && !saveError ? (
          <p role="status" className={styles.caution}>The previous consolidation has no completed save receipt.
            Do not assume a master was created; check the encrypted Library before retrying.</p>
        ) : null}
        {saveReceipt ? <section className={styles.consolidatedResult}
          role="status" aria-label="Consolidated Afterglow saved confirmation">
          <h3>{saveReceipt.libraryRefreshed
            ? "Consolidated Afterglow saved successfully and verified in Library."
            : "Consolidated Afterglow saved on the server; Library opening is not verified."}</h3>
          <p>Your current personal Afterglow now contains your confirmed creative choices.
            <strong> {saveReceipt.decisionsCompleted}</strong> review decisions were accepted from
            <strong> {saveReceipt.sourceCount}</strong> saved source states, with
            <strong> {saveReceipt.historicalSources}</strong> historical sources preserved.
            The new encrypted master passed independent readback.</p>
          {saveReceipt.libraryRefreshed ? <p><strong>To continue:</strong> go to Library → Examples → Afterglow
            and select your saved personal version, not “Load the provided example.”
            The original packaged example is a separate fresh starting point.</p> : null}
          <p>You may return to Afterglow Recovery to review previous saved points.
            Your original working versions and recovery history remain protected;
            general Data Recovery is still separate.</p>
          {!saveReceipt.libraryRefreshed ? <p className={styles.caution} role="alert">
            The server verified your encrypted master, but the exact saved project
            is missing from the refreshed Library. Do not create another example,
            repeat consolidation, or overwrite recovery points. Reopen your profile
            to refresh the Library; if the saved master still is not listed,
            keep your original recovery history intact for diagnosis.
            Saved master ID: {saveReceipt.masterId}.
          </p> : null}
          <p>This is your personal master only. Publishing the official Afterglow
            for new users requires separate publisher approval.</p>
        </section> : null}
        {saveError ? <p role="alert" className={styles.caution}>{saveError}</p> : null}
        {preview ? (
          <section className={styles.result} aria-labelledby="afterglow-preview-heading">
            <h3 id="afterglow-preview-heading">Find your saved Afterglow work — not saved</h3>
            <p><strong>{preview.sources.length}</strong> saved Afterglow snapshots compared,
              including <strong>{preview.includedHistoricalSources}</strong> recovery points or archived working copies.
              {" "}<strong>{preview.recovery.recoveredItemCount}</strong> saved additions or edits found beyond the provided example;
              {" "}<strong>{preview.recovery.differingValueCount}</strong> fields or artifacts have different saved versions to compare.
              Repeated identical answers are listed once, with every source shown.</p>
            {preview.sourceWarnings.length ? <p role="status" className={styles.notice}>
              {preview.sourceWarnings.length} historical sources could not be included. Inspect their warnings above.
              This draft must not be treated as the complete recovered master.
            </p> : null}
            <section aria-label="Draft master selection" className={styles.creativeReview}>
              <h3>Build one current Afterglow</h3>
              <p>Distinct compatible work from all saved dates is included automatically. You can exclude a particular
                field from the draft or choose between different saved versions below. These choices affect only
                the proposed master — they do not change, delete or archive a saved version.</p>
              <p role="status">
                <strong>{Math.max(0,preview.appliedCount-exclusions.length)}</strong> compatible updates included;
                {" "}<strong>{exclusions.length}</strong> explicitly excluded;
                {" "}<strong>{reviewed?.resolved.length ?? 0}</strong> competing choices selected;
                {" "}<strong>{pendingHumanChoices}</strong> creative choices still needed.
                {" "}<strong>{creativeChoices.verification.length}</strong> technical differences remain for independent verification, not Human selection.
              </p>
              <div className={styles.reviewProgress} role="status" aria-label="Consolidation review progress">
                <strong>{reviewProgress.completed} of {reviewProgress.total} creative choices confirmed</strong>
                <p>{reviewProgress.pending ? reviewProgress.pending+" choices still need your decision.":
                  "All listed creative choices are confirmed. Independent recovery and media verification is still required before saving."}</p>
                <progress max={Math.max(1,reviewProgress.total)} value={reviewProgress.completed}
                  aria-label="Creative review completion"/>
                {reviewProgress.sections.map(section=><div className={styles.reviewSectionCount} key={section.id}>
                  <span>{section.label}</span>
                  <strong className={section.completed===section.total ? styles.reviewConfirmed : styles.reviewCurrent}>
                    {section.completed} / {section.total} confirmed
                  </strong>
                </div>)}
                {reviewProgress.needsIndependentReview.length ? <p>
                  {reviewProgress.needsIndependentReview.length} additional nonselectable records remain
                  in independent preservation review and are not counted as approved.
                </p> : null}
              </div>
              <p>Yellow = current saved value, not yet confirmed for this consolidation.
                Green = your explicit Keep, Exclude, or selected alternative.
                All required choices must be decided before a consolidated save can be authorized.</p>
              {exclusions.length || Object.keys(decisions).length || Object.keys(imageChoices).length
                || Object.keys(confirmedCurrent).length ? (
                <button type="button" className={styles.selectionReset}
                  onClick={() => { setExclusions([]); setDecisions({}); setImageChoices({}); setConfirmedCurrent({}); }}>
                  Reset review decisions (originals unchanged)
                </button>
              ) : null}
            </section>
            <section aria-label="Review character image WebPs" className={styles.imageReviewArea}>
              <h3>View and choose character images</h3>
              <p>Open the original WebP before deciding. A GitHub link appears only for an exact
                filename in the packaged Afterglow manifest. The packaged copy may differ from
                your historical local image; a matching filename is not proof of identical bytes.</p>
              <p>Keep retains the recovered reference in your draft; a newly restored partial version
                remains unlocked until its full image set and approvals can be verified.
                Exclude removes it only from the proposed master.</p>
              <p><strong>{preview.imageOptions.length}</strong> distinct character images found
                across the provided example and recovered sources.
                {" "}<strong>{Object.keys(imageChoices).length}</strong> explicit Keep/Exclude decisions.</p>
              {Array.from(new Set(preview.imageOptions.map(item=>item.characterId))).map(characterId=>{
                const images=preview.imageOptions.filter(item=>item.characterId===characterId);
                const views=new Set(images.map(afterglowImageSlotKey));
                const reviewedViews=[...views].filter(slot=>
                  reviewProgress.sections.find(section=>section.id==="images")?.items.some(item=>item.id===slot&&item.reviewed)).length;
                const shown=images.filter(item=>{
                  const slot=afterglowImageSlotKey(item);
                  const kept=images.find(version=>afterglowImageSlotKey(version)===slot&&imageChoices[version.key]==="keep");
                  return !kept||Boolean(expandedImageSlots[slot])||kept.key===item.key;
                });
                return <details key={characterId} className={styles.imageCharacter}>
                  <summary>{images[0].characterName} · {reviewedViews}
                    / {views.size} views reviewed</summary>
                  <div className={styles.imageGrid}>{shown.map(item=>{
                    const inDraft=Boolean(reviewed && imageIncludedInCandidate(reviewed.candidate,item));
                    const conflicting=reviewed?.candidate.worldMap?.characterVisuals?.some(pack=>
                      pack.characterId===item.characterId &&
                      pack.references.some(ref=>ref.id===item.id && ref.assetUrl!==item.url));
                    const lockedVersionConflict=reviewed?.candidate.worldMap?.characterVisuals?.some(pack=>
                      pack.characterId===item.characterId && pack.lockedVersionId===item.versionId
                      && !pack.references.some(ref=>ref.id===item.id&&ref.assetUrl===item.url));
                    const blocked=item.conflictingSourceMetadata||Boolean(conflicting)||Boolean(lockedVersionConflict);
                    return <article key={item.key} className={styles.imageCard}
                      data-afterglow-decision-state={imageChoices[item.key] ? "confirmed" : "current"}>
                      <AfterglowWebpThumbnail item={item}/>
                      <strong>{item.characterName} · {item.view}</strong>
                      <small>Saved version: {item.versionId}</small>
                      <small>Source snapshots: {item.sourceIds.length}</small>
                      <p className={styles.imageLinks}>
                        <a href={item.url} target="_blank" rel="noopener noreferrer">View original WebP</a>
                        {item.githubUrl ? <a href={item.githubUrl} target="_blank" rel="noopener noreferrer">
                          View on GitHub (packaged copy)</a> : null}
                      </p>
                      <p className={imageChoices[item.key] ? styles.reviewConfirmed : styles.reviewCurrent}>
                        {imageChoices[item.key]==="keep"?"Kept for consolidated draft"
                          :imageChoices[item.key]==="exclude"?"Excluded from consolidated draft"
                          :inDraft?"Current image — confirm Keep or Exclude"
                            :"Recovered option — confirm Keep or Exclude"}
                      </p>
                      {blocked ? <p className={styles.caution}>
                        {lockedVersionConflict ? "This image belongs to a locked version. Verify the complete character version first."
                          : "Conflicting reference identity or metadata. Verify the saved source before keeping this image."}
                      </p> : null}
                      <div className={styles.creativeActions}>
                        <button type="button" aria-pressed={inDraft}
                          disabled={busy||mediaBusy||preflightBusy||blocked}
                          onClick={()=>setImageChoices(previous=>selectAfterglowImageOption(
                            preview.imageOptions,previous,item.key,"keep"))}>Keep</button>
                        <button type="button" aria-pressed={imageChoices[item.key]==="exclude"}
                          disabled={busy||mediaBusy||preflightBusy||item.conflictingSourceMetadata}
                          onClick={()=>setImageChoices(previous=>selectAfterglowImageOption(
                            preview.imageOptions,previous,item.key,"exclude"))}>Exclude</button>
                        {imageChoices[item.key]==="keep" ? <button type="button"
                          onClick={()=>{const slot=afterglowImageSlotKey(item);
                            setExpandedImageSlots(previous=>({...previous,[slot]:!previous[slot]}));}}>
                          {expandedImageSlots[afterglowImageSlotKey(item)]?"Hide alternatives":"View other saved versions"}
                        </button> : null}
                        {imageChoices[item.key]==="keep" && expandedImageSlots[afterglowImageSlotKey(item)]
                          ? <button type="button" onClick={()=>{
                            const slot=afterglowImageSlotKey(item);
                            setImageChoices(previous=>resetAfterglowImageSlot(preview.imageOptions,previous,slot));}}>
                            Change selection
                          </button> : null}
                      </div>
                      {imageReview?.clearedLocks.some(lock=>lock.characterId===item.characterId) ?
                        <small className={styles.caution}>Excluding the last image in a locked version
                          clears that lock in the proposed draft only. The saved original stays locked.</small> : null}
                    </article>;
                  })}</div>
                </details>;
              })}
            </section>
            <section aria-label="Recovered Mind Map and character work" className={styles.recoveryArea}>
              <h3>CONSOLIDATED creative work</h3>
              <p>This is your proposed Afterglow assembled from the saved versions.
                A creative choice updates this draft immediately. Other saved alternatives stay available
                for comparison. An Agent suggestion is not automatically an accepted answer.
                Unverified artwork is not silently approved.
                Original versions are unchanged; nothing has been saved yet.</p>
              {preview.recovery.recoveredItemCount ? preview.recovery.groups.filter(group=>group.items.length
                && group.id!=="visuals").map((group,index)=>(
                <details key={group.id} open={index === 0}>
                  <summary><strong>{group.label}</strong> · {reviewProgress.sections.find(section=>section.id===group.id)?.completed ?? 0}
                    / {reviewProgress.sections.find(section=>section.id===group.id)?.total ?? 0} confirmed</summary>
                  <ul className={styles.recoveryList}>
                    {group.items.map(item=>{
                      const path=afterglowRecoveryItemPath(item,canonicalFields);
                      const automaticallyIncluded=Boolean(path && preview.plan.applied.some(change=>change.path===path));
                      const excluded=Boolean(path && exclusions.includes(path));
                      const conflict=path ? preview.conflicts.find(change=>change.path===path
                        && change.reason==="competing-values") : null;
                      const pathConfirmed=Boolean(path && (
                    exclusions.includes(path)||decisions[path]!==undefined||confirmedCurrent[path]));
                  return <li key={item.kind+item.id}
                    data-afterglow-decision-state={pathConfirmed?"confirmed":"current"}>
                        <strong>{item.label}</strong>
                        <span className={styles.recoveryKind}>{item.kind === "unaccepted-agent-suggestion"
                          ? "Agent suggestion only — not accepted"
                          : item.kind === "human-note" ? "Working note — not story canon"
                            : item.kind.startsWith("saved-image") ? "Image/lock reference — media not yet verified"
                              : item.kind === "unknown-field-answer" ? "Saved answer — field identity needs checking"
                                : "Saved answer"}</span>
                        {excluded ? <p className={styles.consolidatedStatus}>Excluded from this draft by your choice.</p>
                          : conflict && decisions[conflict.path] !== undefined ? (
                            <div className={styles.consolidatedResult}>
                              <strong>YOUR CHOICE — included in consolidated draft</strong>
                              <p>{decisions[conflict.path] === "baseline"
                                ? "Keep the original provided example."
                                : readableCreativeChoice(conflict.options?.[Number(decisions[conflict.path])])
                                  ?? "Your approved choice is recorded; structural evidence must be verified."}</p>
                            </div>
                          ) : conflict ? <p className={styles.reviewCurrent}>Current alternative — choose a saved version to confirm.</p>
                          : automaticallyIncluded && item.alternatives.length===1
                            ? <div className={confirmedCurrent[path!] ? styles.consolidatedResult : styles.currentResult}>
                                <strong>{confirmedCurrent[path!] ? "Current value confirmed" :
                                  "Current value — not yet confirmed"}</strong>
                                <p>{item.alternatives[0].text}</p></div>
                            : <p className={styles.consolidatedStatus}>Recovered for review — not yet confirmed in the draft.</p>}
                        <details className={styles.savedAlternatives} open={Boolean(conflict && decisions[conflict.path]===undefined)}>
                          <summary>{conflict ? "Choose or change which saved version to use"
                            : "View saved sources and alternative versions"}</summary>
                          {item.alternatives.map((alternative,index)=>{
                            const optionIndex=conflict?.options?.findIndex((option,position)=>
                              readableCreativeChoice(option)?.trim() === alternative.text
                              && alternative.sources.some(source=>source.id === conflict.optionSources?.[position])) ?? -1;
                            return <div key={index} className={styles.recoveryValue}>
                              <p>{alternative.text}</p>
                              <small>Saved in {alternative.sources.map(source=>{
                                const matched=preview.sources.find(item=>item.id===source.id);
                                const kind=matched?.kind==="recovery-point"?"Recovery point"
                                  :matched?.kind==="archived-copy"?"Archived copy":"Working copy";
                                return kind+" · "+displayDate(matched?.savedAt??source.updatedAt)
                                  +" ("+source.id.slice(0,12)+")";
                              }).join(", ")}</small>
                              {conflict && optionIndex >= 0 ? (
                                <button type="button" className={styles.creativeOption}
                                  aria-pressed={decisions[conflict.path] === optionIndex}
                                  disabled={busy || mediaBusy || preflightBusy}
                                  onClick={()=>setDecisions(previous=>({...previous,[conflict.path]:optionIndex}))}>
                                  {decisions[conflict.path] === optionIndex ? "Your selected version" : "Use this saved version"}
                                </button>
                              ) : null}
                            </div>;
                          })}
                        </details>
                        {automaticallyIncluded ? (
                          <div className={styles.creativeActions}>
                            <span className={confirmedCurrent[path!]||excluded ? styles.reviewConfirmed : styles.reviewCurrent}>
                              {excluded?"Excluded by your choice":confirmedCurrent[path!]?
                                "Current value confirmed":"Current value not reviewed"}</span>
                            <button type="button" disabled={busy || mediaBusy || preflightBusy}
                              aria-pressed={Boolean(confirmedCurrent[path!])&&!excluded}
                              onClick={()=>{setExclusions(previous=>previous.filter(entry=>entry!==path));
                                setConfirmedCurrent(previous=>({...previous,[path!]:true}));}}>
                              Confirm current
                            </button>
                            <button type="button" disabled={busy || mediaBusy || preflightBusy}
                              aria-pressed={excluded}
                              onClick={()=>{setConfirmedCurrent(previous=>({...previous,[path!]:false}));
                                setExclusions(previous=>excluded
                                  ? previous.filter(entry=>entry!==path):[...previous,path!]);}}>
                              {excluded ? "Reconsider exclusion" : "Exclude from draft"}
                            </button>
                          </div>
                        ) : conflict ? (
                          <div className={styles.creativeActions}>
                            <span>{decisions[conflict.path] === undefined ? "Choose which saved answer to keep" : "A draft choice is selected"}</span>
                            <button type="button" disabled={busy || mediaBusy || preflightBusy}
                              onClick={()=>setDecisions(previous=>({...previous,[conflict.path]:"baseline"}))}>
                              {decisions[conflict.path] === "baseline" ? "Original example selected" : "Keep original example value"}
                            </button>
                          </div>
                        ) : null}
                      </li>;
                    })}
                  </ul>
                </details>
              )) : <p>No authored additions differing from the provided example were found in these saved copies.
                This does not search other profiles or unsaved Agent conversations.</p>}
            </section>
            {creativeChoices.human.length ? (
              <section aria-label="Compare saved creative decisions" className={styles.creativeReview}>
                <h3>Consolidated Graphic Novel and story decisions</h3>
                <p>These are places where the same shot or story decision was saved differently.
                  Choose the version you want. Other independent edits are already included.</p>
                {creativeChoices.human.map(conflict=>{
                  const category=describeAfterglowConsolidationConflict(conflict.path);
                  const approvedKind=true;
                  const options=conflict.options ?? [];
                  return <div key={conflict.path} className={styles.creativeConflict}>
                    <strong>{category.label}</strong>
                    {decisions[conflict.path] !== undefined ? <div className={styles.consolidatedResult}>
                      <strong>YOUR CHOICE — included in consolidated draft</strong>
                      <p>{decisions[conflict.path] === "baseline" ? "Keep the provided example"
                        : readableCreativeChoice(options[Number(decisions[conflict.path])])
                          ?? "Saved creative choice selected"}</p>
                    </div> : <p className={styles.consolidatedStatus}>Choose one saved version for your draft.</p>}
                    <details open={decisions[conflict.path] === undefined} className={styles.savedAlternatives}>
                      <summary>Choose or change saved version</summary>
                    {options.map((option,index)=>{
                      const text=readableCreativeChoice(option);
                      const source=preview.sources.find(item=>item.id===conflict.optionSources?.[index]);
                      const selectable=approvedKind && Boolean(text);
                      return <div key={index} className={styles.recoveryValue}>
                        <small>{source ? (source.kind==="recovery-point"?"Recovery point · "
                          :source.kind==="archived-copy"?"Archived copy · ":"Working copy · ")
                          +displayDate(source.savedAt??source.updatedAt) : "Saved copy"}
                          {" · "}{source?.id.slice(0,12) ?? "source"}</small>
                        <p>{text ?? "Technical creative content cannot be presented as an approved answer without verified text."}</p>
                        {selectable ? <button type="button" className={styles.creativeOption}
                          disabled={busy || mediaBusy || preflightBusy}
                          aria-pressed={decisions[conflict.path] === index}
                          onClick={()=>setDecisions(previous=>({...previous,[conflict.path]:index}))}>
                          {decisions[conflict.path] === index ? "Selected for draft" : "Use this saved version"}
                        </button> : null}
                      </div>;
                    })}
                    {approvedKind ? <button type="button" className={styles.selectionReset}
                      disabled={busy || mediaBusy || preflightBusy}
                      aria-pressed={decisions[conflict.path] === "baseline"}
                      onClick={()=>setDecisions(previous=>({...previous,[conflict.path]:"baseline"}))}>
                      {decisions[conflict.path] === "baseline"
                        ? "Original example selected" : "Exclude these alternatives; retain original example"}
                    </button> : <p>This approval collection cannot safely be resolved as a single choice.
                      Its original artifacts and locks remain protected pending individual reconciliation.</p>}
                    </details>
                  </div>;
                })}
              </section>
            ) : null}
            {creativeChoices.verification.length ? <p className={styles.caution}>
              {creativeChoices.verification.length} media, approval, timestamp or structural differences
              still need independent verification. These are not choices you should make
              from technical IDs. No original data is discarded or automatically approved.
            </p> : null}
            <p className={styles.caution}>Draft selection only. Save Current Master will become available
              only after all original saves, media, narration, and the final encrypted readback are verified.</p>
            <details>
              <summary>Advanced consolidation diagnostics — field, question and media evidence</summary>
              <p><strong>{preview.appliedCount}</strong> proposed field/entity changes;
                <strong> {preview.reconciledVisualCount}</strong> saved visual acceptances reconciled by artifact evidence;
                <strong> {preview.conflictCount}</strong> conflicting paths;
                <strong> {preview.reviewCount}</strong> structural review items;
                <strong> {preview.sourceMediaCount}</strong> source-media URLs awaiting verification.</p>
              <p><strong>{preview.questionEvidence.length}</strong> authored fields traced to saved changes;
                <strong> {preview.questionEvidence.filter(item=>item.questionStatus === "canonical-question-matched").length}</strong> matched to original questions;
                <strong> {preview.questionEvidence.filter(item=>item.questionStatus !== "canonical-question-matched").length}</strong> question identities still unverified.</p>
              <details>
                <summary>Question-to-answer evidence (original field identity, not a semantic quality verdict)</summary>
                <ul>{preview.questionEvidence.map(item=><li key={item.fieldId}>
                  <strong>{item.question ?? "Original question not found — review required"}</strong>
                  {" · "}{item.sourceProjectIds.length} saved source{item.sourceProjectIds.length === 1 ? "" : "s"},
                  {" "}{item.distinctAnswers} distinct recorded answer{item.distinctAnswers === 1 ? "" : "s"}.
                  {" "}Textual relevance has not been independently assessed.
                </li>)}</ul>
              </details>
            </details>
            <p>The original saves may contain images not yet present in this draft master.
              This count does not verify the files exist or can be read. The selected draft currently has
              {" "}<strong>{reviewed?.localAssetsToVerify.length ?? preview.localAssetCount}</strong> local asset URLs identified for later readback.</p>
            <div className={styles.actions}>
              <button type="button" disabled={busy || mediaBusy || preflightBusy} onClick={() => void verifyMediaEvidence()}>
                {mediaBusy ? "Reading saved media…" : "Verify source and selected media (read-only)"}
              </button>
            </div>
            {mediaNotice ? <p role="status" className={styles.notice}>{mediaNotice}</p> : null}
            {mediaReport ? (
              <section className={styles.result} aria-label="Afterglow media verification results">
                <h3>Media readback — not a master save</h3>
                <p><strong>{mediaReport.selectedCount}</strong> media URLs selected for the draft;
                  {" "}<strong>{mediaReport.historyCount}</strong> additional historical URLs inspected;
                  {" "}<strong>{mediaReport.verifiedPinned}</strong> selected items match a packaged manifest digest;
                  {" "}<strong>{mediaReport.readableWithoutSavedProof}</strong> selected items readable but not historically pinned;
                  {" "}<strong>{mediaReport.failed}</strong> selected items missing, invalid or changed.</p>
                <p>Local inventory SHA-256 proves only the bytes seen during this inspection.
                  A stored historical content hash is still needed to prove local image identity at Save Current Master.
                  Readback does not grant write or publishing authority.</p>
                {mediaReport.results.some(item => !["verified-pinned","verified-current"].includes(item.status)) ? (
                  <details><summary>Media evidence and unresolved items</summary>
                    <ul>{mediaReport.results.filter(item=>!["verified-pinned","verified-current"].includes(item.status))
                      .map(item=><li key={item.url}>
                        <strong>{item.selected ? "Proposed master" : "Recoverable historical copy"}</strong>
                        {" · "}{item.status}: {item.reason} ({item.url})
                      </li>)}</ul>
                  </details>
                ) : null}
              </section>
            ) : null}
            {mediaReport ? (
              <div className={styles.actions}>
                <button type="button" disabled={busy || mediaBusy || preflightBusy
                  || Boolean(preview.includedHistoricalSources || preview.sourceWarnings.length)}
                  onClick={() => void checkMasterSavePreflight()}>
                  {preflightBusy ? "Checking source integrity…" : "Check master save readiness (read-only)"}
                </button>
              </div>
            ) : null}
            {preview.includedHistoricalSources ? <p className={styles.caution}>
              Recovery-point contributions are now compared and selectable in the same draft.
              The final save readiness check remains disabled until historical encrypted
              snapshot identity and media provenance can be independently verified.
              Your original saves and Data Recovery history remain unchanged.
            </p> : null}
            {preflightNotice ? <p role="status" className={styles.notice}>{preflightNotice}</p> : null}
            {preflightReport ? (
              <section className={styles.result} aria-label="Afterglow master preflight results">
                <h3>Save readiness — not authorized</h3>
                <p>{preflightReport.sourceCount} source versions fingerprinted;
                  {" "}{preflightReport.questionCount} authored questions traced;
                  {" "}{preflightReport.selectedMediaCount} media references selected;
                  {" "}{preflightReport.blockers.length} readiness blockers.</p>
                <ul>{preflightReport.blockers.map((item,index)=><li key={item.code+index}>
                  <strong>{item.code}</strong>: {item.detail}
                </li>)}</ul>
                <p>No Save Current Master action is enabled. This preflight does not grant write authority.</p>
              </section>
            ) : null}
            <p>{preview.mergeShapeConsistent
              ? "The compared changes have no detected structural conflicts. This is not approval: source media and a durable round-trip still need verification."
              : "The merged master cannot be saved yet. Conflicts or ambiguous changes require explicit decisions."}</p>
            {preview.conflictCount ? (
              <details aria-label="Resolve competing saved values" className={styles.decisionArea}>
                <summary>Advanced verification details — {preview.conflictCount} unresolved differences (not your creative choices)</summary>
                <h3>Technical preservation checks</h3>
                <p>These are raw storage differences for independent verification. Your creative decisions are
                  already in CONSOLIDATED creative work above. Do not choose media IDs, timestamps, hashes,
                  or approval records as if they were story answers. No selection here saves or deletes anything.</p>
                {preview.conflicts.slice(conflictPage * 10, (conflictPage + 1) * 10).map((item, index) => {
                  const id = "afterglow-conflict-" + (conflictPage * 10 + index);
                  const category = describeAfterglowConsolidationConflict(item.path);
                  const canonicalQuestion = canonicalQuestionForPath(item.path, questionByField);
                  const selectable = false; // Human choices live only in CONSOLIDATED creative work.
                  return (
                    <div className={styles.decisionRow} key={item.path}>
                      <div className={styles.conflictHeading}>
                        <strong>{category.label}</strong>
                        <span>{item.reason}</span>
                        {canonicalQuestion ? <p className={styles.question}><strong>Original question:</strong> {canonicalQuestion}</p> : null}
                        <code>{item.path}</code>
                      </div>
                      {selectable ? (
                        <select id={id} aria-label={"Choose " + category.label + " from saved alternatives"}
                          value={decisions[item.path] === undefined ? "" : String(decisions[item.path])}
                          onChange={event => setDecisions(previous => {
                            const next = { ...previous };
                            if (!event.target.value) delete next[item.path];
                            else next[item.path] = event.target.value === "baseline"
                              ? "baseline" : Number(event.target.value);
                            return next;
                          })}>
                          <option value="">Choose an approved value…</option>
                          <option value="baseline">Keep the provided baseline value</option>
                          {item.options?.map((value, optionIndex) => (
                            <option value={optionIndex} key={optionIndex}>
                              {"Saved " + (item.optionSources?.[optionIndex] ?? "version").slice(0, 22)
                                + ": " + summarizeHumanValue(value, item.path)}
                            </option>
                          ))}
                        </select>
                      ) : <p>{category.kind === "visual-approval-collection"
                        ? "Approved visual artifacts must be reconciled individually against saved image, lock, and acceptance evidence. Do not select an entire saved list."
                        : category.kind === "authorship-metadata"
                          ? "The timestamp belongs with the selected approved story value. It is not a separate creative choice."
                          : "This approval collection requires per-shot review. Choosing a whole list could drop valid approvals."}</p>}
                      {selectable ? (
                        <details>
                          <summary>Compare human-readable saved alternatives</summary>
                          {item.options?.map((value, optionIndex) => (
                            <div key={optionIndex}>
                              <p>Saved copy: {item.optionSources?.[optionIndex] ?? "Unknown source"}</p>
                              <p className={styles.approvalSummary}>{summarizeHumanValue(value, item.path)}</p>
                              {value && typeof value === "object" && !Array.isArray(value)
                                && "sourceKey" in value ? <p>Source fingerprint recorded — not yet verified against the selected locked image.</p> : null}
                              <details><summary>Advanced technical evidence</summary>
                                <pre className={styles.valueDetail}>{JSON.stringify(value, null, 2)}</pre>
                              </details>
                            </div>
                          ))}
                        </details>
                      ) : null}
                    </div>
                  );
                })}
                {preview.conflictCount > 10 ? (
                  <div className={styles.actions}>
                    <button type="button" disabled={conflictPage <= 0} onClick={() => setConflictPage(p => Math.max(0, p - 1))}>Previous conflicts</button>
                    <span className={styles.status}>Page {conflictPage + 1} of {Math.ceil(preview.conflictCount / 10)}</span>
                    <button type="button" disabled={(conflictPage + 1) * 10 >= preview.conflictCount} onClick={() => setConflictPage(p => p + 1)}>Next conflicts</button>
                  </div>
                ) : null}
                <p role="status"><strong>{reviewed?.resolved.length ?? 0}</strong> saved creative selections;
                  <strong> {reviewed?.unresolvedConflicts.length ?? preview.conflictCount}</strong> remaining conflicting paths;
                  <strong> {preview.reviewCount}</strong> other items requiring deterministic reconciliation.
                  These are not necessarily additional Human approvals.</p>
                <p>{reviewed?.decisionShapeConsistent
                  ? "All reported structural choices are accounted for. Media verification, an approved durable master, and restart readback are still required."
                  : "The master is not ready to save; some changes still require review."}</p>
              </details>
            ) : null}
            {preview.needsReview.length ? (
              <details><summary>Unresolved review items (first 35)</summary>
                <ul>{preview.needsReview.map((item, index) =>
                  <li key={item.path + index}>{item.path} — {item.reason}</li>)}</ul>
              </details>
            ) : null}
            {preview.sampleChanges.length ? (
              <details><summary>Proposed changes (first 35)</summary>
                <ul>{preview.sampleChanges.map((item, index) => <li key={item.path + index}>{item.path}</li>)}</ul>
              </details>
            ) : null}
            <section className={styles.saveMasterArea} aria-label="Save Consolidated Afterglow">
              <h3>Save Consolidated Afterglow</h3>
              <p><strong>{reviewProgress.completed} of {reviewProgress.total}</strong> creative
                classifications explicitly confirmed. Every required classification must
                be resolved before saving. Structural and media evidence is checked again
                independently on the authenticated server.</p>
              <button type="button" disabled={busy||mediaBusy||preflightBusy||
                !reviewProgress.allCreativeDecided||Boolean(reviewProgress.needsIndependentReview.length)||
                Boolean(preview.sourceWarnings.length)}
                onClick={()=>void saveConsolidatedMaster()}>
                {busy?"Creating verified consolidated Afterglow…":"Save Consolidated Afterglow"}
              </button>
              {saveError ? <div role="alert" className={styles.saveFailure}>
                <strong>NOT SAVED — consolidated Afterglow was rejected</strong>
                <p>{saveError}</p>
                <p>The reviewed choices have been retained on this page.
                  Your older saved copies and recovery points remain available.
                  Do not interpret this attempt as a consolidated master.</p>
              </div> : null}
              {reviewProgress.pending>0?<p className={styles.reviewCurrent}>
                {reviewProgress.pending} choices still need your confirmation; save is disabled.
              </p>:null}
              <p>Your choices create a new personal master only after encrypted readback.
                Older copies and recovery points are preserved, not deleted. An unverified
                file, conflict, missing question or altered source blocks the save.</p>
            </section>
          </section>
        ) : null}
      </section>

      <section className={styles.panel} aria-labelledby="afterglow-baseline-heading">
        <h2 id="afterglow-baseline-heading">Return to Provided Baseline</h2>
        <p>This future account-owned action will make a fresh working copy from the verified installed example,
          keeping your current master and history recoverable. The reset action is not yet enabled:
          PlotPickle must first prove the exact installed baseline and backup/readback path.</p>
      </section>
      <section className={styles.panel} aria-labelledby="afterglow-publish-heading">
        <h2 id="afterglow-publish-heading">Publish Official Example</h2>
        <p>Your personal Afterglow remains your own, continuously editable version. When the designated publisher
          approves a complete master for the next PlotPickle release, a separate permission-checked GitHub
          publication can update the official example installed by future users. Signing in and saving
          your own work never publishes it for everyone else. No public publishing action is available on this screen.</p>
      </section>
    </div>
  );
}
