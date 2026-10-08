"use client";
import { useEffect, useState } from "react";
import { authenticatedComputeFetch as fetch } from "../../core/auth/profile-request-browser";

export default function ProviderConsentSetup({ provider }: { provider: string }) {
  const [billing, setBilling] = useState(false);
  const [dataSharing, setDataSharing] = useState(false);
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let current = true;
    setBilling(false); setDataSharing(false);
    void fetch("/api/ai-routing/consent", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Unlock your profile to read provider acknowledgments.");
      const body = await response.json();
      if (current) { setBilling(body.providers?.[provider]?.billing === true); setDataSharing(body.providers?.[provider]?.dataSharing === true); }
    }).catch((error) => { if (current) setNotice(error.message); });
    return () => { current = false; };
  }, [provider]);
  async function save() {
    setWorking(true);
    try {
      const response = await fetch("/api/ai-routing/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, billing, dataSharing }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Acknowledgments could not be saved.");
      setNotice("Provider acknowledgments saved. Generation still requires confirmation at the action.");
      window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Save failed."); }
    finally { setWorking(false); }
  }
  return <section aria-label={`${provider} account acknowledgments`} style={{ padding: 12, border: "1px solid var(--pp-skin-line)", marginBottom: 12 }}>
    <p>Save the account acknowledgments used by Hybrid and generation workflows.</p>
    <label style={{ display: "block" }}><input type="checkbox" checked={billing} onChange={(event) => setBilling(event.target.checked)} /> I understand requests can charge my {provider} account.</label>
    <label style={{ display: "block" }}><input type="checkbox" checked={dataSharing} onChange={(event) => setDataSharing(event.target.checked)} /> I understand video prompts and selected reference media are sent to {provider}.</label>
    <button type="button" disabled={working} onClick={() => void save()}>Save acknowledgments</button>
    <p role="status">{notice}</p>
  </section>;
}
