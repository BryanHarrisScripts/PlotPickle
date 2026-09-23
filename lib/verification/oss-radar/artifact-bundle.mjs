import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

export async function writeRadarArtifactBundle({
  resultPath,
  outputDir,
} = {}) {
  if (!resultPath) throw new Error("OSS Radar artifact bundle requires a result JSON path.");
  if (!outputDir) throw new Error("OSS Radar artifact bundle requires an output directory.");

  const result = JSON.parse(await readFile(resultPath, "utf8"));
  await mkdir(outputDir, { recursive: true });

  const files = {
    "result.json": result,
    "discovery.json": result.discovery || {},
    "state.json": result.machineState || {},
    "oss-rules-intelligence.json": result.ossRulesIntelligence || { schemaVersion: 1, status: "unavailable", findings: [], checks: [] },
  };
  for (const [name, value] of Object.entries(files)) {
    await writeFile(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
  await writeFile(path.join(outputDir, "report.md"), String(result.reportBody || ""), "utf8");
  await writeFile(path.join(outputDir, "public-digest.txt"), String(result.publicDigest || ""), "utf8");
  await writeFile(path.join(outputDir, "public-blog-draft.md"), String(result.publicBlogDraft || ""), "utf8");

  return {
    outputDir,
    files: [...Object.keys(files), "report.md", "public-digest.txt", "public-blog-draft.md"],
  };
}

const directUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (directUrl && import.meta.url === directUrl) {
  const [, , resultPath, outputDir] = process.argv;
  writeRadarArtifactBundle({ resultPath, outputDir })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
