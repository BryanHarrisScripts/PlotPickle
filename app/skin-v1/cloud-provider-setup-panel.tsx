"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OPENAI_VIDEO_SUNSET, providerPresets } from "../../lib/runtime/ai/providers";

type Provider = "openai" | "minimax";
type ProviderStatus = {
  configured?: boolean;
  ready?: boolean;
  baseUrl?: string;
  model?: string;
  verifiedAt?: string;
  error?: string;
};
type WritingStatus = { providers?: Partial<Record<Provider, ProviderStatus>> };
type MediaProfile = {
  configured?: boolean;
  baseUrl?: string;
  imageModel?: string;
  videoModel?: string;
  imageVerifiedAt?: string;
  videoVerifiedAt?: string;
  lastError?: string;
};
type MediaStatus = { profiles?: Partial<Record<Provider, MediaProfile>> };
type ProfileStatus = {
  authenticated?: boolean;
  csrfToken?: string | null;
  profile?: { displayName?: string } | null;
};
type AuthorityResponse = {
  ok?: boolean;
  provider?: Provider;
  message?: string;
};
type TestResponse = {
  ok?: boolean;
  id?: string;
  status?: string;
  verifiedAt?: string;
  message?: string;
  error?: string;
};

type ProviderForm = {
  baseUrl: string;
  textModel: string;
  imageModel: string;
  videoModel: string;
};

const panel: React.CSSProperties = {
  marginBottom: "var(--pp-skin-space-4)",
  padding: "var(--pp-skin-space-4)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
  background: "var(--pp-skin-surface-1)",
  color: "var(--pp-skin-ink)",
  boxShadow: "var(--pp-skin-inset-highlight)",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "var(--pp-skin-space-3)",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: "var(--pp-skin-space-2)",
  color: "var(--pp-skin-ink-soft)",
  fontSize: 13,
};

const input: React.CSSProperties = {
  minHeight: "var(--pp-skin-touch-target)",
  padding: "var(--pp-skin-space-2) var(--pp-skin-space-3)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line-strong)",
  borderRadius: "var(--pp-skin-radius)",
  background: "var(--pp-skin-surface-0)",
  color: "var(--pp-skin-ink)",
  font: "inherit",
};

const button: React.CSSProperties = {
  minHeight: "var(--pp-skin-touch-target)",
  padding: "var(--pp-skin-space-2) var(--pp-skin-space-3)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)",
  borderRadius: "var(--pp-skin-radius)",
  background: "var(--pp-skin-surface-0)",
  color: "var(--pp-skin-ink)",
  font: "inherit",
  cursor: "pointer",
};

function formatDate(value?: string) {
  if (!value) return "Not tested";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

async function json<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "The cloud provider request failed.");
  return body;
}

export default function CloudProviderSetupPanel({ provider }: { provider: Provider }) {
  const preset = useMemo(() => providerPresets.find((item) => item.kind === provider), [provider]);
  const label = provider === "openai" ? "OpenAI" : "MiniMax";
  const [form, setForm] = useState<ProviderForm>({
    baseUrl: preset?.defaultConfig.baseUrl || "",
    textModel: preset?.defaultConfig.models.text || "",
    imageModel: preset?.defaultConfig.models.image || "",
    videoModel: preset?.defaultConfig.models.video || "",
  });
  const [apiKey, setApiKey] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [profileName, setProfileName] = useState("");
  const [writing, setWriting] = useState<ProviderStatus>({});
  const [media, setMedia] = useState<MediaProfile>({});
  const [paidAcknowledged, setPaidAcknowledged] = useState(false);
  const [dataSharingAcknowledged, setDataSharingAcknowledged] = useState(false);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("Checking cloud provider authority…");

  const refresh = useCallback(async () => {
    try {
      const [profileStatus, writingStatus, mediaStatus] = await Promise.all([
        json<ProfileStatus>("/api/auth/profile", { cache: "no-store", credentials: "same-origin" }),
        json<WritingStatus>("/api/writing-assistant/status", { cache: "no-store" }),
        json<MediaStatus>("/api/media-routing/status", { cache: "no-store" }),
      ]);
      if (!profileStatus.authenticated || !profileStatus.csrfToken) throw new Error("Cloud authority requires an authenticated human profile.");
      setCsrfToken(profileStatus.csrfToken);
      setProfileName(profileStatus.profile?.displayName || "Current human profile");
      const nextWriting = writingStatus.providers?.[provider] || {};
      const nextMedia = mediaStatus.profiles?.[provider] || {};
      setWriting(nextWriting);
      setMedia(nextMedia);
      setForm((current) => ({
        baseUrl: nextWriting.baseUrl || nextMedia.baseUrl || current.baseUrl,
        textModel: nextWriting.model || current.textModel,
        imageModel: nextMedia.imageModel || current.imageModel,
        videoModel: nextMedia.videoModel || current.videoModel,
      }));
      setNotice(nextWriting.configured || nextMedia.configured
        ? `${label} authority is saved for ${profileStatus.profile?.displayName || "the current human profile"}. Secret values are not displayed.`
        : `Enter the ${label} API key owned by this human profile. Saving authority does not run a paid generation or activate a cloud route.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Cloud provider authority could not be checked.");
    }
  }, [label, provider]);

  useEffect(() => { void refresh(); }, [refresh]);

  function update(key: keyof ProviderForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function announceRefresh() {
    window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
  }

  async function saveAuthority() {
    if (working) return;
    if (!csrfToken) {
      setNotice("Cloud authority requires an authenticated human profile.");
      return;
    }
    if (!apiKey.trim() && !(writing.configured && media.configured)) {
      setNotice(`Enter the ${label} API key owned by the current human profile before saving authority.`);
      return;
    }
    setWorking("save");
    setNotice(`Saving ${label} authority without running a paid request…`);
    try {
      await json<AuthorityResponse>("/api/cloud-story-mode/provider", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": csrfToken },
        body: JSON.stringify({ provider, ...form, apiKey }),
      });
      setApiKey("");
      setNotice(`${label} authority is saved in protected storage for ${profileName || "the current human profile"}. No provider generation was run and no paid route was activated.`);
      await refresh();
      announceRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `${label} authority could not be saved.`);
    } finally {
      setWorking("");
    }
  }

  function requirePaidTest() {
    if (paidAcknowledged) return true;
    setNotice(`Confirm that a ${label} test can use the user-owned provider account and may incur provider charges.`);
    return false;
  }

  async function testWriting() {
    if (working || !writing.configured || !requirePaidTest()) return;
    setWorking("writing");
    setNotice(`Testing ${label} writing with the saved authority…`);
    try {
      await json<TestResponse>("/api/writing-assistant/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      setNotice(`${label} writing returned a successful response.`);
      await refresh();
      announceRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `${label} writing test failed.`);
    } finally {
      setWorking("");
    }
  }

  async function testImage() {
    if (working || !media.configured || !requirePaidTest()) return;
    setWorking("image");
    setNotice(`Testing ${label} image generation with the saved authority…`);
    try {
      await json<TestResponse>("/api/media-routing/test/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: provider, billingAcknowledged: true }),
      });
      setNotice(`${label} image generation returned a verified asset to PlotPickle.`);
      await refresh();
      announceRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `${label} image test failed.`);
    } finally {
      setWorking("");
    }
  }

  async function pollMiniMaxVideo(id: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      const job = await json<TestResponse>(`/api/local-ai/video/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (job.status === "succeeded") return job;
      if (job.status === "failed" || job.status === "cancelled" || job.status === "expired") throw new Error(job.error || "The MiniMax video test did not complete successfully.");
    }
    throw new Error("The MiniMax video test is still running. Leave PlotPickle open and check again shortly.");
  }

  async function testVideo() {
    if (provider !== "minimax" || working || !media.configured || !requirePaidTest()) return;
    if (!dataSharingAcknowledged) {
      setNotice("Confirm that the video test prompt may leave this computer before running the MiniMax H3 test.");
      return;
    }
    setWorking("video");
    setNotice("Starting a paid MiniMax H3 verification job…");
    try {
      const started = await json<TestResponse>("/api/media-routing/test/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: "minimax-direct", billingAcknowledged: true, dataSharingAcknowledged: true }),
      });
      if (!started.id) throw new Error("MiniMax returned no video job ID.");
      await pollMiniMaxVideo(started.id);
      setNotice("MiniMax H3 video generation completed and returned a verified local asset.");
      await refresh();
      announceRefresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "MiniMax H3 video test failed.");
    } finally {
      setWorking("");
    }
  }

  return (
    <section style={panel} data-cloud-story-provider={provider} aria-labelledby={`cloud-story-${provider}-title`}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "var(--pp-skin-space-3)", alignItems: "start", flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>CLOUD STORY MODE / PROVIDER AUTHORITY</p>
          <h2 id={`cloud-story-${provider}-title`} style={{ margin: "5px 0" }}>{label}</h2>
          <p style={{ margin: 0, color: "var(--pp-skin-ink-soft)", maxWidth: 760 }}>{preset?.description}</p>
        </div>
        <strong style={{ color: writing.configured && media.configured ? "var(--pp-skin-accent-bright)" : "var(--pp-skin-ink-muted)" }}>{writing.configured && media.configured ? "AUTHORITY SAVED" : "SETUP REQUIRED"}</strong>
      </header>

      <div style={{ ...grid, marginTop: "var(--pp-skin-space-4)" }}>
        <label style={field}><span>API key</span><input style={input} type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={writing.configured && media.configured ? "Leave blank to keep protected key" : `Enter ${label} API key`} /></label>
        <label style={field}><span>Provider API address</span><input style={input} value={form.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} spellCheck={false} /></label>
        <label style={field}><span>Writing model</span><input style={input} value={form.textModel} onChange={(event) => update("textModel", event.target.value)} spellCheck={false} /></label>
        <label style={field}><span>Image model</span><input style={input} value={form.imageModel} onChange={(event) => update("imageModel", event.target.value)} spellCheck={false} /></label>
        <label style={field}><span>Video model</span><input style={input} value={form.videoModel} onChange={(event) => update("videoModel", event.target.value)} spellCheck={false} /></label>
      </div>

      <div style={{ marginTop: "var(--pp-skin-space-4)", padding: "var(--pp-skin-space-3)", border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)", background: "var(--pp-skin-surface-0)" }}>
        <strong>AUTHORITY</strong>
        <p style={{ margin: "6px 0 0", color: "var(--pp-skin-ink-soft)" }}>Owner: {profileName || "Checking current human profile"}. The secret is kept outside the PPF and is never rendered back to this screen.</p>
      </div>

      <div style={{ display: "flex", gap: "var(--pp-skin-space-2)", flexWrap: "wrap", marginTop: "var(--pp-skin-space-4)" }}>
        <button type="button" style={button} onClick={() => void saveAuthority()} disabled={Boolean(working)}>{working === "save" ? "SAVING..." : "SAVE PROVIDER AUTHORITY"}</button>
        <button type="button" style={button} onClick={() => void refresh()} disabled={Boolean(working)}>REFRESH STATUS</button>
      </div>

      <div style={{ ...grid, marginTop: "var(--pp-skin-space-4)" }}>
        <article style={{ padding: "var(--pp-skin-space-3)", border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)", background: "var(--pp-skin-surface-0)" }}><strong>WRITING</strong><p style={{ color: "var(--pp-skin-ink-soft)" }}>{writing.ready ? `Ready · ${formatDate(writing.verifiedAt)}` : writing.configured ? "Authority saved · test required" : "Authority required"}</p></article>
        <article style={{ padding: "var(--pp-skin-space-3)", border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)", background: "var(--pp-skin-surface-0)" }}><strong>IMAGES</strong><p style={{ color: "var(--pp-skin-ink-soft)" }}>{media.imageVerifiedAt ? `Ready · ${formatDate(media.imageVerifiedAt)}` : media.configured ? "Authority saved · test required" : "Authority required"}</p></article>
        <article style={{ padding: "var(--pp-skin-space-3)", border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)", background: "var(--pp-skin-surface-0)" }}><strong>VIDEO</strong><p style={{ color: "var(--pp-skin-ink-soft)" }}>{media.videoVerifiedAt ? `Ready · ${formatDate(media.videoVerifiedAt)}` : media.configured ? provider === "openai" ? `Not tested here · OpenAI video API sunset ${OPENAI_VIDEO_SUNSET}` : "Authority saved · test required" : "Authority required"}</p></article>
      </div>

      <label style={{ ...field, marginTop: "var(--pp-skin-space-4)", gridTemplateColumns: "auto 1fr", alignItems: "center" }}><input type="checkbox" checked={paidAcknowledged} onChange={(event) => setPaidAcknowledged(event.target.checked)} /><span>I understand provider tests use my account and may incur provider charges.</span></label>
      {provider === "minimax" ? <label style={{ ...field, marginTop: "var(--pp-skin-space-2)", gridTemplateColumns: "auto 1fr", alignItems: "center" }}><input type="checkbox" checked={dataSharingAcknowledged} onChange={(event) => setDataSharingAcknowledged(event.target.checked)} /><span>I approve sending the bounded video test prompt to MiniMax.</span></label> : null}

      <div style={{ display: "flex", gap: "var(--pp-skin-space-2)", flexWrap: "wrap", marginTop: "var(--pp-skin-space-3)" }}>
        <button type="button" style={button} onClick={() => void testWriting()} disabled={Boolean(working) || !writing.configured}>{working === "writing" ? "TESTING..." : "TEST WRITING"}</button>
        <button type="button" style={button} onClick={() => void testImage()} disabled={Boolean(working) || !media.configured}>{working === "image" ? "TESTING..." : "TEST IMAGE"}</button>
        {provider === "minimax" ? <button type="button" style={button} onClick={() => void testVideo()} disabled={Boolean(working) || !media.configured}>{working === "video" ? "TESTING..." : "TEST H3 VIDEO"}</button> : null}
      </div>

      <p role="status" aria-live="polite" style={{ margin: "var(--pp-skin-space-4) 0 0", padding: "var(--pp-skin-space-3)", borderTop: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)", color: "var(--pp-skin-accent-bright)" }}>{notice}</p>
    </section>
  );
}
