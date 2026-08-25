import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createStoreZip } from "../../../lib/projects/canon/ppf-exchange";
import {
  STORY_PICKLE_PORTABLE_CONFIG,
  resolveStoryPickleArtifactState,
} from "../../../lib/buzz/story-pickle-agents";

export const runtime = "nodejs";

type StoryPickleId = keyof typeof STORY_PICKLE_PORTABLE_CONFIG.contracts;
type ArtifactBuffers = Partial<Record<StoryPickleId, Buffer>>;

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readMintedArtifacts() {
  const artifacts: ArtifactBuffers = {};
  for (const profileId of STORY_PICKLE_PORTABLE_CONFIG.profileIds as StoryPickleId[]) {
    const artifactPath = STORY_PICKLE_PORTABLE_CONFIG.contracts[profileId].distribution.artifactPath;
    try {
      artifacts[profileId] = await readFile(path.resolve(process.cwd(), artifactPath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return artifacts;
}

function publicStatus(artifacts: ArtifactBuffers) {
  const state = resolveStoryPickleArtifactState(STORY_PICKLE_PORTABLE_CONFIG, artifacts, sha256);
  return {
    individuals: state.individuals.map((artifact: { profileId: string; fileName: string; sha256: string | null; available: boolean; status: string }) => ({
      ...artifact,
      downloadUrl: artifact.available ? `/api/story-pickle-downloads?artifact=${encodeURIComponent(artifact.profileId)}` : null,
    })),
    bundle: {
      ...state.bundle,
      downloadUrl: state.bundle.available ? "/api/story-pickle-downloads?artifact=all-three" : null,
    },
  };
}

function unavailable() {
  return Response.json(
    { error: "This genuine BUZZ Agent card is awaiting its official verified mint." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  const artifacts = await readMintedArtifacts();
  const status = publicStatus(artifacts);
  const requested = new URL(request.url).searchParams.get("artifact")?.trim() || "";
  if (!requested) return Response.json(status, { headers: { "Cache-Control": "no-store" } });

  if (requested === "all-three") {
    if (!status.bundle.available) return unavailable();
    const verified = status.individuals.map((artifact) => ({
      profileId: artifact.profileId,
      fileName: artifact.fileName,
      sha256: artifact.sha256,
    }));
    const entries: Record<string, Buffer> = {
      "README.txt": Buffer.from(
        "Import any included .agent.png card into your own BUZZ community. Each import creates a fresh community-local Agent identity. No PlotPickle project authority, private memory, conversation history, signer or credential is transferred. The receiving community owner controls the imported Agent.\n",
        "utf8",
      ),
      "manifest.json": Buffer.from(JSON.stringify({ schemaVersion: 1, artifacts: verified }, null, 2) + "\n", "utf8"),
    };
    for (const artifact of verified) entries[artifact.fileName] = artifacts[artifact.profileId as StoryPickleId] as Buffer;
    const bundle = createStoreZip(entries);
    return new Response(new Uint8Array(bundle), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${status.bundle.fileName}"`,
        "Content-Type": "application/zip",
      },
    });
  }

  const artifact = status.individuals.find((candidate) => candidate.profileId === requested);
  if (!artifact?.available) return unavailable();
  return new Response(new Uint8Array(artifacts[requested as StoryPickleId] as Buffer), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
      "Content-Type": "image/png",
    },
  });
}
