"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import AgentPortrait from "../../components/agent-portrait";
import { authenticatedProfileFetch } from "../../core/auth/profile-request-browser";
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
const COMMUNITY_ROOM_ART = {
  "great-hall": {
    src: "/assets/community-bbs/great-hall.webp",
    alt: "A pixel-art dragon curled protectively around the welcoming PlotPickle guildhall",
  },
  "story-council": {
    src: "/assets/community-bbs/story-workshop.webp",
    alt: "A pixel-art writers workshop with manuscripts, quills, books and a story map",
  },
  "wyrmwood-ring": {
    src: "/assets/community-bbs/wyrmwood.webp",
    alt: "A pixel-art Wyrmwood trial ring surrounded by ancient trees and carved stones",
  },
  marquee: {
    src: "/assets/community-bbs/marquee.webp",
    alt: "A pixel-art fantasy theatre with a glowing marquee, poster cases and stage curtains",
  },
} as const;

type CommunityRoomId = keyof typeof COMMUNITY_ROOM_ART;

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
  const response = await authenticatedProfileFetch(`${BUZZ_API}/messages?channel=${encodeURIComponent(channelId)}&limit=80`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const body = await response.json() as { readonly messages?: BuzzMessage[]; readonly message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
  return chronological(Array.isArray(body.messages) ? body.messages : []).filter((message) => !isLegacyOperationalDump(message));
}

async function sendMessage(target: CommunitySocialTarget, content: string) {
  const forum = target.kind === "forum";
  const response = await authenticatedProfileFetch(forum ? `${BUZZ_API}/community/forum-topic` : `${BUZZ_API}/messages`, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(forum
      ? { roomId: target.id, channel: target.channelId, content }
      : { channel: target.channelId, content }),
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

function isCommunityRoomId(value: string): value is CommunityRoomId {
  return value in COMMUNITY_ROOM_ART;
}

function CommunityRoomBanner({ roomId, label, memberCount, messageCount }: { readonly roomId: CommunityRoomId; readonly label: string; readonly memberCount: number; readonly messageCount: number }) {
  const artwork = COMMUNITY_ROOM_ART[roomId];
  const roomNumber = PLOTPICKLE_COMMUNITY_EXTENSIONS.rooms.findIndex((room) => room.id === roomId) + 1;
  return <section className={styles.roomBanner} aria-label={`${label} BBS`} data-community-room-art={roomId}>
    <header className={styles.roomBannerHeader}>
      <span>CONNECT 2400 / SYNCING LINE ESTABLISHED…</span>
      <small>AUTHENTICATED WRITER NODE · ACCESS GRANTED</small>
      <h1>PLOTPICKLE COMMUNITY BBS</h1>
      <p>{`// ${label.toUpperCase()} //`}</p>
      <small>ROOM {String(roomNumber).padStart(2, "0")} · MEMBERS {memberCount} · MESSAGES {messageCount}</small>
    </header>
    <div className={styles.roomArtwork}>
      <Image alt={artwork.alt} height={864} priority={roomId === "great-hall"} src={artwork.src} width={1536} />
    </div>
  </section>;
}

export default function CommunityBuzzSocial({ target, members, canPost, desktopUrl, humanPresentation, onOpenDm }: Props) {
  const [messages, setMessages] = useState<BuzzMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const loadedChannelRef = useRef("");
  const messageCountRef = useRef(0);
  const timelineEndRef = useRef<HTMLSpanElement | null>(null);

  const roomGuide = useMemo(() => target ? roomGuideFor(target.id) : null, [target]);
  const channelId = target?.channelId || "";

  const refresh = useCallback(async (quiet = false) => {
    if (!channelId) {
      loadedChannelRef.current = "";
      messageCountRef.current = 0;
      setMessages([]);
      return;
    }
    try {
      const next = await readMessages(channelId);
      const firstReadForChannel = loadedChannelRef.current !== channelId;
      const conversationAdvanced = !firstReadForChannel && next.length > messageCountRef.current;
      loadedChannelRef.current = channelId;
      messageCountRef.current = next.length;
      setMessages(next);
      if (conversationAdvanced) window.requestAnimationFrame(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        timelineEndRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "end" });
      });
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
    setNotice(target.kind === "forum" ? "Publishing signed BUZZ forum topic…" : "Sending signed BUZZ message…");
    try {
      await sendMessage(target, draft.trim());
      setDraft("");
      await refresh(true);
      setNotice(target.kind === "forum"
        ? "Forum topic published as your connected Human BUZZ identity."
        : "Message sent as your connected Human BUZZ identity.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : target.kind === "forum" ? "The BUZZ forum topic could not be published." : "The signed BUZZ message could not be sent.");
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

  const kindLabel = target.kind === "dm" ? "Direct Message" : target.kind === "forum" ? "Forum" : "Room";
  const participantNames = target.participants?.map((pubkey) => participantName(pubkey, members)) ?? [];
  const roomId = isCommunityRoomId(target.id) ? target.id : null;
  const humanName = humanPresentation?.displayName.trim() || "PlotPickle Human";
  const forum = target.kind === "forum";

  return <>
    <main className={styles.conversation} data-community-room-template={roomId ? "bbs-v1" : undefined} aria-label={`${kindLabel}: ${target.label}`}>
      <header className={styles.conversationHeader}>
        <div><span>{kindLabel}</span><h2>{target.label}</h2><small>{target.description}</small></div>
      </header>
      <section className={styles.timeline} aria-live="polite">
        {roomId ? <CommunityRoomBanner roomId={roomId} label={target.label} memberCount={members.length} messageCount={messages.length} /> : null}
        <div className={styles.timelineBody}>{messages.length ? messages.map((message) => {
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
        }) : <p className={styles.empty}>{forum ? "No topics here yet. Start with a story question, idea or draft concern." : "No conversation here yet. Start with a question, idea or update."}</p>}</div>
        <span className={styles.timelineEnd} ref={timelineEndRef} aria-hidden="true" />
      </section>
      <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label htmlFor="community-buzz-composer">{forum ? `New topic in ${target.label}` : `Message ${target.label}`}</label>
        <div className={styles.composerRow}>
          <span className={styles.prompt} aria-hidden="true">{promptHandle(humanName)}@{promptHandle(target.label)}:&gt;</span>
          <span className={styles.composerInput}>
            <textarea id="community-buzz-composer" value={draft} disabled={!canPost || busy} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} onChange={(event) => setDraft(event.target.value)} placeholder={canPost ? forum ? "Start a forum topic…" : "Type a message…" : "Connect your Human BUZZ identity in Profile to contribute."} />
            {canPost && !busy && !draft ? <span className={styles.terminalCursor} aria-hidden="true">█</span> : null}
          </span>
          <button type="submit" disabled={!canPost || !draft.trim() || busy}>{busy ? "Sending…" : forum ? "Post topic" : "Post"}</button>
        </div>
        <small className={styles.composerHint}>{forum ? "Enter to publish a topic · Shift+Enter for a new line · threaded replies and voting remain in BUZZ Desktop" : "Enter to post · Shift+Enter for a new line"}</small>
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      </form>
    </main>

    <aside className={styles.context} aria-label={`${target.label} details`}>
      <header className={styles.contextHeader}><div><span>{kindLabel}</span><h3>{target.label}</h3></div></header>
      <div className={styles.contextBody}>
        <section className={styles.contextCard}><span>Purpose</span><h4>{target.kind === "dm" ? "Private conversation" : forum ? "Community forum" : "Community room"}</h4><p>{target.description}</p></section>
        {roomGuide ? <section className={`${styles.contextCard} ${styles.contextGuide}`} aria-label={`Who helps in ${target.label}`}>
          <span>Who helps here</span>
          <div className={styles.contextHelpers}>{roomGuide.agents.map((agent) => <span className={styles.contextHelper} key={agent.id}><AgentPortrait id={agent.id} size={34} /><small>{agent.name}</small></span>)}</div>
          <span>What this room is for</span>
          <p>{roomGuide.purpose}</p>
          <small>{roomGuide.actionHint}</small>
        </section> : null}
        {target.kind === "dm" ? <section className={styles.contextCard}><span>Participants</span><h4>{participantNames.length || target.participants?.length || 0} participants</h4><p>{participantNames.join(" · ") || "BUZZ controls DM membership."}</p></section> : <section className={styles.contextCard}><span>People</span><h4>{members.length} visible Community members</h4><div className={styles.memberList}>{members.slice(0, 8).map((member) => <div className={styles.memberRow} key={member.pubkey}><CommunityAvatar label={member.displayName} imageUrl={identityKey(member.displayName) === identityKey(humanName) ? humanPresentation?.avatarUrl || member.picture : member.picture} size={38} /><div><strong>{member.displayName}</strong><small>{member.presence || "offline"}</small></div><button type="button" disabled={!canPost} onClick={() => void onOpenDm(member.pubkey)}>Message</button></div>)}</div></section>}
        <section className={styles.contextCard} data-native-buzz-huddle="desktop">
          <span>{forum ? "Forum tools" : "Voice"}</span><h4>Open in BUZZ Desktop</h4><p>{forum ? "PlotPickle publishes proper BUZZ forum topics here. Use BUZZ Desktop for threaded replies, voting and the complete native forum view." : "Use BUZZ Desktop when you want the native Huddle/voice experience. PlotPickle keeps the text conversation here simple."}</p>
          {desktopUrl ? <a href={desktopUrl}>Open BUZZ Desktop</a> : <button type="button" disabled>BUZZ Desktop setup required</button>}
        </section>
      </div>
    </aside>
  </>;
}
