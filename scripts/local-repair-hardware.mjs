import { execFile } from "node:child_process";
import os from "node:os";
import process from "node:process";
import { promisify } from "node:util";

const exec = promisify(execFile);

async function nvidiaVramGb() {
  const envMb = Number(process.env.PLOTPICKLE_GPU_VRAM_MB || 0);
  if (Number.isFinite(envMb) && envMb > 0) return envMb / 1024;
  try {
    const result = await exec("nvidia-smi", [
      "--query-gpu=memory.total",
      "--format=csv,noheader,nounits",
    ], { windowsHide: true, timeout: 3_000 });
    const mb = Number(String(result.stdout || "").split(/\r?\n/, 1)[0]?.trim() || 0);
    return Number.isFinite(mb) && mb > 0 ? mb / 1024 : 0;
  } catch {
    return 0;
  }
}

export async function detectRepairHardware() {
  const ramGb = Number((os.totalmem() / 1024 ** 3).toFixed(1));
  const vramGb = Number((await nvidiaVramGb()).toFixed(1));
  return {
    ramGb,
    vramGb,
    cpuGpuSplit: vramGb > 0 && ramGb >= 16,
  };
}
