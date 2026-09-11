import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import voiceManifest from "../../config/local-voice-input.json";
import { persistentHome } from "../local-credentials";

type InstalledVoiceRuntime = {
  schemaVersion: 1;
  provider: "whisper.cpp";
  releaseTag: string;
  sourceCommit: string;
  sourceArchiveSha256: string;
  executableSha256: string;
  modelId: string;
  modelRevision: string;
  modelSha256: string;
  installedAt: string;
};

export type LocalVoiceRuntimeStatus = {
  ready: boolean;
  platform: string;
  provider: string;
  model: string;
  runtimeInstalled: boolean;
  modelInstalled: boolean;
  integrityVerified: boolean;
  releaseTag: string;
  sourceCommit: string;
  modelRevision: string;
  reason: string;
};

const MAX_STDOUT_BYTES = voiceManifest.execution.maxOutputBytes;
const MAX_STDERR_BYTES = voiceManifest.execution.maxOutputBytes;

function runtimeRoot() {
  return path.join(persistentHome(), "runtime", "voice", `whisper-${voiceManifest.runtime.releaseTag}`);
}

export function localVoicePaths() {
  const root = runtimeRoot();
  return Object.freeze({
    root,
    executable: path.join(root, "bin", voiceManifest.runtime.executable),
    model: path.join(root, "models", voiceManifest.model.fileName),
    installedManifest: path.join(root, "installed.json"),
    temporaryRoot: path.join(persistentHome(), "temp", "voice"),
  });
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function sha256(filePath: string) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

async function installedManifest(filePath: string) {
  try {
    const value = JSON.parse(await readFile(filePath, "utf8")) as Partial<InstalledVoiceRuntime>;
    return value;
  } catch {
    return null;
  }
}

export async function localVoiceRuntimeStatus(): Promise<LocalVoiceRuntimeStatus> {
  const paths = localVoicePaths();
  const runtimeInstalled = await exists(paths.executable);
  const modelInstalled = await exists(paths.model);
  if (process.platform !== "win32") {
    return {
      ready: false,
      platform: process.platform,
      provider: voiceManifest.provider,
      model: voiceManifest.model.id,
      runtimeInstalled,
      modelInstalled,
      integrityVerified: false,
      releaseTag: voiceManifest.runtime.releaseTag,
      sourceCommit: voiceManifest.runtime.sourceCommit,
      modelRevision: voiceManifest.model.revision,
      reason: "PlotPickle local dictation is currently packaged for Windows x64 CPU only.",
    };
  }
  if (!runtimeInstalled || !modelInstalled) {
    return {
      ready: false,
      platform: process.platform,
      provider: voiceManifest.provider,
      model: voiceManifest.model.id,
      runtimeInstalled,
      modelInstalled,
      integrityVerified: false,
      releaseTag: voiceManifest.runtime.releaseTag,
      sourceCommit: voiceManifest.runtime.sourceCommit,
      modelRevision: voiceManifest.model.revision,
      reason: !runtimeInstalled
        ? "The reviewed whisper.cpp runtime is not installed. Open Settings → Local → Local Dictation to install it."
        : "The reviewed base.en speech model is not installed. Open Settings → Local → Local Dictation to repair it.",
    };
  }

  const installed = await installedManifest(paths.installedManifest);
  if (!installed) {
    return {
      ready: false,
      platform: process.platform,
      provider: voiceManifest.provider,
      model: voiceManifest.model.id,
      runtimeInstalled,
      modelInstalled,
      integrityVerified: false,
      releaseTag: voiceManifest.runtime.releaseTag,
      sourceCommit: voiceManifest.runtime.sourceCommit,
      modelRevision: voiceManifest.model.revision,
      reason: "The local dictation install manifest is missing or unreadable. Repair Local Dictation before using the microphone.",
    };
  }

  const provenanceMatches = installed.provider === "whisper.cpp"
    && installed.releaseTag === voiceManifest.runtime.releaseTag
    && installed.sourceCommit === voiceManifest.runtime.sourceCommit
    && installed.sourceArchiveSha256 === voiceManifest.runtime.sha256
    && installed.modelId === voiceManifest.model.id
    && installed.modelRevision === voiceManifest.model.revision
    && installed.modelSha256 === voiceManifest.model.sha256;
  if (!provenanceMatches) {
    return {
      ready: false,
      platform: process.platform,
      provider: voiceManifest.provider,
      model: voiceManifest.model.id,
      runtimeInstalled,
      modelInstalled,
      integrityVerified: false,
      releaseTag: voiceManifest.runtime.releaseTag,
      sourceCommit: voiceManifest.runtime.sourceCommit,
      modelRevision: voiceManifest.model.revision,
      reason: "The local dictation provenance record does not match PlotPickle's reviewed runtime/model pins.",
    };
  }

  const [executableHash, modelHash] = await Promise.all([sha256(paths.executable), sha256(paths.model)]);
  const integrityVerified = executableHash === installed.executableSha256 && modelHash === voiceManifest.model.sha256;
  return {
    ready: integrityVerified,
    platform: process.platform,
    provider: voiceManifest.provider,
    model: voiceManifest.model.id,
    runtimeInstalled,
    modelInstalled,
    integrityVerified,
    releaseTag: voiceManifest.runtime.releaseTag,
    sourceCommit: voiceManifest.runtime.sourceCommit,
    modelRevision: voiceManifest.model.revision,
    reason: integrityVerified ? "Local dictation runtime and model are installed and integrity-verified." : "Local dictation integrity verification failed. Repair the reviewed runtime before using dictation.",
  };
}

function validatePcmWav(bytes: Buffer) {
  if (bytes.length < 44 || bytes.length > voiceManifest.capture.maxWavBytes) throw new Error("VOICE_AUDIO_BOUNDS: Dictation audio is missing or exceeds PlotPickle's two-minute local limit.");
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") throw new Error("VOICE_AUDIO_FORMAT: PlotPickle accepts only local PCM WAV dictation audio.");
  const channels = bytes.readUInt16LE(22);
  const sampleRate = bytes.readUInt32LE(24);
  const bitsPerSample = bytes.readUInt16LE(34);
  if (channels !== voiceManifest.capture.channels || sampleRate !== voiceManifest.capture.sampleRate || bitsPerSample !== voiceManifest.capture.bitsPerSample) {
    throw new Error("VOICE_AUDIO_FORMAT: Dictation audio must be mono 16 kHz signed 16-bit PCM WAV.");
  }
  const durationSeconds = Math.max(0, bytes.length - 44) / (sampleRate * channels * (bitsPerSample / 8));
  if (durationSeconds > voiceManifest.capture.maxDurationSeconds + 0.05) throw new Error("VOICE_AUDIO_BOUNDS: Dictation audio exceeds PlotPickle's two-minute local limit.");
}

function runWhisper(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: path.dirname(command),
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const stderr: Buffer[] = [];
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error("VOICE_TIMEOUT: Local transcription exceeded PlotPickle's bounded runtime window.")));
    }, voiceManifest.execution.timeoutMilliseconds);
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        child.kill();
        finish(() => reject(new Error("VOICE_TRANSCRIPTION_FAILED: whisper.cpp exceeded its bounded output size.")));
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= MAX_STDERR_BYTES) stderr.push(Buffer.from(chunk));
      if (stderrBytes > MAX_STDERR_BYTES) {
        child.kill();
        finish(() => reject(new Error("VOICE_TRANSCRIPTION_FAILED: whisper.cpp exceeded its bounded diagnostic output size.")));
      }
    });
    child.once("error", (error) => finish(() => reject(new Error(`VOICE_RUNTIME_UNAVAILABLE: ${error.message}`))));
    child.once("close", (code) => finish(() => {
      if (code === 0) resolve();
      else reject(new Error(`VOICE_TRANSCRIPTION_FAILED: ${Buffer.concat(stderr).toString("utf8").trim() || `whisper.cpp exited with code ${code ?? "unknown"}.`}`));
    }));
  });
}

export async function transcribeLocalVoiceWav(bytes: Buffer) {
  validatePcmWav(bytes);
  const status = await localVoiceRuntimeStatus();
  if (!status.ready) {
    const code = status.modelInstalled ? "VOICE_RUNTIME_UNAVAILABLE" : "VOICE_MODEL_UNAVAILABLE";
    throw new Error(`${code}: ${status.reason}`);
  }

  const paths = localVoicePaths();
  const runDirectory = path.join(paths.temporaryRoot, `dictation-${randomUUID()}`);
  const wavPath = path.join(runDirectory, "capture.wav");
  const outputBase = path.join(runDirectory, "transcript");
  const transcriptPath = `${outputBase}.txt`;
  await mkdir(runDirectory, { recursive: true });
  try {
    await writeFile(wavPath, bytes, { flag: "wx" });
    await runWhisper(paths.executable, [
      "-m", paths.model,
      "-f", wavPath,
      "-l", "en",
      "-nt",
      "-otxt",
      "-of", outputBase,
    ]);
    const transcript = (await readFile(transcriptPath, "utf8")).replace(/\u0000/gu, "").replace(/\s+/gu, " ").trim();
    if (!transcript) throw new Error("VOICE_TRANSCRIPTION_FAILED: whisper.cpp returned no text for this recording.");
    return Object.freeze({ text: transcript.slice(0, 20_000), provider: voiceManifest.provider, model: voiceManifest.model.id });
  } finally {
    await rm(runDirectory, { recursive: true, force: true });
  }
}
