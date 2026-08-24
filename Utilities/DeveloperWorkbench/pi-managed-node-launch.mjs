import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  configurePiLocalRuntime,
  piLocalEnvironment,
  runPortableCommand,
} from "../../scripts/pi-worker-runtime.mjs";

const PI_PACKAGE_PATH = ["node_modules", "@earendil-works", "pi-coding-agent"];
const QUIET_RESOURCE_FLAGS = [
  "--no-extensions",
  "--no-skills",
  "--no-prompt-templates",
  "--no-themes",
];

function packageRootForManagedPi(pi) {
  if (!pi?.root) throw new Error("PlotPickle-managed Pi did not report its private installation root.");
  return path.join(path.resolve(pi.root), ...PI_PACKAGE_PATH);
}

export async function resolveManagedPiCliEntry(pi) {
  const packageRoot = packageRootForManagedPi(pi);
  const packageJsonPath = path.join(packageRoot, "package.json");
  const manifest = JSON.parse(await readFile(packageJsonPath, "utf8"));

  const binEntry = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.pi;
  if (!binEntry || typeof binEntry !== "string") {
    throw new Error(`PlotPickle-managed Pi package metadata does not declare the expected pi CLI entry at ${packageJsonPath}.`);
  }

  const cliEntry = path.resolve(packageRoot, binEntry);
  const relative = path.relative(packageRoot, cliEntry);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`PlotPickle-managed Pi declared an unsafe CLI entry outside its private package root: ${binEntry}`);
  }
  try {
    await access(cliEntry);
  } catch (error) {
    throw new Error(`PlotPickle-managed Pi CLI entry is missing or unreadable at ${cliEntry}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return cliEntry;
}

function childFailureDetail(error) {
  const stderr = String(error?.stderr || "").trim();
  const stdout = String(error?.stdout || "").trim();
  const detail = stderr || stdout;
  return detail.length <= 8_000 ? detail : `${detail.slice(-8_000)}\n[Pi child output truncated to the final 8000 characters.]`;
}

export async function runManagedPiReadOnly({ pi, runtime, prompt, cwd, purpose = "work-item-review", timeout = 15 * 60_000 }) {
  const cliEntry = await resolveManagedPiCliEntry(pi);
  const configured = await configurePiLocalRuntime(runtime, { purpose });
  const args = [
    cliEntry,
    "-p",
    "--no-session",
    "--tools", "read,grep,find,ls",
    ...QUIET_RESOURCE_FLAGS,
    "--provider", "plotpickle-local",
    "--model", runtime.model,
    prompt,
  ];

  try {
    return await runPortableCommand(process.execPath, args, {
      cwd,
      timeout,
      env: piLocalEnvironment(configured.agentDir),
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const detail = childFailureDetail(error);
    throw new Error([
      "PlotPickle-managed Pi exited before completing the Developer Workbench review.",
      detail ? `Pi detail:\n${detail}` : "Pi produced no stderr/stdout detail.",
      `Direct launcher: ${process.execPath} ${cliEntry}`,
    ].join("\n"), { cause: error });
  }
}
