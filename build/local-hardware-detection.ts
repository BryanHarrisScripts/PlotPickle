import { spawn } from "node:child_process";
import os from "node:os";
import process from "node:process";
import { selectLocalHardwareProfile, type LocalHardwareProfile } from "../lib/ai/local-runtime";

export type LocalGpuGeneration = "pascal" | "turing" | "ampere" | "ada" | "blackwell" | "other" | "none";

export type LocalHardwareSnapshot = {
  checkedAt: string;
  platform: NodeJS.Platform;
  arch: string;
  cpuModel: string;
  cpuThreads: number;
  ramGb: number;
  gpuName: string;
  vramMb: number;
  vramGb: number;
  computeCapability: string;
  gpuGeneration: LocalGpuGeneration;
  nvidia: boolean;
  profile: LocalHardwareProfile;
  compatibility: {
    pytorchCuda: "12.6" | "current" | "cpu";
    prohibitCuda13PyTorch: boolean;
    preferLlamaCppCuda12: boolean;
    allowVulkanFallback: boolean;
    cpuGpuSplit: boolean;
  };
};

type CommandResult = { code: number; stdout: string };

function run(command: string, args: string[], timeoutMs = 3_000): Promise<CommandResult> {
  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout: Buffer.concat(chunks).toString("utf8").trim() });
    };
    child.once("error", () => finish(1));
    child.once("exit", (code) => finish(code ?? 1));
    const timer = setTimeout(() => {
      child.kill();
      finish(1);
    }, timeoutMs);
  });
}

function generationFromName(name: string, computeCapability: string): LocalGpuGeneration {
  const computeMajor = Number(computeCapability.split(".", 1)[0]);
  if (computeMajor === 6) return "pascal";
  if (computeMajor === 7) return "turing";
  if (computeMajor === 8) return /rtx\s*40/i.test(name) ? "ada" : "ampere";
  if (computeMajor === 9) return "ada";
  if (computeMajor >= 10) return "blackwell";
  if (/\bgtx\s*10\d{2}\b|titan\s*xp|titan\s*x\s*\(pascal\)/i.test(name)) return "pascal";
  if (/\b(?:rtx\s*20|gtx\s*16)/i.test(name)) return "turing";
  if (/\brtx\s*30/i.test(name)) return "ampere";
  if (/\brtx\s*40/i.test(name)) return "ada";
  if (/\brtx\s*50/i.test(name)) return "blackwell";
  return name ? "other" : "none";
}

function parseNvidiaLine(value: string) {
  const parts = value.split(",").map((part) => part.trim());
  const name = parts[0] ?? "";
  const vramMb = Number(parts[1] ?? 0);
  const computeCapability = parts[2] ?? "";
  return {
    name,
    vramMb: Number.isFinite(vramMb) ? Math.max(0, Math.round(vramMb)) : 0,
    computeCapability,
  };
}

async function nvidiaSnapshot() {
  const envName = process.env.PLOTPICKLE_GPU_NAME?.trim() || "";
  const envVram = Number(process.env.PLOTPICKLE_GPU_VRAM_MB || 0);
  const envCompute = process.env.PLOTPICKLE_GPU_COMPUTE_CAPABILITY?.trim() || "";
  if (envName) {
    return {
      name: envName,
      vramMb: Number.isFinite(envVram) ? Math.max(0, Math.round(envVram)) : 0,
      computeCapability: envCompute,
    };
  }

  const withCompute = await run("nvidia-smi", [
    "--query-gpu=name,memory.total,compute_cap",
    "--format=csv,noheader,nounits",
  ]);
  if (withCompute.code === 0 && withCompute.stdout) {
    return parseNvidiaLine(withCompute.stdout.split(/\r?\n/, 1)[0] ?? "");
  }

  const basic = await run("nvidia-smi", [
    "--query-gpu=name,memory.total",
    "--format=csv,noheader,nounits",
  ]);
  if (basic.code === 0 && basic.stdout) {
    return parseNvidiaLine(basic.stdout.split(/\r?\n/, 1)[0] ?? "");
  }
  return { name: "", vramMb: 0, computeCapability: "" };
}

export async function detectLocalHardware(): Promise<LocalHardwareSnapshot> {
  const gpu = await nvidiaSnapshot();
  const gpuGeneration = generationFromName(gpu.name, gpu.computeCapability);
  const ramGb = Number((os.totalmem() / 1024 ** 3).toFixed(1));
  const vramGb = Number((gpu.vramMb / 1024).toFixed(1));
  const profile = selectLocalHardwareProfile({
    ramGb,
    gpuName: gpu.name,
    vramGb,
    gpuGeneration,
  });
  const pascal = gpuGeneration === "pascal";
  const cpus = os.cpus();
  return {
    checkedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    cpuModel: cpus[0]?.model || "Unknown CPU",
    cpuThreads: cpus.length,
    ramGb,
    gpuName: gpu.name,
    vramMb: gpu.vramMb,
    vramGb,
    computeCapability: gpu.computeCapability,
    gpuGeneration,
    nvidia: Boolean(gpu.name),
    profile,
    compatibility: {
      pytorchCuda: pascal ? "12.6" : gpu.name ? "current" : "cpu",
      prohibitCuda13PyTorch: pascal,
      preferLlamaCppCuda12: pascal,
      allowVulkanFallback: profile.allowVulkanFallback,
      cpuGpuSplit: profile.cpuGpuSplit,
    },
  };
}
