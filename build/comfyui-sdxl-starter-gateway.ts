import { execFile, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { IncomingMessage } from "node:http";
import type { ViteDevServer } from "vite";

const execFileAsync = promisify(execFile);
const STARTER_PATH = "/api/media-routing/comfyui/sdxl-starter";
const SCRIPT_NAME = "install-comfyui-sdxl-starter.ps1";
const REVIEWED = {
  fileName: "sd_xl_base_1.0.safetensors",
  sizeBytes: 6_938_078_334,
  sizeLabel: "6.94 GB",
  sha256: "31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b",
  license: "OpenRAIL++",
  sourceLabel: "Stability AI · stable-diffusion-xl-base-1.0 via Hugging Face",
} as const;

type StarterTaskState = {
  state: "idle" | "installing" | "installed" | "failed";
  message: string;
  destination: string;
  startedAt: string;
  finishedAt: string;
};

let task: StarterTaskState = {
  state: "idle",
  message: "",
  destination: "",
  startedAt: "",
  finishedAt: "",
};

async function readApprovalFlag(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += value.length;
    if (received > 4 * 1024) throw new Error("The SDXL starter approval request is too large.");
    chunks.push(value);
  }
  const source = Buffer.concat(chunks).toString("utf8") || "{}";
  const parsed: unknown = JSON.parse(source);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Enter a valid SDXL starter approval request.");
  return (parsed as Record<string, unknown>).approved === true;
}

function marker(output: string, name: string) {
  const match = output.match(new RegExp(`^${name}=([^\\r\\n]+)$`, "m"));
  return match?.[1]?.trim() || "";
}

function publicStatus(state: string, detail: string, destination: string) {
  return {
    ok: !["failed", "unsupported", "conflict"].includes(state),
    state,
    message: detail,
    destination,
    ...REVIEWED,
    task,
  };
}

function scriptPath() {
  return path.resolve(process.cwd(), "scripts", SCRIPT_NAME);
}

async function inspectStarter() {
  if (process.platform !== "win32") {
    return publicStatus("unsupported", "Automatic reviewed SDXL starter installation is currently available for local Windows ComfyUI Desktop.", "");
  }
  try {
    const result = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", scriptPath(),
      "-Mode", "Status",
    ], {
      cwd: process.cwd(),
      windowsHide: true,
      timeout: 20_000,
      maxBuffer: 256 * 1024,
    });
    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    const state = marker(output, "PLOTPICKLE_SDXL_STATUS") || "unknown";
    const detail = marker(output, "PLOTPICKLE_SDXL_DETAIL") || "SDXL starter status was checked.";
    const destination = marker(output, "PLOTPICKLE_SDXL_DESTINATION");
    return publicStatus(task.state === "installing" ? "installing" : state, task.state === "installing" ? task.message : detail, destination || task.destination);
  } catch (error) {
    const value = error as Error & { stdout?: string | Buffer; stderr?: string | Buffer };
    const output = `${value.stdout || ""}\n${value.stderr || ""}`;
    const state = marker(output, "PLOTPICKLE_SDXL_STATUS") || "failed";
    const detail = marker(output, "PLOTPICKLE_SDXL_DETAIL") || value.message || "The reviewed SDXL starter status could not be checked.";
    const destination = marker(output, "PLOTPICKLE_SDXL_DESTINATION");
    return publicStatus(task.state === "installing" ? "installing" : state, task.state === "installing" ? task.message : detail, destination || task.destination);
  }
}

function startInstall(destination: string) {
  task = {
    state: "installing",
    message: `Downloading and verifying ${REVIEWED.fileName}. Keep PlotPickle and ComfyUI open; this is a ${REVIEWED.sizeLabel} local download.`,
    destination,
    startedAt: new Date().toISOString(),
    finishedAt: "",
  };

  const child = spawn("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", scriptPath(),
    "-Mode", "Install",
    "-Approved",
  ], {
    cwd: process.cwd(),
    windowsHide: true,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const append = (chunk: Buffer | string) => {
    output = `${output}${String(chunk)}`.slice(-256 * 1024);
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.once("error", (error) => {
    task = { ...task, state: "failed", message: error.message, finishedAt: new Date().toISOString() };
  });
  child.once("close", (code) => {
    const state = marker(output, "PLOTPICKLE_SDXL_STATUS");
    const detail = marker(output, "PLOTPICKLE_SDXL_DETAIL");
    const installedDestination = marker(output, "PLOTPICKLE_SDXL_DESTINATION");
    const success = code === 0 && ["installed", "ready", "existing-compatible"].includes(state);
    task = {
      ...task,
      state: success ? "installed" : "failed",
      message: detail || (success ? "The reviewed SDXL starter is ready." : `The SDXL starter installer exited with code ${code ?? "unknown"}.`),
      destination: installedDestination || task.destination,
      finishedAt: new Date().toISOString(),
    };
  });
}

export function registerComfyUiSdxlStarterGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== STARTER_PATH) {
      next();
      return;
    }

    const remoteAddress = request.socket.remoteAddress;
    const host = request.headers.host || "";
    let localRequest = remoteAddress === "127.0.0.1" || remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1";
    if (localRequest && host) {
      try {
        const hostUrl = new URL(`http://${host}`);
        const origin = request.headers.origin;
        localRequest = ["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)
          && (!origin || new URL(origin).host === hostUrl.host);
      } catch {
        localRequest = false;
      }
    } else {
      localRequest = false;
    }

    const reply = (statusCode: number, payload: Record<string, unknown>) => {
      response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(JSON.stringify(payload));
    };

    if (!localRequest) {
      reply(403, { ok: false, message: "The reviewed SDXL starter installer is available only from this local PlotPickle server." });
      return;
    }

    void (async () => {
      if (request.method === "GET") {
        reply(200, await inspectStarter());
        return;
      }
      if (request.method !== "POST") {
        reply(405, { ok: false, message: "Use the local Settings action to install the reviewed SDXL starter." });
        return;
      }
      if (process.platform !== "win32") {
        reply(409, { ok: false, message: "Automatic reviewed SDXL starter installation is currently available for local Windows ComfyUI Desktop." });
        return;
      }
      if (!(await readApprovalFlag(request))) {
        reply(400, { ok: false, message: `Explicit approval is required before downloading the ${REVIEWED.sizeLabel} reviewed SDXL 1.0 checkpoint.` });
        return;
      }
      if (task.state === "installing") {
        reply(409, { ok: false, message: "The reviewed SDXL starter is already being downloaded and verified." });
        return;
      }
      const status = await inspectStarter();
      if (["ready", "existing-compatible"].includes(String(status.state))) {
        reply(200, status);
        return;
      }
      if (status.state !== "missing") {
        reply(409, status);
        return;
      }
      startInstall(String(status.destination || ""));
      reply(202, publicStatus("installing", task.message, task.destination));
    })().catch((error) => {
      reply(500, { ok: false, message: error instanceof Error ? error.message : "The reviewed SDXL starter operation failed." });
    });
  });
}
