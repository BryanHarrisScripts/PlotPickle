#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SUPPORTED_EXTENSIONS = new Set([".fdx", ".fountain", ".spmd", ".txt", ".pdf"]);

function usage() {
  return [
    "Convert a screenplay file into a rich PlotPickle .ppf.",
    "",
    "Usage:",
    "  node scripts/projects/convert-screenplay-to-ppf.mjs <screenplay> [--output <file-or-directory>]",
    "",
    "Supported:",
    "  .fdx, .fountain, .spmd, .txt, and text-based .pdf",
    "",
    "PDF note:",
    "  PlotPickle uses a local pdftotext or mutool executable when available.",
    "  Scanned/image-only PDFs are not OCR'd automatically.",
  ].join("\n");
}

function parseArgs(argv) {
  const input = argv[0];
  if (!input || input === "--help" || input === "-h") return { help: true, input: "", output: "" };
  let output = "";
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag !== "--output" && flag !== "-o") throw new Error(`Unknown argument: ${flag}\n\n${usage()}`);
    output = argv[index + 1] || "";
    if (!output) throw new Error(`${flag} requires a file or directory path.`);
    index += 1;
  }
  return { help: false, input, output };
}

function readablePdfText(inputPath) {
  const commands = [
    { command: "pdftotext", args: ["-layout", "-enc", "UTF-8", inputPath, "-"] },
    { command: "mutool", args: ["draw", "-F", "txt", "-o", "-", inputPath] },
  ];
  const failures = [];
  for (const candidate of commands) {
    const result = spawnSync(candidate.command, candidate.args, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
    if (result.error?.code === "ENOENT") continue;
    if (result.status === 0 && result.stdout?.trim()) return result.stdout;
    failures.push(`${candidate.command}: ${String(result.stderr || result.error?.message || `exit ${result.status}`).trim()}`);
  }
  const detail = failures.length ? `\n${failures.join("\n")}` : "";
  throw new Error(
    "PlotPickle could not extract text from this PDF. Install a local pdftotext/Poppler or mutool/MuPDF command, or export the screenplay as Final Draft/Fountain/text. Scanned PDFs require an explicit OCR step outside this utility."
    + detail,
  );
}

async function sourceTextFor(inputPath) {
  const extension = path.extname(inputPath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported screenplay type ${extension || "<none>"}. Use .fdx, .fountain, .spmd, .txt, or .pdf.`);
  }
  if (extension === ".pdf") return readablePdfText(inputPath);
  return readFile(inputPath, "utf8");
}

function outputPathFor(requested, inputPath, generatedFileName) {
  if (!requested) return path.join(path.dirname(inputPath), generatedFileName);
  const resolved = path.resolve(requested);
  if (path.extname(resolved).toLowerCase() === ".ppf") return resolved;
  return path.join(resolved, generatedFileName);
}

async function loadConverter() {
  const server = await createServer({
    root: repoRoot,
    configFile: false,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true },
  });
  try {
    const module = await server.ssrLoadModule("/lib/projects/screenplay/screenplay-to-ppf.ts");
    if (typeof module.convertScreenplayTextToPpf !== "function") {
      throw new Error("PlotPickle's screenplay-to-PPF converter could not be loaded.");
    }
    return {
      convert: module.convertScreenplayTextToPpf,
      close: () => server.close(),
    };
  } catch (error) {
    await server.close();
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const inputPath = path.resolve(args.input);
  const sourceText = await sourceTextFor(inputPath);
  const converter = await loadConverter();
  let result;
  try {
    result = converter.convert({
      fileName: path.basename(inputPath),
      sourceText,
      importedAt: new Date().toISOString(),
    });
  } finally {
    await converter.close();
  }

  const outputPath = outputPathFor(args.output, inputPath, result.fileName);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.serializedPpf, "utf8");

  process.stdout.write([
    "PlotPickle screenplay conversion complete.",
    `Source: ${inputPath}`,
    `PPF: ${outputPath}`,
    `Story: ${result.projectTitle}`,
    `Evidence: ${result.sourceSceneCount} scenes · ${result.sourcePassageCount} screenplay passages`,
    result.pdfWarnings.length ? `PDF review: ${result.pdfWarnings.join(" ")}` : "",
  ].filter(Boolean).join("\n") + "\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
