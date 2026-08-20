"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUZZ_GUILDHALL_ACTORS, BUZZ_GUILDHALL_CHANNELS } from "../lib/buzz-guildhall";
import {
  COMMUNITY_VISIBLE_STORY_ROOMS,
  humanBuzzFingerprint,
  type ActiveBbsRoom,
  type BuzzStoryRoomId,
  type HumanBuzzIdentity,
} from "../lib/buzz-story-room";
import styles from "./community-backdoor-terminal.module.css";

type TerminalMode = "home" | "who" | "agents" | "boards" | "talk" | "reviews" | "help";
type CommunityMember = { readonly pubkey: string; readonly displayName: string; readonly presence: string; readonly updatedAt: string };
type ActivityItem = { readonly id: string; readonly content: string; readonly author: string; readonly createdAt: string };
type GuildhallRoom = { readonly id: string; readonly name: string; readonly label: string; readonly channelId: string };
type StoryRoomRecord = { readonly roomId: BuzzStoryRoomId; readonly channel: { readonly id: string; readonly name: string; readonly description?: string } };
type ReviewItem = { readonly id: string; readonly title: string; readonly status: string; readonly roomId?: string; readonly createdAt?: string };
type BuzzMessage = { readonly id: string; readonly content: string; readonly author: string; readonly createdAt: string };
type TalkTarget =
  | { readonly key: string; readonly kind: "agent"; readonly id: string; readonly label: string; readonly detail: string; readonly channelId: string; readonly routeLabel: string }
  | { readonly key: string; readonly kind: "member"; readonly id: string; readonly label: string; readonly detail: string; readonly channelId: string; readonly routeLabel: string };

type TerminalProps = {
  readonly connected: boolean;
  readonly canPost: boolean;
  readonly nodeName: string;
  readonly humanIdentity: HumanBuzzIdentity | null;
  readonly activeRoom: ActiveBbsRoom | null;
  readonly greatHallChannelId: string;
  readonly members: readonly CommunityMember[];
  readonly recentActivity: readonly ActivityItem[];
  readonly readyGuildhallRooms: readonly GuildhallRoom[];
  readonly storyRooms: readonly StoryRoomRecord[];
  readonly reviews: readonly ReviewItem[];
  readonly desktopUrl: string;
  readonly onExit: () => void;
  readonly onNotice: (message: string) => void;
  readonly onOpenSettings: () => void;
  readonly onRefreshCommunity: () => Promise<void>;
  readonly onSelectGreatHall: () => void;
  readonly onSelectStoryRoom: (roomId: BuzzStoryRoomId) => void;
};

const BUZZ_API = "/api/local-buzz";
const COMMUNITY_BBS_ASCII = String.raw`
                         ___====-_  _-====___
                   _--^^^#####//      \\#####^^^--_
                _-^##########// (    ) \\##########^-_
               -############//  |\^^/|  \\############-
             _/############//   (@::@)   \\############\_
            /#############((     \\//     ))#############\
           -###############\\    (oo)    //###############-
          -#################\\  / VV \  //#################-
         -###################\\/      \//###################-
        _#/|##########/\######(   /\   )######/\##########|\#_
        |/ |#/\#/\#/\/  \#/\##\  ||  /##/\#/  \/\#/\#/\| \|
        '  '  '  '      '  '   \_||_/   '  '      '  '  '
                              ___/  \___
                     .=======/==========\=======.
                    /   PLOTPICKLE COMMUNITY BBS \
                   /       ROOM-FIRST TERMINAL     \
                  /__________________________________\
                  | [ HALL 1 ] [ STORY HALLS 2-6 ] |
                  |----------------------------------|
                  |         THE DOOR IS OPEN         |
                  |__________________________________|
`;

const COMMANDS: ReadonlyArray<{ key: string; label: string; detail: string; mode?: TerminalMode }> = [
  { key: "W", label: "WHO", detail: "callers online", mode: "who" },
  { key: "A", label: "AGENTS", detail: "agents & stewards", mode: "agents" },
  { key: "B", label: "BOARDS", detail: "halls & rooms", mode: "boards" },
  { key: "T", label: "TALK", detail: "open an addressed route", mode: "talk" },
  { key: "R", label: "REVIEWS", detail: "waiting decisions", mode: "reviews" },
  { key: "H", label: "HELP / HOLD", detail: "freeze auto-follow", mode: "help" },
  { key: "X", label: "EXIT", detail: "drop back to Community" },
];

function displayTime(value: string | undefined) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function editableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function chronological(messages: readonly BuzzMessage[]) {
  return [...messages].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
    return leftTime - rightTime;
  });
}

async function readMessages(channelId: string): Promise<BuzzMessage[]> {
  if (!channelId) return [];
  const response = await fetch(`${BUZZ_API}/messages?channel=${encodeURIComponent(channelId)}&limit=40`, { cache: "no-store", headers: { Accept: "application/json" } });
  const body = await response.json() as { readonly messages?: BuzzMessage[]; readonly message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
  return chronological(Array.isArray(body.messages) ? body.messages : []);
}

async function postMessage(channelId: string, content: string) {
  const response = await fetch(`${BUZZ_API}/messages`, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ channel: channelId, content }),
  });
  const body = await response.json() as { readonly message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
}

function mentionContent(content: string, currentWriter: string) {
  const normalizedWriter = currentWriter.trim().toLowerCase();
  return content.split(/(@[A-Za-z0-9._-]+)/g).map((part, index) => {
    if (!part.startsWith("@")) return <span key={`${index}-${part}`}>{part}</span>;
    const mentioned = part.slice(1).toLowerCase();
    return <mark key={`${index}-${part}`} data-mention="true" data-current-writer={normalizedWriter && mentioned === normalizedWriter ? "true" : undefined}>{part}</mark>;
  });
}

export default function CommunityBackdoorTerminal({
  connected,
  canPost,
  nodeName,
  humanIdentity,
  activeRoom,
  greatHallChannelId,
  members,
  recentActivity,
  readyGuildhallRooms,
  storyRooms,
  reviews,
  desktopUrl,
  onExit,
  onNotice,
  onOpenSettings,
  onRefreshCommunity,
  onSelectGreatHall,
  onSelectStoryRoom,
}: TerminalProps) {
  const [mode, setMode] = useState<TerminalMode>("home");
  const [halted, setHalted] = useState(false);
  const [selectedTargetKey, setSelectedTargetKey] = useState("");
  const [talkDraft, setTalkDraft] = useState("");
  const [talkMessages, setTalkMessages] = useState<BuzzMessage[]>([]);
  const [talkBusy, setTalkBusy] = useState(false);
  const [talkNotice, setTalkNotice] = useState("");
  const [roomDraft, setRoomDraft] = useState("");
  const [roomMessages, setRoomMessages] = useState<BuzzMessage[]>([]);
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomNotice, setRoomNotice] = useState("");
  const screenRef = useRef<HTMLDivElement | null>(null);
  const onlineMembers = useMemo(() => members.filter((member) => member.presence === "online"), [members]);
  const roomById = useMemo(() => new Map(readyGuildhallRooms.map((room) => [room.id, room])), [readyGuildhallRooms]);
  const callerName = humanIdentity?.displayName.trim() || "UNVERIFIED WRITER";
  const callerFingerprint = humanBuzzFingerprint(humanIdentity?.pubkey || "");

  const talkTargets = useMemo<TalkTarget[]>(() => {
    const agents = BUZZ_GUILDHALL_ACTORS.flatMap<TalkTarget>((actor) => {
      const room = roomById.get(actor.primaryChannel);
      if (!room?.channelId) return [];
      return [{ key: `agent:${actor.id}`, kind: "agent", id: actor.id, label: actor.displayName, detail: `${actor.title} · ${room.label}`, channelId: room.channelId, routeLabel: `SIGNED BUZZ HOME ROOM · ${room.label}` }];
    });
    const people = greatHallChannelId ? members.map<TalkTarget>((member) => ({
      key: `member:${member.pubkey}`, kind: "member", id: member.pubkey, label: member.displayName,
      detail: `${member.presence || "offline"} · Great Hall member`, channelId: greatHallChannelId,
      routeLabel: "ADDRESSED GREAT HALL ROUTE · SHARED, NOT 1:1 DM",
    })) : [];
    return [...agents, ...people];
  }, [greatHallChannelId, members, roomById]);
  const selectedTarget = useMemo(() => talkTargets.find((target) => target.key === selectedTargetKey) ?? null, [selectedTargetKey, talkTargets]);

  const loadTalkMessages = useCallback(async (target: TalkTarget | null) => {
    if (!target) { setTalkMessages([]); return; }
    setTalkBusy(true);
    setTalkNotice("OPENING SCRYING LINK...");
    try {
      setTalkMessages(await readMessages(target.channelId));
      setTalkNotice(`${target.routeLabel} · LINK READY`);
    } catch (error) {
      setTalkMessages([]);
      setTalkNotice(error instanceof Error ? error.message : "The BUZZ route could not be opened.");
    } finally { setTalkBusy(false); }
  }, []);

  const loadActiveStoryRoom = useCallback(async () => {
    if (!activeRoom || activeRoom.kind !== "story-room") return;
    setRoomBusy(true);
    try {
      setRoomMessages(await readMessages(activeRoom.channelId));
      setRoomNotice(`CONNECTED TO: HALL ${activeRoom.hallNumber} / ${activeRoom.roomName.toUpperCase()}`);
    } catch (error) {
      setRoomMessages([]);
      setRoomNotice(error instanceof Error ? error.message : "The active Story Room could not be loaded.");
    } finally { setRoomBusy(false); }
  }, [activeRoom]);

  useEffect(() => { void loadTalkMessages(selectedTarget); }, [loadTalkMessages, selectedTarget]);

  useEffect(() => {
    setRoomDraft("");
    if (!activeRoom) {
      setRoomMessages([]);
      setRoomNotice("SELECT A HALL TO CONNECT.");
      return;
    }
    if (activeRoom.kind === "great-hall") {
      const projected = recentActivity.map((item) => ({ id: item.id, content: item.content, author: item.author, createdAt: item.createdAt }));
      setRoomMessages(chronological(projected));
      setRoomNotice(`CONNECTED TO: HALL ${activeRoom.hallNumber} / GREAT HALL`);
      return;
    }
    void loadActiveStoryRoom();
  }, [activeRoom, loadActiveStoryRoom, recentActivity]);

  useEffect(() => {
    if (!activeRoom) return;
    const timer = window.setInterval(() => {
      if (activeRoom.kind === "great-hall") void onRefreshCommunity();
      else void loadActiveStoryRoom();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeRoom, loadActiveStoryRoom, onRefreshCommunity]);

  const runCommand = useCallback((key: string) => {
    const command = key.toUpperCase();
    if (command === "X") { onExit(); return; }
    if (command === "H") { setHalted((current) => !current); setMode("help"); return; }
    const item = COMMANDS.find((candidate) => candidate.key === command);
    if (item?.mode) setMode(item.mode);
  }, [onExit]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || editableTarget(event.target)) return;
      const key = event.key.toUpperCase();
      if (!COMMANDS.some((command) => command.key === key)) return;
      event.preventDefault();
      runCommand(key);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [runCommand]);

  useEffect(() => {
    if (halted || !screenRef.current) return;
    screenRef.current.scrollTop = screenRef.current.scrollHeight;
  }, [halted, mode, roomMessages, talkMessages]);

  async function sendRoomMessage() {
    if (!activeRoom || !roomDraft.trim() || roomBusy || !canPost) return;
    setRoomBusy(true);
    setRoomNotice("TRANSMITTING SIGNED PACKET...");
    try {
      await postMessage(activeRoom.channelId, roomDraft.trim());
      setRoomDraft("");
      if (activeRoom.kind === "great-hall") await onRefreshCommunity();
      else setRoomMessages(await readMessages(activeRoom.channelId));
      setRoomNotice(`HALL ${activeRoom.hallNumber} / ${activeRoom.roomName.toUpperCase()} · MESSAGE ACCEPTED`);
      onNotice(`Your signed message was added to ${activeRoom.roomName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The signed BUZZ message could not be sent.";
      setRoomNotice(message);
      onNotice(message);
    } finally { setRoomBusy(false); }
  }

  async function sendTalkMessage() {
    if (!selectedTarget || !talkDraft.trim() || talkBusy || !canPost) return;
    const content = `@${selectedTarget.label} ${talkDraft.trim()}`;
    setTalkBusy(true);
    setTalkNotice("TRANSMITTING SIGNED PACKET...");
    try {
      await postMessage(selectedTarget.channelId, content);
      setTalkDraft("");
      setTalkMessages(await readMessages(selectedTarget.channelId));
      setTalkNotice(`${selectedTarget.routeLabel} · MESSAGE ACCEPTED`);
      onNotice(`Terminal message addressed to ${selectedTarget.label} through ${selectedTarget.routeLabel.toLowerCase()}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The signed BUZZ message could not be sent.";
      setTalkNotice(message);
      onNotice(message);
    } finally { setTalkBusy(false); }
  }

  function modeHeading() {
    if (mode === "who") return "WHO / ACTIVE CALLERS";
    if (mode === "agents") return "AGENTS / GUILDHALL IDENTITIES";
    if (mode === "boards") return "BOARDS / STORY HALLS";
    if (mode === "talk") return "TALK / ADDRESSED ROUTER";
    if (mode === "reviews") return "REVIEWS / WRITER AUTHORITY QUEUE";
    if (mode === "help") return "HELP / KEYBOARD INCANTATIONS";
    return activeRoom ? `PLOTPICKLE COMMUNITY BBS / HALL ${activeRoom.hallNumber}: ${activeRoom.roomName.toUpperCase()}` : "PLOTPICKLE COMMUNITY BBS / SELECT A HALL";
  }

  const authLabel = canPost ? "ACCESS GRANTED" : humanIdentity?.kind === "agent" ? "IDENTITY MISMATCH" : "WRITER IDENTITY REQUIRED";

  return <main className={styles.frame} data-community-terminal="backdoor-v1" data-halted={halted ? "true" : "false"}>
    <section className={styles.crt} aria-label="PlotPickle Community BBS terminal">
      <div className={styles.scanlines} aria-hidden="true" />
      <header className={styles.boot}>
        <p>CONNECT 2400 / SCRYING LINK {connected ? "ESTABLISHED" : "STANDBY"}...</p>
        <p>AUTHENTICATING WRITER SIGIL... {authLabel}</p>
        <div className={styles.rule}>========================================================================</div>
        <h2>{activeRoom ? `PLOTPICKLE COMMUNITY BBS / HALL ${activeRoom.hallNumber}: ${activeRoom.roomName.toUpperCase()}` : "PLOTPICKLE COMMUNITY BBS"}</h2>
        <p className={styles.motto}>// Sage is who you talk to. Sage is not who you are. //</p>
        <div className={styles.rule}>========================================================================</div>
        <dl className={styles.statusLine}>
          <div><dt>NODE</dt><dd>{nodeName || "BUZZ NODE UNAVAILABLE"}</dd></div>
          <div><dt>CALLER</dt><dd>{callerName}{callerFingerprint ? <small> · {callerFingerprint}</small> : null}</dd></div>
          <div><dt>ONLINE</dt><dd>{onlineMembers.length}</dd></div>
          <div><dt>HALL</dt><dd>{activeRoom ? `${activeRoom.hallNumber}/6` : "--"}</dd></div>
          <div><dt>LINK</dt><dd>{connected ? "BUZZ LIVE" : "OFFLINE"}</dd></div>
        </dl>
      </header>

      <div className={styles.terminalGrid}>
        <div className={styles.screen} ref={screenRef} tabIndex={0}>
          <div className={styles.screenHeading}><span>{modeHeading()}</span><small>{halted ? "SCROLL HOLD" : "LIVE FOLLOW"}</small></div>

          {mode === "home" ? <div className={styles.home}>
            {!activeRoom ? <pre aria-label="PlotPickle Community BBS dragon and hall welcome banner">{COMMUNITY_BBS_ASCII}</pre> : null}
            <p className={styles.prompt}>SYS&gt; {roomNotice}</p>
            {!canPost ? <section className={styles.feed} data-human-identity-blocked="true"><h3>--- COMMUNITY IDENTITY REQUIRED ---</h3><p>{humanIdentity?.message || "Connect and verify your personal Buzz identity before posting to PlotPickle Community."}</p>{humanIdentity?.kind === "agent" ? <p className={styles.warning}>Sage is your PlotPickle guide; Sage is not your Community identity.</p> : null}<button type="button" onClick={onOpenSettings}>CONNECT / CLAIM WRITER IDENTITY</button></section> : null}
            {activeRoom ? <section className={styles.feed} aria-label={`${activeRoom.roomName} conversation`}>
              <h3>--- HALL {activeRoom.hallNumber} / {activeRoom.roomName.toUpperCase()} ---</h3>
              {roomMessages.length ? roomMessages.map((message) => { const author = message.author || "GUILD MEMBER"; return <article key={message.id}><header><strong>{author}</strong><time>{displayTime(message.createdAt)}</time></header><p>{mentionContent(message.content, callerName)}</p><footer><button type="button" aria-label={`Reply to ${author} in ${activeRoom.roomName}`} onClick={() => setRoomDraft((current) => current || `@${author} `)}>REPLY</button></footer></article>; }) : <p className={styles.dim}>{roomBusy ? "READING SIGNED TRAFFIC..." : "NO TRAFFIC DETECTED."}</p>}
              <label><span>MESSAGE TO HALL {activeRoom.hallNumber} / {activeRoom.roomName.toUpperCase()}</span><textarea value={roomDraft} onChange={(event) => setRoomDraft(event.target.value)} onKeyDown={(event) => { if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return; event.preventDefault(); void sendRoomMessage(); }} rows={4} maxLength={8000} placeholder={canPost ? `Write to ${activeRoom.roomName}…` : "Connect your writer identity to post…"} disabled={!canPost} /></label>
              <button type="button" disabled={!canPost || !roomDraft.trim() || roomBusy} onClick={() => void sendRoomMessage()}>{roomBusy ? "TRANSMITTING..." : "[ENTER] SEND SIGNED MESSAGE"}</button>
            </section> : <p className={styles.dim}>SELECT HALL 1-6 FROM STORY ROOMS OR BOARDS.</p>}
          </div> : null}

          {mode === "who" ? <section className={styles.tableView}><p className={styles.prompt}>WHO&gt; ENUMERATING REAL COMMUNITY MEMBERS...</p><div className={styles.asciiTable} role="table" aria-label="Community members"><div className={styles.tableHeader} role="row"><span>CALLER</span><span>STATE</span><span>LAST SIGNAL</span></div>{members.length ? members.map((member) => <div key={member.pubkey} className={styles.tableRow} role="row"><strong>{member.displayName}</strong><span data-presence={member.presence}>{member.presence || "offline"}</span><span>{displayTime(member.updatedAt)}</span></div>) : <p className={styles.dim}>NO MEMBER RECORDS RETURNED.</p>}</div></section> : null}

          {mode === "agents" ? <section className={styles.tableView}><p className={styles.prompt}>AGENT&gt; READING GUILDHALL DIRECTORY...</p><div className={styles.agentList}>{BUZZ_GUILDHALL_ACTORS.map((actor) => { const room = roomById.get(actor.primaryChannel); return <article key={actor.id}><header><strong>{actor.displayName}</strong><span>{actor.title}</span></header><p>{actor.summary}</p><footer>{actor.runtime.toUpperCase()} · {room?.label || actor.primaryChannel} · {actor.buzzPresence}</footer></article>; })}</div></section> : null}

          {mode === "boards" ? <section className={styles.tableView}><p className={styles.prompt}>BOARD&gt; HALL 1 IS THE HUMAN GREAT HALL. HALLS 2-6 ARE STORY ROOMS.</p><div className={styles.boardList}><button type="button" onClick={onSelectGreatHall} disabled={!greatHallChannelId}><strong>HALL 1 · GREAT HALL</strong><span>{greatHallChannelId ? "ONLINE" : "UNAVAILABLE"}</span></button>{COMMUNITY_VISIBLE_STORY_ROOMS.map((definition) => { const room = storyRooms.find((candidate) => candidate.roomId === definition.id); return <button key={definition.id} type="button" disabled={!room} onClick={() => onSelectStoryRoom(definition.id)}><strong>HALL {definition.hallNumber} · {definition.label}</strong><span>{room ? "STORY ROOM" : "NOT CREATED"}</span></button>; })}<h3>--- GUILDHALL / AGENT ROUTES ---</h3>{BUZZ_GUILDHALL_CHANNELS.filter((channel) => channel.id !== "great-hall").map((channel) => { const ready = roomById.has(channel.id); return <article key={channel.id} data-ready={ready ? "true" : "false"}><header><strong>{channel.label}</strong><span>{ready ? "ONLINE" : "UNAVAILABLE"}</span></header><p>{channel.description}</p></article>; })}</div></section> : null}

          {mode === "talk" ? <section className={styles.talkView}><p className={styles.prompt}>TALK&gt; CHOOSE A REAL PLOTPICKLE IDENTITY.</p><div className={styles.talkLayout}><div className={styles.targetList} aria-label="Talk targets"><h3>AGENTS / PEOPLE</h3>{talkTargets.map((target) => <button key={target.key} type="button" data-selected={selectedTargetKey === target.key ? "true" : "false"} onClick={() => setSelectedTargetKey(target.key)}><strong>{target.label}</strong><small>{target.detail}</small></button>)}</div><div className={styles.directLine}>{selectedTarget ? <><header><div><span>ADDRESSED ROUTE</span><strong>{selectedTarget.label}</strong></div><small>{selectedTarget.routeLabel}</small></header><div className={styles.directMessages} aria-live="polite">{talkMessages.length ? talkMessages.map((message) => <article key={message.id}><header><strong>{message.author || "UNKNOWN"}</strong><time>{displayTime(message.createdAt)}</time></header><p>{mentionContent(message.content, callerName)}</p></article>) : <p className={styles.dim}>{talkBusy ? "OPENING LINK..." : "NO RECENT PACKETS ON THIS ROUTE."}</p>}</div><label><span>MESSAGE TO {selectedTarget.label.toUpperCase()}</span><textarea value={talkDraft} onChange={(event) => setTalkDraft(event.target.value)} onKeyDown={(event) => { if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return; event.preventDefault(); void sendTalkMessage(); }} rows={4} maxLength={8000} placeholder={canPost ? "Type message..." : "Connect your writer identity to post…"} disabled={!canPost} /></label><button type="button" disabled={!canPost || !talkDraft.trim() || talkBusy} onClick={() => void sendTalkMessage()}>{talkBusy ? "TRANSMITTING..." : "[ENTER] SEND SIGNED PACKET"}</button><p className={styles.routeNotice}>{talkNotice || selectedTarget.routeLabel}</p></> : <p className={styles.dim}>SELECT AN IDENTITY FROM THE LEFT COLUMN TO OPEN A ROUTE.</p>}</div></div></section> : null}

          {mode === "reviews" ? <section className={styles.tableView}><p className={styles.prompt}>REVIEW&gt; READING WRITER-OWNED DECISION QUEUE...</p><div className={styles.reviewList}>{reviews.length ? reviews.map((review, index) => <article key={review.id}><span>#{String(index + 1).padStart(3, "0")}</span><div><strong>{review.title}</strong><small>{review.roomId || "COMMUNITY PROPOSAL"} · {review.status.toUpperCase()}</small></div></article>) : <p className={styles.dim}>QUEUE EMPTY. NO COMMUNITY CHANGE IS WAITING TO ALTER CANON.</p>}</div></section> : null}

          {mode === "help" ? <section className={styles.helpView}><p className={styles.prompt}>HELP&gt; KEYBOARD COMMAND TABLE.</p>{COMMANDS.map((command) => <p key={command.key}><kbd>[{command.key}]</kbd><strong>{command.label}</strong><span>{command.detail}</span></p>)}<p className={styles.warning}>KEYS ARE DISABLED WHILE YOU TYPE IN INPUTS, SELECTS OR TEXTAREAS. THIS TERMINAL NEVER EXECUTES OS/SHELL COMMANDS.</p><button type="button" onClick={() => setHalted((current) => !current)}>{halted ? "[H] RESUME AUTO-FOLLOW" : "[H] HOLD AUTO-FOLLOW"}</button></section> : null}
          <p className={styles.cursorLine}><span>NODE&gt;</span><i aria-hidden="true" /></p>
        </div>

        <aside className={styles.commandRail} aria-label="Terminal keyboard commands">
          <header><span>KEYBOARD</span><strong>INCANTATIONS</strong><small>single-key commands</small></header>
          {COMMANDS.map((command) => <button key={command.key} type="button" data-active={command.mode === mode ? "true" : undefined} onClick={() => runCommand(command.key)}><kbd>{command.key}</kbd><span><strong>{command.label}</strong><small>{command.detail}</small></span></button>)}
          {desktopUrl ? <a href={desktopUrl}>BUZZ DESKTOP</a> : <button type="button" onClick={onOpenSettings}>CONFIGURE BUZZ DESKTOP</button>}
          <footer><span>STATUS</span><strong>{canPost ? "WRITER VERIFIED" : connected ? "READ ONLY" : "STANDBY"}</strong><small>{halted ? "scroll hold enabled" : "auto-follow enabled"}</small></footer>
        </aside>
      </div>
    </section>
  </main>;
}
