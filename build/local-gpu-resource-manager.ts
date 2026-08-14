import { spawn } from "node:child_process";
import type { ViteDevServer } from "vite";
import type { LocalTextRole } from "../lib/ai/local-runtime";
import {
  localRuntimeSnapshot,
  startManagedLlama,
  stopManagedLlama,
} from "./local-runtime-manager";

export type LocalGpuTask = "idle" | "text" | "image" | "video";

export type LocalGpuSchedulerState = {
  activeTask: LocalGpuTask;
  textRole: LocalTextRole | "";
  transitionId: number;
  updatedAt: string;
  lastAction: string;
  lastWarning: string;
};

let state: LocalGpuSchedulerState = {
  activeTask: "idle",
  textRole: "",
  transitionId: 0,
  updatedAt: new Date().toISOString(),
  lastAction: "Scheduler initialized.",
  lastWarning: "",
};
let transitionQueue: Promise<void> = Promise.resolve();

function update(patch: Partial<LocalGpuSchedulerState>) {
  state = {
    ...state,
    ...patch,
    transitionId: state.transitionId + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function localGpuSchedulerState(): LocalGpuSchedulerState {
  return { ...state };
}

function command(commandName: string, args: string[], timeoutMs = 5_000) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const child = spawn(commandName, args, { windowsHide: true, stdio: "ignore" });
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    child.once("error", () => finish(false));
    child.once("exit", (code) => finish(code === 0));
    const timer = setTimeout(() => {
      child.kill();
      finish(false);
    }, timeoutMs);
  });
}

async function freeComfyMemory() {
  try {
    const response = await fetch("http://127.0.0.1:8188/free", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
      signal: AbortSignal.timeout(2_500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function ollamaRoot(baseUrl: string) {
  return baseUrl.replace(/\/v1\/?$/, "");
}

async function releaseExternalTextRuntime() {
  const snapshot = await localRuntimeSnapshot();
  const runtime = snapshot.activeRuntime;
  if (!runtime.reachable) return { released: true, warning: "" };
  if (runtime.kind === "llama.cpp") {
    const managed = await stopManagedLlama();
    return managed
      ? { released: true, warning: "" }
      : { released: false, warning: "An externally started llama.cpp server is still resident. Enable PlotPickle-managed llama.cpp for guaranteed 8 GB VRAM transitions." };
  }
  if (runtime.kind === "ollama") {
    const role = state.textRole || "fast";
    const model = snapshot.roles[role].selected;
    if (!model) return { released: true, warning: "" };
    try {
      const response = await fetch(`${ollamaRoot(runtime.baseUrl)}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: "", stream: false, keep_alive: 0 }),
        signal: AbortSignal.timeout(8_000),
      });
      return response.ok
        ? { released: true, warning: "" }
        : { released: false, warning: "Ollama did not confirm model release before the media task." };
    } catch {
      return { released: false, warning: "Ollama could not be reached to release the active text model." };
    }
  }
  if (runtime.kind === "lm-studio") {
    const released = await command(process.platform === "win32" ? "lms.exe" : "lms", ["unload", "--all"]);
    return released
      ? { released: true, warning: "" }
      : { released: false, warning: "LM Studio is externally managed and did not accept the local CLI unload hook. Free its model before an 8 GB media render, or use PlotPickle-managed llama.cpp." };
  }
  return {
    released: false,
    warning: "The selected external OpenAI-compatible runtime does not advertise a standard model-unload operation. Configure a managed llama.cpp runtime for automatic 8 GB VRAM switching.",
  };
}

async function doTransition(task: LocalGpuTask, role: LocalTextRole = "fast") {
  if (task === "text") {
    await freeComfyMemory();
    const snapshot = await localRuntimeSnapshot();
    if (snapshot.activeRuntime.kind === "llama.cpp" && snapshot.settings.managedLlama.enabled) {
      await startManagedLlama(role);
    }
    update({
      activeTask: "text",
      textRole: role,
      lastAction: `Prepared ${role} text model; released ComfyUI media memory first.`,
      lastWarning: "",
    });
    return;
  }
  if (task === "image" || task === "video") {
    const release = await releaseExternalTextRuntime();
    await freeComfyMemory();
    update({
      activeTask: task,
      textRole: "",
      lastAction: `Released text resources before the ${task} workflow.`,
      lastWarning: release.warning,
    });
    return;
  }
  await stopManagedLlama();
  await freeComfyMemory();
  update({ activeTask: "idle", textRole: "", lastAction: "Released local GPU resources.", lastWarning: "" });
}

export async function prepareLocalGpuTask(task: Exclude<LocalGpuTask, "idle">, role: LocalTextRole = "fast") {
  transitionQueue = transitionQueue.then(() => doTransition(task, role));
  await transitionQueue;
  return localGpuSchedulerState();
}

export async function finishLocalMediaTask() {
  transitionQueue = transitionQueue.then(async () => {
    await freeComfyMemory();
    await doTransition("text", "fast");
  });
  await transitionQueue;
  return localGpuSchedulerState();
}

const TEXT_PATHS = new Set(["/api/local-ai/generate/text", "/api/writing-assistant/chat"]);
const IMAGE_PATHS = new Set(["/api/local-ai/generate/image", "/api/media-routing/test/image"]);
const VIDEO_PATHS = new Set(["/api/local-ai/generate/video", "/api/media-routing/test/video"]);

function requestedRole(request: import("node:http").IncomingMessage): LocalTextRole {
  const header = request.headers["x-plotpickle-model-role"];
  return header === "quality" || header === "deep" ? header : "fast";
}

export function registerGpuResourceScheduler(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    const task = TEXT_PATHS.has(pathname) ? "text" : IMAGE_PATHS.has(pathname) ? "image" : VIDEO_PATHS.has(pathname) ? "video" : null;
    if (!task || request.method !== "POST") {
      next();
      return;
    }
    const role = task === "text" ? requestedRole(request) : "fast";
    void prepareLocalGpuTask(task, role)
      .then(() => {
        if (task === "image" || task === "video") {
          let finished = false;
          const release = () => {
            if (finished) return;
            finished = true;
            void finishLocalMediaTask();
          };
          response.once("finish", release);
          response.once("close", release);
          response.once("error", release);
        }
        response.setHeader("X-PlotPickle-GPU-Task", task);
        next();
      })
      .catch((error) => {
        response.statusCode = 503;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify({
          ok: false,
          message: error instanceof Error ? error.message : "The local GPU scheduler could not prepare this task.",
        }));
      });
  });
}
