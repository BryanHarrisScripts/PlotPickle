import type {
  AiImageRequest,
  AiImageResult,
  AiProviderConfig,
  AiProviderStatus,
  AiTextRequest,
  AiTextResult,
  AiVideoJob,
  AiVideoRequest,
} from "./contracts";
import {
  AiProviderError,
  type AiProviderAdapter,
  normalizedBaseUrl,
  OPENAI_VIDEO_SUNSET,
  requireCapability,
} from "./providers";

type FetchLike = typeof fetch;

type AdapterOptions = {
  apiKey?: string;
  fetchImpl?: FetchLike;
};

async function readJson(response: Response) {
  const text = await response.text();
  let value: unknown;
  try {
    value = text ? JSON.parse(text) : {};
  } catch {
    value = { error: { message: text.slice(0, 500) } };
  }
  if (!response.ok) {
    const error = value as { error?: { message?: string }; message?: string };
    const providerMessage = error.error?.message || error.message || "";
    if (response.status === 401 || response.status === 403) {
      throw new AiProviderError("The provider rejected this API key. Reconnect a key owned by the current user.", "invalid-api-key", response.status);
    }
    if (response.status === 402 || /insufficient balance|\b1008\b/i.test(providerMessage)) {
      throw new AiProviderError("The provider account has insufficient balance. Add funds to that user's provider account; PlotPickle does not supply credits.", "insufficient-balance", response.status);
    }
    if (response.status === 429) {
      throw new AiProviderError("The provider rate limit was reached. Wait before retrying; PlotPickle will not switch providers automatically.", "rate-limited", response.status);
    }
    if (response.status === 422 || /sensitive content|\b1026\b|\b1027\b/i.test(providerMessage)) {
      throw new AiProviderError("The provider declined the prompt or reference media under its safety rules.", "provider-safety-rejection", response.status);
    }
    throw new AiProviderError(providerMessage || `Provider request failed with ${response.status}.`, "provider-request-failed", response.status);
  }
  return value as Record<string, unknown>;
}

function withContext(request: AiTextRequest) {
  return request.context ? `${request.prompt}\n\nSelected PlotPickle context:\n${request.context}` : request.prompt;
}

function extractOpenAiOutputText(body: Record<string, unknown>) {
  if (typeof body.output_text === "string") return body.output_text;
  const output = Array.isArray(body.output) ? body.output as { content?: { type?: string; text?: string }[] }[] : [];
  return output
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
}

function unsupportedVideo(config: AiProviderConfig): never {
  const detail = config.kind === "openai"
    ? `OpenAI video is deliberately disabled because the current Sora 2 Videos API is scheduled to shut down on ${OPENAI_VIDEO_SUNSET}.`
    : `${config.label} does not have a configured video adapter.`;
  throw new AiProviderError(detail, "video-provider-unavailable");
}

abstract class BaseAdapter implements AiProviderAdapter {
  readonly fetchImpl: FetchLike;
  readonly apiKey?: string;

  constructor(public readonly config: AiProviderConfig, options: AdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiKey = options.apiKey;
  }

  abstract checkConnection(): Promise<AiProviderStatus>;
  abstract generateText(request: AiTextRequest): Promise<AiTextResult>;
  abstract generateImage(request: AiImageRequest): Promise<AiImageResult>;

  async createVideo(_request: AiVideoRequest): Promise<AiVideoJob> {
    return unsupportedVideo(this.config);
  }

  async getVideoJob(_id: string): Promise<AiVideoJob> {
    return unsupportedVideo(this.config);
  }

  async cancelVideoJob(_id: string): Promise<AiVideoJob> {
    return unsupportedVideo(this.config);
  }
}

function requireBillingConfirmation(config: AiProviderConfig, confirmation: AiImageRequest["billingConfirmation"] | AiVideoRequest["billingConfirmation"]) {
  if (!confirmation?.acknowledged || !confirmation.userOwnedCredential || confirmation.providerId !== config.id || confirmation.maximumRequests !== 1) {
    throw new AiProviderError("Confirm this one paid provider request and the exact data being shared before continuing.", "billing-confirmation-required");
  }
}

export class OpenAiAdapter extends BaseAdapter {
  private headers() {
    if (!this.apiKey) throw new AiProviderError("Enter an OpenAI API key for this local session.", "missing-api-key");
    return { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
  }

  async checkConnection(): Promise<AiProviderStatus> {
    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/models`, { headers: this.headers() });
    const body = await readJson(response);
    const data = Array.isArray(body.data) ? body.data as { id?: string }[] : [];
    return {
      ok: true,
      providerId: this.config.id,
      message: "Connected to the OpenAI API.",
      checkedAt: new Date().toISOString(),
      models: data.flatMap((item) => item.id ? [item.id] : []),
    };
  }

  async generateText(request: AiTextRequest): Promise<AiTextResult> {
    requireCapability(this.config, request.schema ? "structured-output" : "text");
    const model = this.config.models.text;
    if (!model) throw new AiProviderError("Choose an OpenAI text model.", "missing-model");

    const text = request.schema ? {
      format: {
        type: "json_schema",
        name: request.schema.name,
        strict: true,
        schema: request.schema.value,
      },
    } : undefined;

    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/responses`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model,
        instructions: request.instructions,
        input: withContext(request),
        ...(text ? { text } : {}),
      }),
    });
    const body = await readJson(response);
    const outputText = extractOpenAiOutputText(body);
    if (!outputText) throw new AiProviderError("OpenAI returned no text output.", "empty-output");

    let parsed: unknown;
    if (request.schema) {
      try {
        parsed = JSON.parse(outputText);
      } catch {
        throw new AiProviderError("OpenAI returned text that could not be parsed as the requested structure.", "invalid-structured-output");
      }
    }

    return {
      text: outputText,
      parsed,
      providerId: this.config.id,
      model,
      responseId: typeof body.id === "string" ? body.id : undefined,
    };
  }

  async generateImage(request: AiImageRequest): Promise<AiImageResult> {
    requireCapability(this.config, "image-generation");
    const model = this.config.models.image;
    if (!model) throw new AiProviderError("Choose an OpenAI image model.", "missing-model");
    if (request.referenceAssets?.length) {
      throw new AiProviderError("Reference-image editing will be added through the multipart image-editing operation; it is not silently discarded.", "image-editing-not-implemented");
    }

    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/images/generations`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model,
        prompt: request.prompt,
        size: request.size ?? "auto",
        quality: request.quality ?? "auto",
        output_format: request.outputFormat ?? "png",
        n: 1,
      }),
    });
    const body = await readJson(response);
    const data = Array.isArray(body.data) ? body.data as { b64_json?: string; url?: string; revised_prompt?: string }[] : [];
    const image = data[0];
    if (!image?.b64_json && !image?.url) throw new AiProviderError("OpenAI returned no image output.", "empty-output");
    const format = request.outputFormat ?? "png";
    return {
      providerId: this.config.id,
      model,
      mimeType: `image/${format}`,
      base64: image.b64_json,
      url: image.url,
      revisedPrompt: image.revised_prompt,
    };
  }
}

export class OpenAiCompatibleAdapter extends BaseAdapter {
  private headers() {
    return {
      "Content-Type": "application/json",
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }

  async checkConnection(): Promise<AiProviderStatus> {
    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/models`, { headers: this.headers() });
    const body = await readJson(response);
    const data = Array.isArray(body.data) ? body.data as { id?: string }[] : [];
    return {
      ok: true,
      providerId: this.config.id,
      message: `Connected to ${this.config.label}.`,
      checkedAt: new Date().toISOString(),
      models: data.flatMap((item) => item.id ? [item.id] : []),
    };
  }

  async generateText(request: AiTextRequest): Promise<AiTextResult> {
    requireCapability(this.config, "text");
    const model = this.config.models.text;
    if (!model) throw new AiProviderError("Choose a text model for this compatible server.", "missing-model");
    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: request.instructions },
          { role: "user", content: withContext(request) },
        ],
        ...(request.schema ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    const body = await readJson(response);
    const choices = Array.isArray(body.choices) ? body.choices as { message?: { content?: string } }[] : [];
    const outputText = choices[0]?.message?.content ?? "";
    if (!outputText) throw new AiProviderError(`${this.config.label} returned no text output.`, "empty-output");
    let parsed: unknown;
    if (request.schema) {
      try { parsed = JSON.parse(outputText); } catch { parsed = undefined; }
    }
    return { text: outputText, parsed, providerId: this.config.id, model, responseId: typeof body.id === "string" ? body.id : undefined };
  }

  async generateImage(_request: AiImageRequest): Promise<AiImageResult> {
    throw new AiProviderError("Image endpoints vary across compatible servers and must be enabled by a provider-specific adapter.", "image-provider-unavailable");
  }
}

function miniMaxStatus(value: unknown): AiVideoJob["status"] {
  if (value === "queued" || value === "running" || value === "succeeded" || value === "failed" || value === "cancelled" || value === "expired") return value;
  return "failed";
}

export class MiniMaxAdapter extends BaseAdapter {
  private headers() {
    if (!this.apiKey) throw new AiProviderError("Enter a MiniMax API key owned by the current user.", "missing-api-key");
    return { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
  }

  async checkConnection(): Promise<AiProviderStatus> {
    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/v1/models`, { headers: this.headers() });
    const body = await readJson(response);
    const data = Array.isArray(body.data) ? body.data as { id?: string }[] : [];
    return {
      ok: true,
      providerId: this.config.id,
      message: "Connected to MiniMax with a user-owned API key. No media was generated by this check.",
      checkedAt: new Date().toISOString(),
      models: data.flatMap((item) => item.id ? [item.id] : []),
    };
  }

  async generateText(request: AiTextRequest): Promise<AiTextResult> {
    requireCapability(this.config, "text");
    const model = this.config.models.text;
    if (!model) throw new AiProviderError("Choose a MiniMax text model.", "missing-model");
    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/v1/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: request.instructions },
          { role: "user", content: withContext(request) },
        ],
        stream: false,
      }),
    });
    const body = await readJson(response);
    const choices = Array.isArray(body.choices) ? body.choices as { message?: { content?: string } }[] : [];
    const outputText = choices[0]?.message?.content ?? "";
    if (!outputText) throw new AiProviderError("MiniMax returned no text output.", "empty-output");
    return { text: outputText, providerId: this.config.id, model, responseId: typeof body.id === "string" ? body.id : undefined };
  }

  async generateImage(request: AiImageRequest): Promise<AiImageResult> {
    requireCapability(this.config, "image-generation");
    requireBillingConfirmation(this.config, request.billingConfirmation);
    const model = this.config.models.image;
    if (!model) throw new AiProviderError("Choose a MiniMax image model.", "missing-model");
    const aspectRatio = request.size === "1536x1024" ? "16:9" : request.size === "1024x1536" ? "9:16" : "1:1";
    const reference = request.referenceAssets?.[0];
    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/v1/image_generation`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model,
        prompt: request.prompt.slice(0, 1500),
        aspect_ratio: aspectRatio,
        response_format: "base64",
        n: 1,
        ...(reference ? { subject_reference: [{ type: "character", image_file: reference.uri }] } : {}),
      }),
    });
    const body = await readJson(response);
    const data = body.data && typeof body.data === "object" ? body.data as { image_base64?: string[]; image_urls?: string[] } : {};
    const base64 = data.image_base64?.[0];
    const url = data.image_urls?.[0];
    if (!base64 && !url) throw new AiProviderError("MiniMax returned no image output.", "empty-output");
    return {
      providerId: this.config.id,
      model,
      mimeType: "image/jpeg",
      base64,
      url,
      responseId: typeof body.id === "string" ? body.id : undefined,
    };
  }

  async createVideo(request: AiVideoRequest): Promise<AiVideoJob> {
    requireCapability(this.config, "video-generation");
    requireBillingConfirmation(this.config, request.billingConfirmation);
    const model = this.config.models.video;
    if (!model) throw new AiProviderError("Choose a MiniMax video model.", "missing-model");
    const content: Array<Record<string, unknown>> = [{ type: "text", text: request.prompt.slice(0, 7000) }];
    if (request.sourceAsset?.uri) {
      content.push({ type: "image_url", image_url: { url: request.sourceAsset.uri }, role: "first_frame" });
    }
    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/v2/video_generation`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model,
        content,
        resolution: "2K",
        duration: Math.max(4, Math.min(15, Math.round(request.durationSeconds ?? 5))),
        ...(request.sourceAsset ? {} : { ratio: request.aspectRatio ?? "16:9" }),
      }),
    });
    const body = await readJson(response);
    const id = typeof body.task_id === "string" ? body.task_id : "";
    if (!id) throw new AiProviderError("MiniMax returned no video task ID.", "empty-output");
    return { id, providerId: this.config.id, model, status: "queued" };
  }

  async getVideoJob(id: string): Promise<AiVideoJob> {
    const model = this.config.models.video || "MiniMax-H3";
    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/v2/query/video_generation/${encodeURIComponent(id)}`, { headers: this.headers() });
    const body = await readJson(response);
    const task = body.task && typeof body.task === "object" ? body.task as { status?: string; content?: { url?: string }; error?: string } : {};
    const status = miniMaxStatus(task.status);
    return {
      id,
      providerId: this.config.id,
      model,
      status,
      output: status === "succeeded" && task.content?.url ? { id: `minimax-video-${id}`, kind: "video", uri: task.content.url, mimeType: "video/mp4" } : undefined,
      error: status === "failed" || status === "expired" ? task.error || `MiniMax video task ${status}.` : undefined,
    };
  }

  async cancelVideoJob(id: string): Promise<AiVideoJob> {
    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/v2/video_generation/${encodeURIComponent(id)}`, { method: "DELETE", headers: this.headers() });
    const body = await readJson(response);
    return {
      id,
      providerId: this.config.id,
      model: this.config.models.video || "MiniMax-H3",
      status: miniMaxStatus(body.status || "cancelled"),
    };
  }
}

export class OllamaAdapter extends BaseAdapter {
  async checkConnection(): Promise<AiProviderStatus> {
    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/api/tags`);
    const body = await readJson(response);
    const models = Array.isArray(body.models) ? body.models as { name?: string }[] : [];
    return {
      ok: true,
      providerId: this.config.id,
      message: "Connected to the local Ollama server.",
      checkedAt: new Date().toISOString(),
      models: models.flatMap((item) => item.name ? [item.name] : []),
    };
  }

  async generateText(request: AiTextRequest): Promise<AiTextResult> {
    requireCapability(this.config, "text");
    const model = this.config.models.text;
    if (!model) throw new AiProviderError("Choose an installed Ollama model.", "missing-model");
    const response = await this.fetchImpl(`${normalizedBaseUrl(this.config.baseUrl)}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: request.instructions },
          { role: "user", content: withContext(request) },
        ],
        ...(request.schema ? { format: request.schema.value } : {}),
      }),
    });
    const body = await readJson(response);
    const message = body.message as { content?: string } | undefined;
    const outputText = message?.content ?? "";
    if (!outputText) throw new AiProviderError("Ollama returned no text output.", "empty-output");
    let parsed: unknown;
    if (request.schema) {
      try { parsed = JSON.parse(outputText); } catch { parsed = undefined; }
    }
    return { text: outputText, parsed, providerId: this.config.id, model };
  }

  async generateImage(_request: AiImageRequest): Promise<AiImageResult> {
    throw new AiProviderError("The Ollama adapter does not assume an image-generation endpoint.", "image-provider-unavailable");
  }
}

export function createAiProvider(config: AiProviderConfig, options: AdapterOptions = {}): AiProviderAdapter {
  if (config.kind === "openai") return new OpenAiAdapter(config, options);
  if (config.kind === "minimax") return new MiniMaxAdapter(config, options);
  if (config.kind === "openai-compatible") return new OpenAiCompatibleAdapter(config, options);
  if (config.kind === "ollama") return new OllamaAdapter(config, options);
  throw new AiProviderError(`${config.label} does not make live API calls.`, "provider-disabled");
}
