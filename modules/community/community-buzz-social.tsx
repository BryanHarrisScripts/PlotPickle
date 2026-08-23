"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import AgentPortrait from "../../components/agent-portrait";
import { agentsForCommunityRoom } from "../../lib/plugin-platform";
import {
  PLOTPICKLE_COMMUNITY_EXTENSIONS,
  PLOTPICKLE_PLAYHOUSE_PLUGIN,
} from "../../plugins/plotpickle-playhouse";
import styles from "./community-buzz-social.module.css";

type CommunityMember = { readonly pubkey: string; readonly displayName: string; readonly picture: string; readonly presence: string; readonly updatedAt: string };
type HumanPresentation = { readonly displayName: string; readonly avatarUrl: string; readonly publicBio: string };
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
  readonly humanPresentation: HumanPresentation | null;
  readonly onOpenDm: (pubkey: string) => Promise<void>;
};

type RoomGuide = {
  readonly purpose: string;
  readonly actionHint: string;
  readonly agents: readonly { id: string; name: string }[];
};

const BUZZ_API = "/api/local-buzz";
const GREAT_HALL_ASCII_CHARACTER_ART = String.raw`
        /\                 .----.                 /\
       /__\      .-.      / /\   \      .-.      /__\
      (o  o)    /___\    / /  \   \    /___\    (o  o)
      /|==|\    (o o)   /_/ /\ \___\   (o o)    /|==|\
     /_|  |_\   /|=|\      /  \       /|=|\   /_|  |_\
       /__\      / \      / /\ \       / \      /__\
                 _.._    /_/  \_\    _.._
              .-'    '-.   /\     .-'    '-.
             /  @  @    \ /  \   /    @  @  \
            |     ^      | /\ | |      ^     |
             \  '--'    / /  \ \ \    '--'  /
          ____'-.____.-'_/ /\ \_\_'-.____.-'____
         /___/\___/\____/ /  \ \____/\___/\___/\
             WIZARD        DRAGON       WAYFARER`;

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

function identityKey(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

function isPublicKey(value: string) {
  return /^[a-f0-9]{64}$/i.test(value.trim());
}

function initials(value: string) {
  const label = isPublicKey(value) ? "BUZZ member" : value.trim();
  return label.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part.slice(0, 1).toUpperCase()).join("") || "B";
}

function friendlyTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Time unavailable";
  const today = new Date();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function promptHandle(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "HUMAN";
}

function agentForAuthor(author: string) {
  const identity = identityKey(author);
  return PLOTPICKLE_COMMUNITY_EXTENSIONS.agents.find((agent) =>
    identityKey(agent.displayName) === identity
    || identityKey(agent.profileId) === identity
    || identityKey(agent.displayName).split(" ")[0] === identity,
  ) ?? null;
}

function memberForAuthor(author: string, members: readonly CommunityMember[]) {
  const identity = identityKey(author);
  return members.find((member) => identityKey(member.pubkey) === identity || identityKey(member.displayName) === identity) ?? null;
}

function CommunityAvatar({
  label,
  imageUrl = "",
  agentId = "",
  size = 46,
}: {
  readonly label: string;
  readonly imageUrl?: string;
  readonly agentId?: string;
  readonly size?: number;
}) {
  if (agentId) return <AgentPortrait id={agentId} alt={`${label} avatar`} size={size} className={styles.avatarPortrait} />;
  return <span className={styles.avatar} style={{ "--community-avatar-size": `${size}px` } as CSSProperties}>
    {imageUrl ? <Image src={imageUrl} alt={`${label} avatar`} width={size} height={size} unoptimized /> : <span aria-hidden="true">{initials(label)}</span>}
  </span>;
}

function GreatHallBanner({ memberCount, messageCount }: { readonly memberCount: number; readonly messageCount: number }) {
  return <section className={styles.greatHallBanner} aria-label="PlotPickle Great Hall BBS">
    <div className={styles.greatHallCopy}>
      <span>COMMUNITY NODE 01</span>
      <h1 aria-label="PlotPickle Great Hall">╔══ PLOTPICKLE GREAT HALL ══╗</h1>
      <p>Writers, wizards and wayfarers online</p>
      <small>MEMBERS {memberCount} · MESSAGES {messageCount}</small>
    </div>
    <pre className={styles.greatHallAscii} data-ascii-character-art="16-bit-bbs" role="img" aria-label="16-bit fantasy BBS character scene with a wizard, dragon and wayfarer">{GREAT_HALL_ASCII_CHARACTER_ART}</pre>
  </section>;
}

export default function CommunityBuzzSocial({ target, members, canPost, desktopUrl, humanPresentation, onOpenDm }: Props) {
  const [messages, setMessages] = useState<BuzzMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const roomGuide = useMemo(() => target ? roomGuideFor(target.id) : null, [target]);
  const channelId = target?.channelId || "";

  const refresh = useCallback(async (quiet = false) => {
    if (!channelId) { setMessages([]); return; }
    try {
      const next = await readMessages(channelId);
      setMessages(next);
      if (!quiet) setNotice("Conversation refreshed from BUZZ.");
    } catch (error) {
      if (!quiet) setNotice(error instanceof Error ? error.message : "BUZZ conversation could not be loaded.");
    }
  }, [channelId]);

  useEffect(() => {
    const start = window.setTimeout(() => {
      setDraft("");
      setNotice("");
      void refresh(true);
    }, 0);
    if (!channelId) return () => window.clearTimeout(start);
    const timer = window.setInterval(() => { void refresh(true); }, 5000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [channelId, refresh]);

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
  const greatHall = target.id === "great-hall";
  const humanName = humanPresentation?.displayName.trim() || "PlotPickle Human";

  return <>
    <main className={styles.conversation} data-great-hall={greatHall ? "true" : undefined} aria-label={`${kindLabel}: ${target.label}`}>
      <header className={styles.conversationHeader}>
        <div><span>{kindLabel}</span><h2>{target.label}</h2><small>{target.description}</small></div>
      </header>
      {greatHall ? <GreatHallBanner memberCount={members.length} messageCount={messages.length} /> : null}
      {roomGuide && !greatHall ? <section className={styles.roomGuide} aria-label={`Who helps in ${target.label}`}>
        <div><span>What this room is for</span><p>{roomGuide.purpose}</p><small>{roomGuide.actionHint}</small></div>
        <div className={styles.helpers}><span>Who helps here</span><div>{roomGuide.agents.map((agent) => <span className={styles.helper} key={agent.id}><AgentPortrait id={agent.id} size={34} /><small>{agent.name}</small></span>)}</div></div>
      </section> : null}
      <section className={styles.timeline} aria-live="polite">
        {messages.length ? messages.map((message) => {
          const member = memberForAuthor(message.author, members);
          const agent = agentForAuthor(member?.displayName || message.author);
          const human = identityKey(member?.displayName || message.author) === identityKey(humanName);
          const displayName = agent?.displayName || member?.displayName || (isPublicKey(message.author) ? "BUZZ member" : message.author.trim()) || "BUZZ member";
          const picture = human ? humanPresentation?.avatarUrl || member?.picture || "" : member?.picture || "";
          return <article className={styles.message} key={message.id} data-buzz-event-id={message.id}>
            <CommunityAvatar label={displayName} imageUrl={picture} agentId={agent?.profileId} />
            <div className={styles.messageBody}>
              <header><strong>{displayName}{agent ? <small>AGENT</small> : null}</strong><time dateTime={message.createdAt}>{friendlyTime(message.createdAt)}</time></header>
              <p>{message.content}</p>
            </div>
          </article>;
        }) : <p className={styles.empty}>No conversation here yet. Start with a question, idea or update.</p>}
      </section>
      <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label htmlFor="community-buzz-composer">Message {target.label}</label>
        <div className={styles.composerRow}>
          <span className={styles.prompt} aria-hidden="true">{promptHandle(humanName)}@{promptHandle(target.label)}:&gt;</span>
          <textarea id="community-buzz-composer" value={draft} disabled={!canPost || busy} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} onChange={(event) => setDraft(event.target.value)} placeholder={canPost ? "Type a message…" : "Connect your Human BUZZ identity in Profile to contribute."} />
          <button type="submit" disabled={!canPost || !draft.trim() || busy}>{busy ? "Sending…" : "Post"}</button>
        </div>
        <small className={styles.composerHint}>Enter to post · Shift+Enter for a new line</small>
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      </form>
    </main>

    <aside className={styles.context} aria-label={`${target.label} details`}>
      <header className={styles.contextHeader}><div><span>{kindLabel}</span><h3>{target.label}</h3></div></header>
      <div className={styles.contextBody}>
        <section className={styles.contextCard}><span>Purpose</span><h4>{target.kind === "dm" ? "Private conversation" : "Community room"}</h4><p>{target.description}</p></section>
        {greatHall && roomGuide ? <section className={`${styles.contextCard} ${styles.contextGuide}`} aria-label={`Who helps in ${target.label}`}>
          <span>Who helps here</span>
          <div className={styles.contextHelpers}>{roomGuide.agents.map((agent) => <span className={styles.contextHelper} key={agent.id}><AgentPortrait id={agent.id} size={34} /><small>{agent.name}</small></span>)}</div>
          <span>What this room is for</span>
          <p>{roomGuide.purpose}</p>
          <small>{roomGuide.actionHint}</small>
        </section> : null}
        {target.kind === "dm" ? <section className={styles.contextCard}><span>Participants</span><h4>{participantNames.length || target.participants?.length || 0} participants</h4><p>{participantNames.join(" · ") || "BUZZ controls DM membership."}</p></section> : <section className={styles.contextCard}><span>People</span><h4>{members.length} visible Community members</h4><div className={styles.memberList}>{members.slice(0, 8).map((member) => <div className={styles.memberRow} key={member.pubkey}><CommunityAvatar label={member.displayName} imageUrl={identityKey(member.displayName) === identityKey(humanName) ? humanPresentation?.avatarUrl || member.picture : member.picture} size={38} /><div><strong>{member.displayName}</strong><small>{member.presence || "offline"}</small></div><button type="button" disabled={!canPost} onClick={() => void onOpenDm(member.pubkey)}>Message</button></div>)}</div></section>}
        <section className={styles.contextCard} data-native-buzz-huddle="desktop">
          <span>Voice</span><h4>Open in BUZZ Desktop</h4><p>Use BUZZ Desktop when you want the native Huddle/voice experience. PlotPickle keeps the text conversation here simple.</p>
          {desktopUrl ? <a href={desktopUrl}>Open BUZZ Desktop</a> : <button type="button" disabled>BUZZ Desktop setup required</button>}
        </section>
      </div>
    </aside>
  </>;
}
