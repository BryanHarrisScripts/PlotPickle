import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { parseLibraryBackup } from "../../../../core/storage/library-project";
import { projectCanonicalProjectForOutline } from "../../../../modules/plan/projections/canonical-project-outline";
import { observeStoryboardShot } from "../../../../modules/intent/model/observe-project-status";

function integer(value: string | undefined, minimum: number, maximum: number) {
  if (!value || !/^(0|[1-9][0-9]{0,8})$/.test(value)) throw Error("INVALID_ARGUMENT");
  const number = Number(value);
  if (number < minimum || number > maximum) throw Error("INVALID_ARGUMENT");
  return number;
}

async function main() {
  const { values: args } = parseArgs({ options: Object.fromEntries(
    ["file", "operation", "project-id", "revision", "sha256", "offset", "limit", "block", "mini"]
      .map(name => [name, { type: "string" as const }])) });
  if (!args.file || !["identity", "summary", "source", "shots"].includes(args.operation ?? "")) throw Error("INVALID_ARGUMENT");
  const bytes = await readFile(args.file);
  if (bytes.byteLength > 20 * 1024 * 1024) throw Error("PROJECT_FILE_TOO_LARGE");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const value = JSON.parse(bytes.toString("utf8"));
  // Accept the existing Library backup or explicit profile export wrapper.
  const raw = value?.format === "plotpickle-explicit-project-export" && value.version === 1 ? value.project : value;
  if (!raw || typeof raw !== "object" || !Number.isSafeInteger(raw.revision) || raw.revision < 0) throw Error("SAVED_IDENTITY_UNVERIFIABLE");
  const rawBlocks = raw.structure?.blocks;
  if (!Array.isArray(rawBlocks) || rawBlocks.length !== 24 ||
    rawBlocks.some((b, index) => b.number !== index + 1 || b.actNumber !== Math.floor(index / 6) + 1 ||
      b.sequenceNumber !== Math.floor(index / 2) + 1 || !Array.isArray(b.miniBlocks) || b.miniBlocks.length !== 4 ||
      b.miniBlocks.some((m, ordinal) => m.ordinal !== ordinal + 1 || m.blockNumber !== b.number))) throw Error("RAW_STRUCTURE_UNVERIFIABLE");
  const project = parseLibraryBackup(JSON.stringify(raw));
  const identity = { id: project.id, title: project.title, revision: project.revision, sha256 };
  const envelope = { version: 1, scope: "EXPORTED_FILE_OBSERVATION", project: identity,
    canonMutated: false, modelCalled: false, independentVerification: false,
    liveVaultReadVerified: false, mediaBytesVerified: false };
  if (args.operation === "identity") return { ...envelope, operation: "identity" };
  if (args["project-id"] !== project.id || integer(args.revision, 0, 999999999) !== project.revision || args.sha256 !== sha256) throw Error("FILE_IDENTITY_OR_REVISION_CHANGED");

  if (args.operation === "summary") {
    const structure = projectCanonicalProjectForOutline(project);
    return { ...envelope, operation: "summary", plannedStructure: {
      acts: 4, sequences: 12, blocks: structure.blocks.length,
      miniBlocks: structure.blocks.reduce((n,b) => n + b.miniBlocks.length, 0),
      shotsPerMiniBlock: 25, totalPlannedShots: 2400,
    }, retainedPassageCount: project.sourceEvidence.screenplay?.passages.length ?? 0,
      retainedSourceTruncated: project.sourceEvidence.screenplay?.passagesTruncated ?? null,
      blocks: structure.blocks };
  }
  if (args.operation === "source") {
    const source = project.sourceEvidence.screenplay;
    if (!source) throw Error("SOURCE_EVIDENCE_MISSING");
    const offset = integer(args.offset ?? "0", 0, 999999999);
    const limit = integer(args.limit ?? "25", 1, 50);
    const passages = source.passages.slice(offset, offset + limit);
    return { ...envelope, operation: "source", sourceFileName: source.sourceFileName,
      retainedPassageCount: source.passages.length, retainedSourceTruncated: source.passagesTruncated,
      passages, nextOffset: offset + passages.length < source.passages.length ? offset + passages.length : null };
  }
  const block = integer(args.block, 1, 24), mini = integer(args.mini, 1, 4);
  const shots = Array.from({ length: 25 }, (_, index) => {
    const result = observeStoryboardShot({ capability: "storyboard-shot.observe", providerPolicy: "LOCAL_READ_ONLY",
      profileId: "profile_file_snapshot", projectId: project.id, projectRevision: project.revision,
      actNumber: Math.floor((block - 1) / 6) + 1, sequenceNumber: Math.floor((block - 1) / 2) + 1,
      blockNumber: block, miniBlockNumber: mini, shotNumber: index + 1 },
      { activeProfileId: "profile_file_snapshot", activeProject: project });
    return { ...result, code: result.state === "OBSERVED"
      ? "FILE_SNAPSHOT_METADATA_NOT_LIVE_VAULT_VERIFICATION" : result.code };
  });
  return { ...envelope, operation: "shots", shots };
}

try {
  console.log(JSON.stringify(await main()));
} catch (error) {
  const known = new Set(["INVALID_ARGUMENT", "PROJECT_FILE_TOO_LARGE", "SAVED_IDENTITY_UNVERIFIABLE",
    "RAW_STRUCTURE_UNVERIFIABLE", "FILE_IDENTITY_OR_REVISION_CHANGED", "SOURCE_EVIDENCE_MISSING"]);
  console.log(JSON.stringify({ state: "BLOCKED", code: error instanceof Error && known.has(error.message)
    ? error.message : "PROJECT_FILE_UNREADABLE", canonMutated: false }));
  process.exitCode = 1;
}
