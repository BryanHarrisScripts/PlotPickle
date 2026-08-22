"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AgentPortrait from "../../components/agent-portrait";
import { agentsForCommunityRoom } from "../../plugins/community-extension";
import {
  PLOTPICKLE_COMMUNITY_EXTENSIONS,
  PLOTPICKLE_PLAYHOUSE_PLUGIN,
} from "../../plugins/plotpickle-playhouse";
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

type RoomGuide = {
  readonly purpose: string;
  readonly actionHint: string;
  readonly agents: readonly { id: string; name: string }[];
};

const BUZZ_API = "/api/local-buzz";

function roomGuideFor(roomId: string): RoomGuide | null {
  const room = PLOTPICKLE_COMMUNITY_EXTENSIONS.rooms.find((candidate) => candidate.id === roomId);
  if (!room) return null;
  return {
    purpose: room.description,
    actionHint: room.actionHint,
    agents: agentsForCommunityRoom(PLOTPICKLE_COMMUNITY_EXTENSIONS, roomId).map((agent) => ({
      id: agent.profileId,
      name: agent.displayName,
    })),
  };
}

function chronological(messages: readonly BuzzMessage[]) {
  return [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

function isLegacyOperationalDump(message: BuzzMessage) {
  const content = String(message.content || "");
  return /plotpickle-live-activity:/i.test(content)
    || /\btype=[a-z0-9.-]+\s+severity=(?:info|low|medium|high|critical)\s+verified=(?:yes|no)\s+actionable=(?:yes|no)/i.test(content)
    || /\btarget=live-activity-verification\b/i.test(content);
}

async function readMessages(channelId: string): Promise<BuzzMessage[]> {
  const response = await fetch(`${BUZZ_API}/messages?channel=${encodeURIComponent(channelId)}&limit=80`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const body = await response.json() as { readonly messages?: BuzzMessage[]; readonly message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
  return chronological(Array.isArray(body.messages) ? body.messages : []).filter((message) => !isLegacyOperationalDump(message));
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

  const roomGuide = useMemo(() => target ? roomGuideFor(target.id) : null, [target]);

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
      setNotice("Message sent as your connected Human BUZZ identity.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The signed BUZZ message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  if (!target) {
    return <>
      <main className={styles.conversation} aria-label="BUZZ Community conversation">
        <header className={styles.conversationHeader}><div><span>{PLOTPICKLE_PLAYHOUSE_PLUGIN.displayName}</span><h2>Choose a room or Direct Message</h2></div></header>
        <p className={styles.empty}>Rooms are organized around what you want to do. Pick a room from the left; the Agents who help there are shown before the conversation.</p>
      </main>
      <aside className={styles.context} aria-label="Community details"><header className={styles.contextHeader}><div><span>Community</span><h3>{PLOTPICKLE_PLAYHOUSE_PLUGIN.displayName}</h3></div></header><div className={styles.contextBody}><section className={styles.contextCard}><span>Your identity</span><h4>You speak as yourself.</h4><p>Agent activity never falls back to your signer. Official Agents speak in BUZZ only through their own identities.</p></section></div></aside>
    </>;
  }

  const kindLabel = target.kind === "dm" ? "Direct Message" : "Room";
  const participantNames = target.participants?.map((pubkey) => participantName(pubkey, members)) ?? [];

  return <>
    <main className={styles.conversation} aria-label={`${kindLabel}: ${target.label}`}>
      <header className={styles.conversationHeader}>
        <div><span>{kindLabel}</span><h2>{target.label}</h2><small>{target.description}</small></div>
      </header>
      {roomGuide ? <section className={styles.roomGuide} aria-label={`Who helps in ${target.label}`}>
        <div><span>What this room is for</span><p>{roomGuide.purpose}</p><small>{roomGuide.actionHint}</small></div>
        <div className={styles.helpers}><span>Who helps here</span><div>{roomGuide.agents.map((agent) => <span className={styles.helper} key={agent.id}><AgentPortrait id={agent.id} size={34} /><small>{agent.name}</small></span>)}</div></div>
      </section> : null}
      <section className={styles.timeline} aria-live="polite">
        {messages.length ? messages.map((message) => <article className={styles.message} key={message.id} data-buzz-event-id={message.id}><header><strong>{message.author || "BUZZ member"}</strong><time dateTime={message.createdAt}>{message.createdAt}</time></header><p>{message.content}</p></article>) : <p className={styles.empty}>No conversation here yet. Start with a question, idea or update.</p>}
      </section>
      <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label htmlFor="community-buzz-composer">Message {target.label}</label>
        <div className={styles.composerRow}>
          <textarea id="community-buzz-composer" value={draft} disabled={!canPost || busy} onChange={(event) => setDraft(event.target.value)} placeholder={canPost ? "Write a thought, question or reply…" : "Connect your Human BUZZ identity in Profile to contribute."} />
          <button type="submit" disabled={!canPost || !draft.trim() || busy}>{busy ? "Sending…" : "Send"}</button>
        </div>
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      </form>
    </main>

    <aside className={styles.context} aria-label={`${target.label} details`}>
      <header className={styles.contextHeader}><div><span>{kindLabel}</span><h3>{target.label}</h3></div></header>
      <div className={styles.contextBody}>
        <section className={styles.contextCard}><span>Purpose</span><h4>{target.kind === "dm" ? "Private conversation" : "Community room"}</h4><p>{target.description}</p></section>
        {target.kind === "dm" ? <section className={styles.contextCard}><span>Participants</span><h4>{participantNames.length || target.participants?.length || 0} participants</h4><p>{participantNames.join(" · ") || "BUZZ controls DM membership."}</p></section> : <section className={styles.contextCard}><span>People</span><h4>{members.length} visible Community members</h4><div className={styles.memberList}>{members.slice(0, 8).map((member) => <div className={styles.memberRow} key={member.pubkey}><div><strong>{member.displayName}</strong><small>{member.presence || "offline"}</small></div><button type="button" disabled={!canPost} onClick={() => void onOpenDm(member.pubkey)}>Message</button></div>)}</div></section>}
        <section className={styles.contextCard} data-native-buzz-huddle="desktop">
          <span>Voice</span><h4>Open in BUZZ Desktop</h4><p>Use BUZZ Desktop when you want the native Huddle/voice experience. PlotPickle keeps the text conversation here simple.</p>
          {desktopUrl ? <a href={desktopUrl}>Open BUZZ Desktop</a> : <button type="button" disabled>BUZZ Desktop setup required</button>}
        </section>
      </div>
    </aside>
  </>;
}
