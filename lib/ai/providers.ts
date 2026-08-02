import type {
  AiCapability,
  AiImageRequest,
  AiImageResult,
  AiProviderConfig,
  AiProviderKind,
  AiProviderStatus,
  AiTextRequest,
  AiTextResult,
  AiVideoJob,
  AiVideoRequest,
} from "./contracts";

export const OPENAI_VIDEO_SUNSET = "2026-09-24" as const;

export type ProviderPreset = {
  kind: AiProviderKind;
  label: string;
  description: string;
  testedFocus: boolean;
  defaultConfig: Omit<AiProviderConfig, "id" | "label">;
  limitations: string[];
};

export const providerPresets: ProviderPreset[] = [
  {
    kind: "openai",
    label: "ChatGPT / OpenAI API",
    description: "Primary PlotPickle development and live-test target. Requires a separate OpenAI API key.",
    testedFocus: true,
    defaultConfig: {
      kind: "openai",
      baseUrl: "https://api.openai.com/v1",
      enabled: true,
      secretSource: "session",
      capabilities: ["text", "structured-output", "vision", "image-generation", "image-editing", "knowledge-search", "prompt-export"],
      models: {
        text: "gpt-5.6",
        vision: "gpt-5.6",
        image: "gpt-image-2",
      },
    },
    limitations: [
      "ChatGPT subscriptions and OpenAI API billing are separate.",
      `OpenAI video is not enabled because the current Sora 2 Videos API is scheduled to shut down on ${OPENAI_VIDEO_SUNSET}.`,
    ],
  },
  {
    kind: "minimax",
    label: "MiniMax API",
    description: "Optional BYOK cloud writing, image and H3 video provider. Charges go directly to the writer's MiniMax account.",
    testedFocus: true,
    defaultConfig: {
      kind: "minimax",
      baseUrl: "https://api.minimax.io",
      enabled: true,
      secretSource: "session",
      capabilities: ["text", "image-generation", "image-editing", "video-generation", "prompt-export"],
      models: {
        text: "MiniMax-M3",
        image: "image-01",
        video: "MiniMax-H3",
      },
    },
    limitations: [
      "Bring your own provider account. Cloud AI charges are billed directly by MiniMax. PlotPickle does not supply credits or pay for generation.",
      "MiniMax receives only the prompt and media named in the confirmation shown before a paid request.",
    ],
  },
  {
    kind: "openai-compatible",
    label: "OpenAI-compatible server",
    description: "Connect a hosted or local server that implements a compatible chat-completions endpoint.",
    testedFocus: false,
    defaultConfig: {
      kind: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234/v1",
      enabled: true,
      secretSource: "none",
      capabilities: ["text", "prompt-export"],
      models: {},
    },
    limitations: ["Model names and non-text capabilities depend on the selected server."],
  },
  {
    kind: "ollama",
    label: "Ollama (local)",
    description: "Run compatible open models on the same computer without sending prompts to a hosted provider.",
    testedFocus: false,
    defaultConfig: {
      kind: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      enabled: true,
      secretSource: "none",
      capabilities: ["text", "prompt-export"],
      models: {},
    },
    limitations: ["Vision, context size, speed, and structured output depend on the installed local model."],
  },
  {
    kind: "manual",
    label: "Manual prompt export",
    description: "Build complete prompts and copy them into any AI service without connecting PlotPickle.",
    testedFocus: false,
    defaultConfig: {
      kind: "manual",
      baseUrl: "",
      enabled: true,
      secretSource: "none",
      capabilities: ["prompt-export"],
      models: {},
    },
    limitations: ["Returned text and media must be imported manually."],
  },
  {
    kind: "disabled",
    label: "No AI",
    description: "Use every PlotPickle planning and visual tool manually.",
    testedFocus: false,
    defaultConfig: {
      kind: "disabled",
      baseUrl: "",
      enabled: false,
      secretSource: "none",
      capabilities: [],
      models: {},
    },
    limitations: [],
  },
];

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export interface AiProviderAdapter {
  readonly config: AiProviderConfig;
  checkConnection(): Promise<AiProviderStatus>;
  generateText(request: AiTextRequest): Promise<AiTextResult>;
  generateImage(request: AiImageRequest): Promise<AiImageResult>;
  createVideo(request: AiVideoRequest): Promise<AiVideoJob>;
  getVideoJob(id: string): Promise<AiVideoJob>;
  cancelVideoJob(id: string): Promise<AiVideoJob>;
}

export function hasCapability(config: AiProviderConfig, capability: AiCapability) {
  return config.enabled && config.capabilities.includes(capability);
}

export function requireCapability(config: AiProviderConfig, capability: AiCapability) {
  if (!hasCapability(config, capability)) {
    throw new AiProviderError(`${config.label} does not advertise the ${capability} capability.`, "capability-unavailable");
  }
}

export function normalizedBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function safeErrorMessage(value: unknown) {
  if (value instanceof AiProviderError) return value.message;
  if (value instanceof Error) return value.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]");
  return "The AI provider returned an unknown error.";
}

