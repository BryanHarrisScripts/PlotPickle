"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { insertDictationText, voiceInputAllowed, type VoiceInputState } from "../../lib/voice-input";
import styles from "./voice-input-control.module.css";

type VoiceField = HTMLInputElement | HTMLTextAreaElement;
type CaptureResources = {
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  sink: GainNode;
  chunks: Float32Array[];
  sampleRate: number;
  timer: number;
};

type VoiceInputControlProps = {
  readonly value: string;
  readonly onValueChange: (next: string) => void;
  readonly inputRef: RefObject<VoiceField | null>;
  readonly disabled?: boolean;
  readonly inputType?: string;
  readonly purpose?: string;
  readonly voiceInput?: boolean;
  readonly className?: string;
};

let activeVoiceSession: { id: string; cancel: () => void } | null = null;

const statusText: Record<VoiceInputState, string> = {
  IDLE: "Local dictation ready.",
  REQUESTING_PERMISSION: "Requesting microphone permission.",
  LISTENING: "Listening. Activate Stop dictation when you are finished.",
  FINALIZING_AUDIO: "Finalizing local audio.",
  TRANSCRIBING: "Transcribing locally with whisper.cpp.",
  INSERTED: "Dictated text inserted. Review or edit it before sending.",
  PERMISSION_DENIED: "Microphone permission was denied. Existing text was preserved.",
  MIC_UNAVAILABLE: "No usable microphone is available. Existing text was preserved.",
  MODEL_UNAVAILABLE: "The reviewed local speech model is unavailable. Open Settings → Local → Local Dictation.",
  RUNTIME_UNAVAILABLE: "The reviewed local speech runtime is unavailable. Open Settings → Local → Local Dictation.",
  TRANSCRIPTION_FAILED: "Local transcription failed. Existing text was preserved.",
  CANCELLED: "Dictation cancelled. Existing text was preserved.",
  TIMEOUT: "Dictation stopped at the two-minute safety limit. Existing text was preserved.",
};

function concatenate(chunks: readonly Float32Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  return samples;
}

function resample(samples: Float32Array, inputRate: number, outputRate = 16000) {
  if (!samples.length || inputRate === outputRate) return samples;
  const outputLength = Math.max(1, Math.round(samples.length * outputRate / inputRate));
  const output = new Float32Array(outputLength);
  const ratio = inputRate / outputRate;
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(samples.length - 1, left + 1);
    const mix = position - left;
    output[index] = samples[left] * (1 - mix) + samples[right] * mix;
  }
  return output;
}

function pcm16Wav(samples: Float32Array, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function stateFromFailure(error: unknown): VoiceInputState {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "PERMISSION_DENIED";
    if (error.name === "NotFoundError" || error.name === "NotReadableError" || error.name === "OverconstrainedError") return "MIC_UNAVAILABLE";
  }
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code || "") : "";
  if (code === "VOICE_MODEL_UNAVAILABLE") return "MODEL_UNAVAILABLE";
  if (code === "VOICE_RUNTIME_UNAVAILABLE") return "RUNTIME_UNAVAILABLE";
  if (code === "VOICE_TIMEOUT") return "TIMEOUT";
  return "TRANSCRIPTION_FAILED";
}

export default function VoiceInputControl({
  value,
  onValueChange,
  inputRef,
  disabled = false,
  inputType = "text",
  purpose = "natural-language",
  voiceInput = true,
  className = "",
}: VoiceInputControlProps) {
  const [state, setState] = useState<VoiceInputState>("IDLE");
  const resourcesRef = useRef<CaptureResources | null>(null);
  const sessionIdRef = useRef("");
  const valueRef = useRef(value);
  const selectionRef = useRef({ start: value.length, end: value.length });
  const mountedRef = useRef(true);

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => () => {
    mountedRef.current = false;
    const resources = resourcesRef.current;
    if (resources) {
      window.clearTimeout(resources.timer);
      resources.stream.getTracks().forEach((track) => track.stop());
      resources.processor.disconnect();
      resources.source.disconnect();
      resources.sink.disconnect();
      void resources.context.close().catch(() => undefined);
    }
    if (activeVoiceSession?.id === sessionIdRef.current) activeVoiceSession = null;
  }, []);

  const eligible = voiceInputAllowed({ type: inputType, purpose, voiceInput });
  if (!eligible) return null;

  function clearActiveOwner() {
    if (activeVoiceSession?.id === sessionIdRef.current) activeVoiceSession = null;
  }

  async function releaseCapture() {
    const resources = resourcesRef.current;
    resourcesRef.current = null;
    if (!resources) return null;
    window.clearTimeout(resources.timer);
    resources.stream.getTracks().forEach((track) => track.stop());
    resources.processor.onaudioprocess = null;
    resources.processor.disconnect();
    resources.source.disconnect();
    resources.sink.disconnect();
    await resources.context.close().catch(() => undefined);
    clearActiveOwner();
    return resources;
  }

  function cancelFromAnotherField() {
    void releaseCapture().finally(() => {
      if (mountedRef.current) setState("CANCELLED");
    });
  }

  async function startListening() {
    if (disabled || state === "REQUESTING_PERMISSION" || state === "TRANSCRIBING" || state === "FINALIZING_AUDIO") return;
    activeVoiceSession?.cancel();
    const id = globalThis.crypto?.randomUUID?.() ?? `voice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionIdRef.current = id;
    activeVoiceSession = { id, cancel: cancelFromAnotherField };
    const field = inputRef.current;
    selectionRef.current = {
      start: field?.selectionStart ?? valueRef.current.length,
      end: field?.selectionEnd ?? field?.selectionStart ?? valueRef.current.length,
    };
    setState("REQUESTING_PERMISSION");

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("Microphone capture is unavailable.", "NotFoundError");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (activeVoiceSession?.id !== id) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const context = new AudioContext({ sampleRate: 16000 });
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const sink = context.createGain();
      sink.gain.value = 0;
      const chunks: Float32Array[] = [];
      processor.onaudioprocess = (event) => {
        if (chunks.reduce((sum, chunk) => sum + chunk.length, 0) >= context.sampleRate * 120) return;
        chunks.push(Float32Array.from(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(sink);
      sink.connect(context.destination);
      const timer = window.setTimeout(() => {
        void releaseCapture().finally(() => {
          if (mountedRef.current) setState("TIMEOUT");
        });
      }, 120_000);
      resourcesRef.current = { stream, context, source, processor, sink, chunks, sampleRate: context.sampleRate, timer };
      setState("LISTENING");
    } catch (error) {
      clearActiveOwner();
      if (mountedRef.current) setState(stateFromFailure(error));
    }
  }

  async function stopAndTranscribe() {
    if (state !== "LISTENING") return;
    setState("FINALIZING_AUDIO");
    const resources = await releaseCapture();
    if (!resources) {
      setState("TRANSCRIPTION_FAILED");
      return;
    }
    try {
      const samples = resample(concatenate(resources.chunks), resources.sampleRate, 16000);
      const wav = pcm16Wav(samples, 16000);
      if (wav.size <= 44) throw new Error("No microphone audio was captured.");
      setState("TRANSCRIBING");
      const response = await fetch("/api/local-voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: wav,
      });
      const body = await response.json() as { ok?: boolean; text?: string; code?: string; message?: string };
      if (!response.ok || !body.text) {
        const error = new Error(body.message || "Local transcription failed.") as Error & { code?: string };
        error.code = body.code;
        throw error;
      }
      const current = valueRef.current;
      const next = insertDictationText(current, body.text, selectionRef.current.start, selectionRef.current.end);
      onValueChange(next.value);
      valueRef.current = next.value;
      setState("INSERTED");
      window.requestAnimationFrame(() => {
        const field = inputRef.current;
        field?.focus({ preventScroll: true });
        field?.setSelectionRange(next.caret, next.caret);
      });
      window.setTimeout(() => { if (mountedRef.current) setState("IDLE"); }, 1200);
    } catch (error) {
      if (mountedRef.current) setState(stateFromFailure(error));
    }
  }

  const listening = state === "LISTENING";
  const busy = ["REQUESTING_PERMISSION", "FINALIZING_AUDIO", "TRANSCRIBING"].includes(state);
  const label = listening ? "Stop dictation" : "Dictate text";

  return (
    <span className={`${styles.control} ${className}`.trim()} data-voice-state={state}>
      <button
        type="button"
        className={styles.button}
        aria-label={label}
        aria-pressed={listening}
        disabled={disabled || busy}
        onClick={() => { if (listening) void stopAndTranscribe(); else void startListening(); }}
        title={label}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path d="M12 15.25a3.75 3.75 0 0 0 3.75-3.75v-4a3.75 3.75 0 0 0-7.5 0v4A3.75 3.75 0 0 0 12 15.25Zm-6-4a6 6 0 0 0 12 0M12 17.25V21m-3 0h6" />
        </svg>
      </button>
      <span className={styles.status} role="status" aria-live="polite">{statusText[state]}</span>
    </span>
  );
}
