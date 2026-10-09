import { normalizeStoryMapContextRegistry } from "../../../../core/storage/story-map-context";
import { randomUUID,createHash } from "node:crypto";
import {readServerAfterglowSources,prepareServerAfterglowMaster}
  from "../../../../modules/library/master/afterglow-master-server";
import type { ProfileProjectSummary } from "../../../../core/storage/profile-private/profile-private-storage";
import { normalizeLibraryProject } from "../../../../core/storage/library-project";
import { toPublicAuthError } from "../../../../core/auth/plotpickle-auth";
import { toPublicServerSessionError } from "../../../../core/auth/server-session/server-session-boundary";
import {
  getProfileExperienceRuntime,
  requestBoundary,
} from "../../../../core/auth/profile-experience/profile-experience-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function normalizeRecoveryPoints(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const id = typeof source.id === "string" ? source.id.trim().slice(0, 360) : "";
    const projectId = typeof source.projectId === "string" ? source.projectId.trim().slice(0, 240) : "";
    const title = typeof source.title === "string" ? source.title.trim().slice(0, 500) : "";
    const createdAt = typeof source.createdAt === "string" ? source.createdAt.trim().slice(0, 80) : "";
    const reason = source.reason === "unload" || source.reason === "manual" || source.reason === "pre-restore" ? source.reason : null;
    if (!id || !projectId || !title || !createdAt || !reason || !source.project) return [];
    try {
      const project = normalizeLibraryProject(source.project);
      if (project.id !== projectId) return [];
      return [{
        id,
        projectId,
        title,
        revision: Number.isInteger(source.revision) ? Number(source.revision) : project.revision,
        createdAt,
        reason,
        project,
      }];
    } catch {
      return [];
    }
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function errorResponse(error: unknown) {
  const server = toPublicServerSessionError(error);
  const auth = toPublicAuthError(error);
  const detail = server.code !== "SERVER_SESSION_FAILED" ? server : auth;
  return response(detail, detail.code === "ACCESS_DENIED" ? 403 : 400);
}

async function authorized(request: Request, mutation = false) {
  const runtimeState = await getProfileExperienceRuntime();
  const boundary = runtimeState.boundaryFor(new URL(request.url).origin);
  const { authContext } = await boundary.authorizeRequest(requestBoundary(request), mutation ? { mutation: true } : undefined);
  return { runtimeState, authContext };
}

export async function GET(request: Request) {
  try {
    const { runtimeState, authContext } = await authorized(request);
    if (new URL(request.url).searchParams.get("afterglowSaveAudit") === "1") {
      return response({ lastSave: await runtimeState.privateStorage.readPrivateJson(authContext, {
        domain: "cache", objectId: "afterglow-master-last-attempt",
      }) });
    }
    const summaries = await runtimeState.privateStorage.listProjects(authContext);
    const project = await runtimeState.privateStorage.loadActiveProject(authContext).catch(() => null);
    const [projects, wyrmwood, storyMapContexts, recoveryPoints] = await Promise.all([
      Promise.all(summaries.map(async (summary) => {
        const savedProject = await runtimeState.privateStorage.loadProject(authContext, summary.projectId).catch(() => null);
        return savedProject ? { project: savedProject, summary } : null;
      })),
      runtimeState.privateStorage.readPrivateJson(authContext, { domain: "cache", objectId: "wyrmwood-state" }),
      runtimeState.privateStorage.readPrivateJson(authContext, { domain: "cache", objectId: "story-map-contexts" }),
      runtimeState.privateStorage.readPrivateJson(authContext, { domain: "cache", objectId: "library-recovery-points" }),
    ]);
    // A normal Library unload may clear the active story; that must not erase
    // proof of a previously committed personal Afterglow master. Resolve the
    // independent encrypted commit ledger, never a client-invented ID prefix.
    const possibleMasters = summaries.filter(summary =>
      !summary.archivedAt && summary.sourceKind === "example" && summary.sourceId === "afterglow-v9"
      && summary.projectId.startsWith("afterglow-consolidated-"));
    const verifiedMasters = (await Promise.all(possibleMasters.map(async summary => {
      const ledgerId = "afterglow-master-" + createHash("sha256").update(summary.projectId).digest("hex");
      const ledger = await runtimeState.privateStorage.readPrivateJson(authContext, {
        domain: "indexes", objectId: ledgerId,
      });
      const valid = ledger && typeof ledger === "object" && !Array.isArray(ledger)
        && (ledger as { masterId?: unknown }).masterId === summary.projectId;
      return valid ? { masterId: summary.projectId, updatedAt: summary.updatedAt } : null;
    }))).filter((entry): entry is { masterId: string; updatedAt: string } => entry !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return response({
      afterglowMaster: verifiedMasters[0] ?? null,
      afterglowLastSave: await runtimeState.privateStorage.readPrivateJson(authContext, {
        domain: "cache", objectId: "afterglow-master-last-attempt",
      }),
      project,
      activeProjectId: project && typeof project === "object" && !Array.isArray(project) && typeof (project as { id?: unknown }).id === "string" ? (project as { id: string }).id : null,
      projects: projects.filter((item): item is NonNullable<typeof item> => Boolean(item)),
      wyrmwood,
      storyMapContexts: normalizeStoryMapContextRegistry(storyMapContexts),
      recoveryPoints: normalizeRecoveryPoints(recoveryPoints),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { runtimeState, authContext } = await authorized(request, true);
    const input = await request.json() as Record<string, unknown>;
    if (input.action === "commit-afterglow-master") {
      const at = new Date().toISOString();
      let stage = "read-saved-sources";
      // Only diagnostic metadata is stored: never decisions, image URLs,
      // creative text, credentials or unverified client-controlled content.
      // Persist the result in the same encrypted Human profile as the story.
      const recordAttempt = async (value: Record<string, unknown>) => {
        await runtimeState.privateStorage.writePrivateJson(authContext, {
          domain: "cache", objectId: "afterglow-master-last-attempt",
          value: { version: 1, at, ...value },
        }).catch(() => undefined); // Diagnostics must not mutate save authority.
      };
      await recordAttempt({ status: "started", stage });
      try {
      // The browser supplies only choice evidence and source fingerprints.
      // Never accept a client-created master, ready flag, archive index or
      // provider approval as write authority.
      const selections=input.selections as {
        decisions:Record<string,number|"baseline">;
        exclusions:string[];
        confirmedCurrent:Record<string,boolean>;
        imageChoices:Record<string,"keep"|"exclude">;
      };
      const expectedSources=input.expectedSources as {key:string;digest:string}[];
      const inventory=await readServerAfterglowSources(runtimeState.privateStorage,authContext);
      const masterId="afterglow-consolidated-"+randomUUID();
      const createdAt=new Date().toISOString();
      stage = "verify-creative-choices";
      const prepared=await prepareServerAfterglowMaster({
        sources:inventory.sources,selections,expectedSources,masterId,now:createdAt,
      });
      if(prepared.progress.pending!==0||prepared.progress.total<1) {
        return response({message:"Every creative choice must be decided before saving."},409);
      }
      stage = "verify-saved-source-bytes";
      const originals=inventory.summaries.filter(s=>!s.archivedAt);
      const proofs=await Promise.all(originals.map(async s=>{
        const project=await runtimeState.privateStorage.loadProject(authContext,s.projectId);
        if(!project)throw new Error("A saved working Afterglow source is unavailable.");
        return {projectId:s.projectId,revision:(project as {revision:number}).revision,
          updatedAt:s.updatedAt,
          digest:"sha256:"+createHash("sha256").update(JSON.stringify(project)).digest("hex")};
      }));
      stage = "verify-images-and-commit";
      const result=await runtimeState.privateStorage.commitAfterglowMaster(authContext,{
        master:prepared.candidate,sources:proofs,selections,expectedSources,
      });
      stage = "verify-encrypted-master-readback";
      const readback=await runtimeState.privateStorage.loadAfterglowCurrentMaster(authContext);
      if(!readback || JSON.stringify(readback)!==JSON.stringify(normalizeLibraryProject(prepared.candidate))) {
        throw new Error("Afterglow was not confirmed after encrypted master readback.");
      }
      await recordAttempt({ status: "saved", stage: "complete", masterId: result.masterId });
      return response({ok:true,masterId:result.masterId,sourceCount:prepared.sourceCount,
        historicalSources:prepared.includedHistorical,
        archivedSourceCount:result.archivedSourceCount,
        decisionsCompleted:prepared.progress.completed,
        readbackVerified:true,
        message:"Consolidated Afterglow saved successfully."});
      } catch (error) {
        const message=error instanceof Error?error.message:"Afterglow verification could not complete.";
        // Only expose actionable, approved verification explanations to the
        // authenticated Human. Internal vault exceptions are not file paths.
        const userMessage=/^All creative sections|^Saved Afterglow source snapshots changed|^Saved alternatives remain|^A recovered answer has no|^Structural or media|^Every selection category|^An image|^A selected image|^Removing the last|^The proposed master differs|^Some Afterglow recovery sources|^A saved Afterglow Library copy|^Historical Afterglow recovery point|^Consolidated story has lost|^An unrecognized|^Invalid or partial Human decision|^Some saved recovery|^Selected packaged image|^Selected image file|^Selected image bytes|^A confirmed field/i.test(message)
          ? message : "Afterglow verification did not pass. Your earlier saved versions remain intact. Review the unresolved evidence and retry.";
        // The stage and actionable safe reason outlive navigation/restart.
        // No master is claimed when the encrypted commit was not acknowledged.
        const missingMedia = (error as { code?: unknown })?.code === "ENOENT"
          && stage === "verify-images-and-commit";
        const reason = missingMedia
          ? "A selected Storyboard or World Map image file cannot be found on this device. Nothing was consolidated. Inspect the saved media references before retrying."
          : userMessage !== "Afterglow verification did not pass. Your earlier saved versions remain intact. Review the unresolved evidence and retry."
            ? userMessage
            : `The ${stage.replaceAll("-", " ")} check did not pass. Your earlier saved versions remain intact.`;
        await recordAttempt({ status: "blocked", stage, message: reason });
        return response({code:"AFTERGLOW_SAVE_VERIFICATION_BLOCKED",stage,message:reason},409);
      }
    }
    if (input.action === "save-project") {
      const project = normalizeLibraryProject(input.project);
      const summary = input.summary && typeof input.summary === "object" && !Array.isArray(input.summary)
        ? input.summary as Partial<ProfileProjectSummary>
        : undefined;
      const saved = await runtimeState.privateStorage.saveProject(authContext, {
        project,
        summary,
        activate: input.activate === false ? false : true,
      });
      return response({ projectId: saved.summary.projectId });
    }
    if (input.action === "sync-library") {
      if (!Array.isArray(input.projects)) return response({ message: "Invalid Library inventory." }, 400);
      const projects = input.projects.map((entry) => {
        const value = entry && typeof entry === "object" && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
        return {
          project: normalizeLibraryProject(value.project),
          summary: value.summary && typeof value.summary === "object" && !Array.isArray(value.summary)
            ? value.summary as Partial<ProfileProjectSummary> : undefined,
        };
      });
      return response(await runtimeState.privateStorage.syncLibrary(authContext, {
        activeProjectId: typeof input.activeProjectId === "string" ? input.activeProjectId : null,
        projects,
      }));
    }
    if (input.action === "sync-library-index") {
      if (!Array.isArray(input.summaries)) return response({ message: "Invalid Library index inventory." }, 400);
      const summaries = input.summaries.map((value) => (
        value && typeof value === "object" && !Array.isArray(value)
          ? value as Partial<ProfileProjectSummary>
          : {}
      ));
      return response(await runtimeState.privateStorage.syncLibraryIndex(authContext, {
        activeProjectId: typeof input.activeProjectId === "string" ? input.activeProjectId : null,
        summaries,
      }));
    }
    if (input.action === "delete-archived-project") {
      return response(await runtimeState.privateStorage.deleteArchivedProject(authContext, String(input.projectId || "")));
    }
    if (input.action === "save-wyrmwood") {
      await runtimeState.privateStorage.writePrivateJson(authContext, { domain: "cache", objectId: "wyrmwood-state", value: input.value });
      return response({ ok: true });
    }
    if (input.action === "save-story-map-contexts") {
      const value = normalizeStoryMapContextRegistry(input.value);
      await runtimeState.privateStorage.writePrivateJson(authContext, { domain: "cache", objectId: "story-map-contexts", value });
      return response({ ok: true });
    }
    if (input.action === "save-recovery-points") {
      const value = normalizeRecoveryPoints(input.value);
      await runtimeState.privateStorage.writePrivateJson(authContext, { domain: "cache", objectId: "library-recovery-points", value });
      return response({ ok: true, count: value.length });
    }
    return response({ code: "UNSUPPORTED_PRIVATE_ACTION", message: "That private profile action is unavailable." }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}
