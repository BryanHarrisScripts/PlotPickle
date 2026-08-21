"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./community-buzz-social.module.css";

type CommunityMember = { readonly pubkey: string; readonly displayName: string; readonly presence: string; readonly updatedAt: string };
export type CommunitySocialTarget = {
  readonly kind: "channel" | "forum" | "dm";
  readonly id: string;
  readonly label: string;
  readonly channelId: string;
  readonly description: string;
  readonly visibility: string;
  readonly participants?: readonly string[];
};
type BuzzMessage = { readonly id: string; readonly content: string; readonly author: string; readonly createdAt: string };

type Props = {
  readonly target: CommunitySocialTarget | null;
  readonly members: readonly CommunityMember[];
  readonly canPost: boolean;
  readonly desktopUrl: string;
  readonly onOpenDm: (pubkey: string) => Promise<void>;
};

const BUZZ_API = "/api/local-buzz";

function displayTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString();
}

function chronological(messages: readonly BuzzMessage[]) {
  return [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

async function readMessages(channelId: string): Promise<BuzzMessage[]> {
  const response = await fetch(`${BUZZ_API}/messages?channel=${encodeURIComponent(channelId)}&limit=80`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const body = await response.json() as { readonly messages?: BuzzMessage[]; readonly message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
  return chronological(Array.isArray(body.messages) ? body.messages : []);
}

async function sendMessage(channelId: string, content: string) {
  const response = await fetch(`${BUZZ_API}/messages`, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ channel: channelId, content }),
  });
  const body = await response.json() as { readonly message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
}

function participantName(pubkey: string, members: readonly CommunityMember[]) {
  const member = members.find((candidate) => candidate.pubkey.toLowerCase() === pubkey.toLowerCase());
  return member?.displayName || `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`;
}

export default function CommunityBuzzSocial({ target, members, canPost, desktopUrl, onOpenDm }: Props) {
  const [messages, setMessages] = useState<BuzzMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (quiet = false) => {
    if (!target?.channelId) { setMessages([]); return; }
    try {
      const next = await readMessages(target.channelId);
      setMessages(next);
      if (!quiet) setNotice("Conversation refreshed from BUZZ.");
    } catch (error) {
      if (!quiet) setNotice(error instanceof Error ? error.message : "BUZZ conversation could not be loaded.");
    }
  }, [target?.channelId]);

  useEffect(() => {
    setDraft("");
    setNotice("");
    void refresh(true);
    if (!target?.channelId) return;
    const timer = window.setInterval(() => { void refresh(true); }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh, target?.channelId]);

  async function submit() {
    if (!target || !draft.trim() || !canPost || busy) return;
    setBusy(true);
    setNotice("Sending signed BUZZ message…");
    try {
      await sendMessage(target.channelId, draft.trim());
      setDraft("");
      await refresh(true);
      setNotice("Message accepted by BUZZ. Buzz Desktop will see the same event.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The signed BUZZ message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  if (!target) {
    return <>
      <main className={styles.conversation} aria-label="BUZZ Community conversation">
        <header className={styles.conversationHeader}><div><span>BUZZ Community</span><h2>Choose a Channel, Forum or Direct Message</h2></div><div className={styles.mirrorBadge}>ONE BUZZ HISTORY</div></header>
        <p className={styles.empty}>PlotPickle and Buzz Desktop are two clients over the same signed BUZZ conversation state. Select a destination from the Community rail.</p>
      </main>
      <aside className={styles.context} aria-label="Community details"><header className={styles.contextHeader}><div><span>Community</span><h3>Context</h3></div></header><div className={styles.contextBody}><section className={styles.contextCard}><span>Mirror contract</span><h4>Different interface. Same conversation.</h4><p>A message sent here is the same BUZZ event shown in Buzz Desktop, and messages sent in Buzz Desktop appear here after refresh.</p></section></div></aside>
    </>;
  }

  const kindLabel = target.kind === "dm" ? "Direct Message" : target.kind === "forum" ? "Forum" : "Channel";
  const participantNames = target.participants?.map((pubkey) => participantName(pubkey, members)) ?? [];

  return <>
    <main className={styles.conversation} aria-label={`${kindLabel}: ${target.label}`}>
      <header className={styles.conversationHeader}>
        <div><span>{kindLabel}</span><h2>{target.kind === "channel" ? "# " : ""}{target.label}</h2><small>{target.description}</small></div>
        <div className={styles.mirrorBadge}>BUZZ MIRROR</div>
      </header>
      <section className={styles.timeline} aria-live="polite">
        {messages.length ? messages.map((message) => <article className={styles.message} key={message.id} data-buzz-event-id={message.id}><header><strong>{message.author || "BUZZ member"}</strong><time dateTime={message.createdAt}>{displayTime(message.createdAt)}</time></header><p>{message.content}</p></article>) : <p className={styles.empty}>No messages are visible in this BUZZ conversation yet.</p>}
      </section>
      <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label htmlFor="community-buzz-composer">Contribute to {target.label}</label>
        <div className={styles.composerRow}>
          <textarea id="community-buzz-composer" value={draft} disabled={!canPost || busy} onChange={(event) => setDraft(event.target.value)} placeholder={canPost ? "Write a thought, question or reply…" : "Connect your Human BUZZ identity in Profile to contribute."} />
          <button type="submit" disabled={!canPost || !draft.trim() || busy}>{busy ? "Sending…" : "Send"}</button>
        </div>
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      </form>
    </main>

    <aside className={styles.context} aria-label={`${target.label} details`}>
      <header className={styles.contextHeader}><div><span>{kindLabel} settings</span><h3>{target.label}</h3></div></header>
      <div className={styles.contextBody}>
        <section className={styles.contextCard}><span>Details</span><h4>{kindLabel}</h4><p>{target.visibility || (target.kind === "dm" ? "Participants only" : "BUZZ governed")}</p><small>Conversation ID: {target.channelId}</small></section>
        {target.kind === "dm" ? <section className={styles.contextCard}><span>Participants</span><h4>{participantNames.length || target.participants?.length || 0} participants</h4><p>{participantNames.join(" · ") || "BUZZ controls DM membership."}</p><small>PlotPickle does not describe this DM as end-to-end encrypted unless BUZZ provides that property.</small></section> : <section className={styles.contextCard}><span>Members</span><h4>{members.length} Great Hall members</h4><div className={styles.memberList}>{members.slice(0, 8).map((member) => <div className={styles.memberRow} key={member.pubkey}><div><strong>{member.displayName}</strong><small>{member.presence || "offline"}</small></div><button type="button" disabled={!canPost} onClick={() => void onOpenDm(member.pubkey)}>Message</button></div>)}</div></section>}
        <section className={styles.contextCard} data-native-buzz-huddle="desktop">
          <span>Huddle</span><h4>Native BUZZ voice</h4><p>BUZZ Huddles use the native Tauri/Rust audio owner and WebSocket Opus relay. PlotPickle opens the same Community in Buzz Desktop instead of inventing a second voice stack or fake connected state.</p>
          {desktopUrl ? <a href={desktopUrl}>Open Huddle in Buzz Desktop</a> : <button type="button" disabled>Buzz Desktop setup required</button>}
          <small>Text remains usable if voice is unavailable. Recording is not enabled here.</small>
        </section>
      </div>
    </aside>
  </>;
}
