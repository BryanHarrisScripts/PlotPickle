import type {
  ProviderCapabilityContract,
} from "./provider-capability-contract";
import type {
  ProviderInstructionAdapter,
  ProviderInstructionPayload,
  ProviderInstructionShotAdapterPayload,
  ProviderInstructionShotPayload,
} from "./provider-instruction-compiler";

export type ProviderInstructionRuntimeTarget = {
  readonly capability: "video";
  readonly locality: "local" | "cloud";
  readonly sourceRegistryRouteId: string;
  readonly runtimeProviderId: string;
  readonly pluginAdapterId: string | null;
};

export type ConcreteProviderInstructionIntegration = {
  readonly version: 1;
  readonly providerId: string;
  readonly runtimeTarget: ProviderInstructionRuntimeTarget;
  readonly capabilityContract: ProviderCapabilityContract;
  readonly instructionAdapter: ProviderInstructionAdapter;
};

function clean(value: string) {
  return value.trim();
}

function list(values: readonly string[]) {
  return values.map(clean).filter(Boolean).join("; ");
}

function assetList(values: readonly { readonly kind: string; readonly id: string }[]) {
  return values.map((value) => `${value.kind}:${value.id}`).join("; ");
}

function informationLines(shot: ProviderInstructionShotPayload) {
  return shot.informationDirectives.map((directive) => {
    const release = directive.release?.reference
      ? ` Release only at ${directive.release.reference}${directive.release.condition ? ` when ${directive.release.condition}` : ""}.`
      : "";
    return `${directive.mode}: ${directive.statement}. ${directive.protectionIntent}${release}`.trim();
  });
}

function cameraLine(shot: ProviderInstructionShotPayload) {
  if (!shot.camera) return "";
  return [
    shot.camera.shotSize,
    shot.camera.angle,
    shot.camera.movement,
    shot.camera.lensIntent,
    shot.camera.lightingIntent,
  ].map(clean).filter(Boolean).join(" | ");
}

function blockingLines(shot: ProviderInstructionShotPayload) {
  return (shot.blocking ?? []).map((item) => [
    `subject ${item.subjectId}`,
    item.startPosition ? `start ${item.startPosition}` : "",
    item.facing ? `facing ${item.facing}` : "",
    item.eyelineTargetId ? `eyeline ${item.eyelineTargetId}` : "",
    item.movement ? `movement ${item.movement}` : "",
    item.endPosition ? `end ${item.endPosition}` : "",
    item.screenDirection ? `screen direction ${item.screenDirection}` : "",
    item.axisState ? `axis ${item.axisState}` : "",
  ].filter(Boolean).join(", "));
}

function generationRequirementLines(payload: Pick<ProviderInstructionPayload, "generationRequirements">) {
  return payload.generationRequirements.map((item) => {
    const note = clean(item.note);
    return `${item.strength.toUpperCase()} ${item.property}: ${item.treatment}${note ? ` — ${note}` : ""}`;
  });
}

function openAiShotBlock(shot: ProviderInstructionShotPayload, index: number) {
  const lines = [
    `SHOT ${index + 1} — ${shot.durationSeconds}s`,
    `Narrative purpose: ${shot.narrativePurpose}`,
    cameraLine(shot) ? `Camera / lighting: ${cameraLine(shot)}` : "",
    ...blockingLines(shot).map((value) => `Blocking: ${value}`),
    shot.continuityLockReferences.length ? `Continuity locks: ${list(shot.continuityLockReferences)}` : "",
    ...informationLines(shot).map((value) => `Information boundary: ${value}`),
    shot.frameRefs.length ? `Approved frame references: ${list(shot.frameRefs)}` : "",
    shot.assetRefs.length ? `Approved asset references: ${assetList(shot.assetRefs)}` : "",
    shot.audioIntents?.length ? `Audio intent: ${list(shot.audioIntents)}` : "",
    shot.transitionIn ? `Transition in: ${shot.transitionIn}` : "",
    shot.transitionOut ? `Transition out: ${shot.transitionOut}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function compileOpenAiMaster(payload: ProviderInstructionPayload) {
  const requirements = generationRequirementLines(payload);
  return [
    `Create one coherent video sequence for scene “${payload.scene.title}”.`,
    `Creative objective: ${payload.scene.purpose}`,
    `Scene objective: ${payload.scene.objective}`,
    `Opposition: ${payload.scene.opposition}`,
    `Action progression: ${payload.scene.action}`,
    `Turn: ${payload.scene.turn}`,
    `Outcome: ${payload.scene.outcome}`,
    `Requested sequence duration: ${payload.sequenceDurationSeconds}s. Preserve the authored beat timing as closely as the current video runtime allows.`,
    payload.scene.assetRefs.length ? `Scene reference identities: ${assetList(payload.scene.assetRefs)}` : "",
    "SHOT PLAN",
    payload.shots.map(openAiShotBlock).join("\n\n"),
    requirements.length ? `CAPABILITY-AWARE REQUIREMENTS\n${requirements.join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

function compileOpenAiShot(payload: ProviderInstructionShotAdapterPayload) {
  const requirements = generationRequirementLines(payload);
  return [
    `Create shot ${payload.shotIndex + 1} of ${payload.shotCount} for scene “${payload.scene.title}”.`,
    `Scene intent: ${payload.scene.purpose}`,
    `Scene action: ${payload.scene.action}`,
    openAiShotBlock(payload.shot, payload.shotIndex),
    requirements.length ? `Requirements:\n${requirements.join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

function compileLtxShot(payload: ProviderInstructionShotAdapterPayload) {
  const shot = payload.shot;
  return [
    "Generate one continuous text-to-video shot. Do not invent a second shot or an editorial cut.",
    `Scene: ${payload.scene.title}. ${payload.scene.purpose}`,
    `Narrative purpose: ${shot.narrativePurpose}`,
    `Action: ${payload.scene.action}`,
    cameraLine(shot) ? `Camera and light: ${cameraLine(shot)}` : "",
    ...blockingLines(shot).map((value) => `Blocking: ${value}`),
    shot.continuityLockReferences.length ? `Preserve continuity: ${list(shot.continuityLockReferences)}` : "",
    ...informationLines(shot).map((value) => `Story information rule: ${value}`),
    "Keep motion readable, physically coherent and achievable inside one short local generation pass.",
  ].filter(Boolean).join("\n");
}

/**
 * Current OpenAI video integration. The existing PlotPickle runtime sends one
 * prompt plus quantized duration and landscape/portrait size controls. Prompted
 * filmmaking direction is therefore best-effort unless the runtime exposes an
 * explicit control. Finishing-only properties are kept out of generation prose
 * by the Phase 2 compiler.
 */
export const OPENAI_VIDEO_CAPABILITY_CONTRACT: ProviderCapabilityContract = {
  version: 1,
  providerId: "openai",
  capability: "video",
  compilationStrategies: ["master", "per-shot"],
  rules: [
    { property: "scene.intent", treatment: "best-effort" },
    { property: "sequence.duration", treatment: "best-effort", note: "The current OpenAI video runtime quantizes requested duration to 4, 8 or 12 seconds." },
    { property: "shot.order", treatment: "best-effort" },
    { property: "shot.duration", treatment: "best-effort", note: "Exact authored shot timing is not a native per-shot control in the current OpenAI video request." },
    { property: "camera.framing", treatment: "best-effort" },
    { property: "camera.lens", treatment: "best-effort" },
    { property: "camera.movement", treatment: "best-effort" },
    { property: "blocking", treatment: "best-effort" },
    { property: "lighting", treatment: "best-effort" },
    { property: "references", treatment: "best-effort", note: "The current runtime can attach one source image; additional reference identities remain prompt context." },
    { property: "continuity", treatment: "best-effort" },
    { property: "information-boundary", treatment: "best-effort" },
    { property: "audio", treatment: "unsupported", note: "The current PlotPickle OpenAI video request does not expose an audio-direction control." },
    { property: "transitions", treatment: "best-effort" },
    { property: "delivery.aspect-ratio", treatment: "best-effort", note: "The current runtime maps landscape and portrait requests to provider-supported sizes." },
    { property: "delivery.frame-rate", treatment: "finishing", note: "Normalize frame rate in finishing/export rather than implying generation-time enforcement." },
    { property: "delivery.resolution", treatment: "finishing", note: "Normalize final delivery resolution in finishing/export." },
    { property: "delivery.frame-count", treatment: "finishing", note: "Derive final frame count from the delivered asset during finishing/export." },
  ],
};

export const OPENAI_VIDEO_INSTRUCTION_ADAPTER: ProviderInstructionAdapter = {
  version: 1,
  providerId: "openai",
  compileMaster: compileOpenAiMaster,
  compileShot: compileOpenAiShot,
};

/**
 * Current GTX-1080-safe local LTX integration. The reviewed bundled workflow is
 * text-to-video with a fixed 640x352 / 25-frame / 24-fps preset, so delivery and
 * exact timing properties are kept truthful as finishing responsibilities.
 */
export const LTX_LOCAL_VIDEO_CAPABILITY_CONTRACT: ProviderCapabilityContract = {
  version: 1,
  providerId: "comfyui-ltx-local",
  capability: "video",
  compilationStrategies: ["per-shot"],
  rules: [
    { property: "scene.intent", treatment: "best-effort" },
    { property: "sequence.duration", treatment: "finishing", note: "The reviewed local LTX preset is a short fixed-frame generation; assemble sequence timing after generation." },
    { property: "shot.order", treatment: "enforceable", note: "PlotPickle emits one local request per approved Shot in deterministic editorial order." },
    { property: "shot.duration", treatment: "finishing", note: "The reviewed local LTX preset uses a fixed frame count; authored Shot duration remains an editorial/finishing responsibility." },
    { property: "camera.framing", treatment: "best-effort" },
    { property: "camera.lens", treatment: "best-effort" },
    { property: "camera.movement", treatment: "best-effort" },
    { property: "blocking", treatment: "best-effort" },
    { property: "lighting", treatment: "best-effort" },
    { property: "references", treatment: "unsupported", note: "The reviewed local LTX preset is text-to-video and does not accept image-reference conditioning." },
    { property: "continuity", treatment: "best-effort" },
    { property: "information-boundary", treatment: "best-effort" },
    { property: "audio", treatment: "unsupported", note: "The reviewed local LTX generation path does not generate or control audio." },
    { property: "transitions", treatment: "finishing" },
    { property: "delivery.aspect-ratio", treatment: "finishing", note: "The reviewed local preset renders 640x352; target delivery framing belongs to finishing/export." },
    { property: "delivery.frame-rate", treatment: "finishing", note: "The reviewed local preset renders at 24 fps; normalize delivery rate in finishing/export if needed." },
    { property: "delivery.resolution", treatment: "finishing", note: "The reviewed local preset renders 640x352 without upscaling." },
    { property: "delivery.frame-count", treatment: "finishing", note: "The reviewed local preset renders 25 frames; final frame count belongs to finishing/export." },
  ],
};

export const LTX_LOCAL_VIDEO_INSTRUCTION_ADAPTER: ProviderInstructionAdapter = {
  version: 1,
  providerId: "comfyui-ltx-local",
  compileShot: compileLtxShot,
};

const INTEGRATIONS: readonly ConcreteProviderInstructionIntegration[] = [
  {
    version: 1,
    providerId: "comfyui-ltx-local",
    runtimeTarget: {
      capability: "video",
      locality: "local",
      sourceRegistryRouteId: "video.comfyui-native",
      runtimeProviderId: "comfyui",
      pluginAdapterId: "comfyui-ltx-local",
    },
    capabilityContract: LTX_LOCAL_VIDEO_CAPABILITY_CONTRACT,
    instructionAdapter: LTX_LOCAL_VIDEO_INSTRUCTION_ADAPTER,
  },
  {
    version: 1,
    providerId: "openai",
    runtimeTarget: {
      capability: "video",
      locality: "cloud",
      sourceRegistryRouteId: "video.openai",
      runtimeProviderId: "openai",
      pluginAdapterId: null,
    },
    capabilityContract: OPENAI_VIDEO_CAPABILITY_CONTRACT,
    instructionAdapter: OPENAI_VIDEO_INSTRUCTION_ADAPTER,
  },
];

export function providerInstructionIntegrationIds() {
  return INTEGRATIONS.map((item) => item.providerId).sort();
}

/**
 * Resolve instruction compilation for a target that PlotPickle routing has
 * already selected. This function does not read routing state, choose a route,
 * activate a provider, call a model, or submit a media job.
 */
export function providerInstructionIntegrationForSelectedTarget(providerId: string) {
  const normalized = clean(providerId);
  const integration = INTEGRATIONS.find((item) => item.providerId === normalized);
  if (!integration) throw new Error(`No #2064 provider instruction integration is registered for ${normalized || "the selected target"}.`);
  return integration;
}
