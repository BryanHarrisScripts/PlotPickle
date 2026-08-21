"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PPFProject } from "../core/project/project";
import { loadFoundationProject } from "../core/storage/foundation-project-browser";
import {
  BUZZ_STORY_ROOMS,
  COMMUNITY_VISIBLE_STORY_ROOMS,
  buzzProjectSlug,
  buzzRoomName,
  createGreatHallActiveRoom,
  createStoryActiveRoom,
  humanBuzzFingerprint,
  isKnownHumanBuzzIdentity,
  type ActiveBbsRoom,
  type BuzzStoryRoomId,
  type HumanBuzzIdentity,
} from "../lib/buzz-story-room";
import CommunityBuzzSocial, { type CommunitySocialTarget } from "../modules/community/community-buzz-social";
import CommunityAgentRoster from "./community-agent-roster";
import CommunityBackdoorTerminal from "./community-backdoor-terminal";
import CommunityStoryRoomAccess from "./community-story-room-access";
import ConnectedStudiosPanel from "./connected-studios-panel";
import navigationStyles from "./community-navigation.module.css";
import styles from "./community-workspace.module.css";

const BUZZ_API = "/api/local-buzz";
const COMMUNITY_BBS_NAME = "PlotPickle Community BBS";

type BuzzChannel = { id: string; name: string; description: string };
type CommunityMember = { pubkey: string; displayName: string; presence: string; updatedAt: string };
type ActivityItem = { id: string; content: string; author: string; createdAt: string };
type CommunityStatus = {
  configured: boolean;
  identityVerified: boolean;
  community: string;
  relayUrl: string;
  greatHall: BuzzChannel | null;
  members: CommunityMember[];
  recentActivity: ActivityItem[];
  message: string;
};
type GuildhallRoom = {
  id: string;
  name: string;
  label: string;
  channelId: string;
  type: "stream" | "forum";
  visibility: string;
  description: string;
};
type GuildhallStatus = {
  configured: boolean;
  identityVerified: boolean;
  canSetup: boolean;
  operational: boolean;
  readyCount: number;
  totalCount: number;
  readyRooms: GuildhallRoom[];
  missingRooms: Array<{ id: string; name: string; label: string }>;
  message: string;
};
type BuzzDm = { id: string; participants: string[]; createdAt: string };
type StoryRoomRecord = { roomId: BuzzStoryRoomId; channel: BuzzChannel; created?: boolean };
type UtilityView = "social" | "story-rooms" | "studios" | "agents";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BUZZ_API}${path}`, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
  return body;
}

function buzzDesktopUrl(relay: string, name: string) {
  try {
    const url = new URL(relay);
    if (!["ws:", "wss:", "http:", "https:"].includes(url.protocol)) return "";
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    url.hash = "";
    url.search = "";
    const query = new URLSearchParams({ relay: url.toString().replace(/\/$/, "") });
    if (name.trim()) query.set("name", name.trim());
    return `buzz://add-community?${query.toString()}`;
  } catch {
    return "";
  }
}

function openProfileIdentity() {
  const details = document.querySelector<HTMLDetailsElement>('[aria-label="PlotPickle Profile"] details');
  if (!details) return false;
  details.open = true;
  details.querySelector<HTMLElement>("summary")?.focus();
  return true;
}

function memberLabel(pubkey: string, members: readonly CommunityMember[]) {
  const member = members.find((candidate) => candidate.pubkey.toLowerCase() === pubkey.toLowerCase());
  return member?.displayName || `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`;
}

export default function CommunityWorkspace({ onOpenSettings }: { readonly onOpenSettings: () => void }) {
  const [community, setCommunity] = useState<CommunityStatus | null>(null);
  const [guildhall, setGuildhall] = useState<GuildhallStatus | null>(null);
  const [humanIdentity, setHumanIdentity] = useState<HumanBuzzIdentity | null>(null);
  const [project, setProject] = useState<PPFProject | null>(null);
  const [storyRooms, setStoryRooms] = useState<StoryRoomRecord[]>([]);
  const [dms, setDms] = useState<BuzzDm[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<CommunitySocialTarget | null>(null);
  const [activeRoom, setActiveRoom] = useState<ActiveBbsRoom | null>(null);
  const [utilityView, setUtilityView] = useState<UtilityView>("social");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const humanCanPost = isKnownHumanBuzzIdentity(humanIdentity);
  const callerName = humanIdentity?.displayName.trim() || "UNVERIFIED WRITER";
  const callerFingerprint = humanBuzzFingerprint(humanIdentity?.pubkey || "");
  const desktopUrl = buzzDesktopUrl(community?.relayUrl || "", community?.community || "");
  const channels = useMemo(() => (guildhall?.readyRooms ?? []).filter((room) => room.type === "stream"), [guildhall?.readyRooms]);
  const forums = useMemo(() => (guildhall?.readyRooms ?? []).filter((room) => room.type === "forum"), [guildhall?.readyRooms]);

  const refresh = useCallback(async () => {
    const [communityBody, guildhallBody, humanBody] = await Promise.all([
      request<CommunityStatus & { ok: true }>("/community/status"),
      request<GuildhallStatus & { ok: true }>("/guildhall/status"),
      request<HumanBuzzIdentity & { ok: true }>("/human-identity"),
    ]);
    setCommunity(communityBody);
    setGuildhall(guildhallBody);
    setHumanIdentity(humanBody);
    setActiveRoom((current) => current ?? createGreatHallActiveRoom(communityBody.greatHall));
    return { communityBody, guildhallBody, humanBody };
  }, []);

  const refreshDms = useCallback(async () => {
    try {
      const body = await request<{ ok: true; dms: BuzzDm[] }>("/guildhall/dms");
      setDms(Array.isArray(body.dms) ? body.dms : []);
    } catch {
      setDms([]);
    }
  }, []);

  const loadStoryRooms = useCallback(async (currentProject: PPFProject, identityVerified: boolean) => {
    if (!identityVerified) { setStoryRooms([]); return; }
    const prefix = buzzProjectSlug(currentProject);
    const body = await request<{ rooms: BuzzChannel[] }>(`/rooms?projectPrefix=${encodeURIComponent(prefix)}`);
    const mapped = body.rooms.flatMap((channel) => {
      const definition = BUZZ_STORY_ROOMS.find((room) => channel.name === buzzRoomName(currentProject, room.id));
      return definition ? [{ roomId: definition.id, channel } satisfies StoryRoomRecord] : [];
    });
    setStoryRooms(mapped);
    setActiveRoom((current) => {
      if (!current || current.kind !== "story-room") return current;
      const record = mapped.find((room) => room.roomId === current.roomId);
      return record ? createStoryActiveRoom(record.roomId, record.channel) : current;
    });
  }, []);

  useEffect(() => {
    const currentProject = loadFoundationProject();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize from the profile-owned project store
    setProject(currentProject);
    let cancelled = false;
    void refresh()
      .then(async ({ communityBody, humanBody, guildhallBody }) => {
        if (cancelled) return;
        if (humanBody.humanCommunityAllowed && guildhallBody.operational) await refreshDms();
        if (currentProject && communityBody.identityVerified) await loadStoryRooms(currentProject, true);
      })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "Community status could not be loaded."); });
    return () => { cancelled = true; };
  }, [loadStoryRooms, refresh, refreshDms]);

  async function setupGuildhall() {
    setBusy("setup");
    try {
      const result = await request<GuildhallStatus & { ok: true }>("/guildhall/setup", { method: "POST" });
      setGuildhall(result);
      const refreshed = await refresh();
      await refreshDms();
      if (project && refreshed.communityBody.identityVerified) await loadStoryRooms(project, true);
      setNotice(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The BUZZ Community rooms could not be prepared.");
    } finally {
      setBusy("");
    }
  }

  async function ensureStoryRooms() {
    if (!project) { setNotice("Open LEARN or PLAN once so PlotPickle has an active story before creating Story Rooms."); return; }
    setBusy("story-rooms");
    try {
      const body = await request<{ rooms: StoryRoomRecord[] }>("/rooms/ensure", {
        method: "POST",
        body: JSON.stringify({
          projectPrefix: buzzProjectSlug(project),
          rooms: BUZZ_STORY_ROOMS.map((room) => ({ id: room.id, name: buzzRoomName(project, room.id), description: `${project.title} · ${room.description}` })),
        }),
      });
      setStoryRooms(body.rooms);
      setNotice(`All ${body.rooms.length} compatibility-safe private Story Room channels are ready for ${project.title}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The private Story Rooms could not be prepared.");
    } finally {
      setBusy("");
    }
  }

  function openGreatHall() {
    const room = createGreatHallActiveRoom(community?.greatHall);
    if (!room) { setNotice("Great Hall is not available from BUZZ yet."); return; }
    setActiveRoom(room);
    setSelectedTarget(null);
    setUtilityView("social");
  }

  function openStoryRoom(roomId: BuzzStoryRoomId) {
    const record = storyRooms.find((room) => room.roomId === roomId);
    const room = record ? createStoryActiveRoom(record.roomId, record.channel) : null;
    if (!room) { setNotice("That Story Room has not been created yet."); return; }
    setActiveRoom(room);
    setSelectedTarget(null);
    setUtilityView("social");
  }

  function selectRoom(room: GuildhallRoom) {
    if (room.id === "great-hall") { openGreatHall(); return; }
    setActiveRoom(null);
    setUtilityView("social");
    setSelectedTarget({
      kind: room.type === "forum" ? "forum" : "channel",
      id: room.id,
      label: room.label,
      channelId: room.channelId,
      description: room.description,
      visibility: room.visibility,
    });
  }

  function selectDm(dm: BuzzDm) {
    setActiveRoom(null);
    setUtilityView("social");
    setSelectedTarget({
      kind: "dm",
      id: dm.id,
      label: dm.participants.map((pubkey) => memberLabel(pubkey, community?.members ?? [])).join(", ") || "Direct Message",
      channelId: dm.id,
      description: "Participant-scoped native BUZZ direct message.",
      visibility: "Participants only",
      participants: dm.participants,
    });
  }

  async function openDm(pubkey: string) {
    setBusy(`dm-${pubkey}`);
    try {
      const body = await request<{ ok: true; dm: BuzzDm }>("/guildhall/dms/open", {
        method: "POST",
        body: JSON.stringify({ pubkeys: [pubkey] }),
      });
      setDms([body.dm, ...dms.filter((dm) => dm.id !== body.dm.id)]);
      selectDm(body.dm);
      setNotice("Native BUZZ direct message opened. Buzz Desktop and PlotPickle share the same DM history.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The BUZZ direct message could not be opened.");
    } finally {
      setBusy("");
    }
  }

  const connected = Boolean(community?.identityVerified && humanCanPost);
  const operational = Boolean(guildhall?.operational);

  return <div className={styles.page} data-community-native-buzz="true">
    <div className={navigationStyles.communityLayout}>
      <aside className={navigationStyles.communityRail} aria-label="BUZZ Community navigation">
        <header className={navigationStyles.railHeader}><b>{COMMUNITY_BBS_NAME}</b></header>
        <div className={navigationStyles.destinationDetails} data-community-bbs-server="true">
          <small>{community?.community || "BUZZ COMMUNITY"}</small>
          <p><strong>{connected ? "HUMAN BUZZ IDENTITY VERIFIED" : "BUZZ IDENTITY REQUIRED"}</strong></p>
          <p data-community-caller="verified-human"><small>CALLER</small><br /><strong>{callerName}</strong>{callerFingerprint ? <><br /><small>{callerFingerprint}</small></> : null}</p>
          <small>{community?.message || guildhall?.message || "Checking BUZZ…"}</small>
          {!connected ? <button type="button" className={navigationStyles.destinationButton} onClick={() => { if (!openProfileIdentity()) onOpenSettings(); }}><b>Open Profile · BUZZ Identity</b></button> : null}
          {notice ? <p role="status"><small>{notice}</small></p> : null}
        </div>

        <nav className={navigationStyles.destinationList} aria-label="Channels, Forums and Direct Messages">
          <section aria-labelledby="community-channels-heading">
            <div className={navigationStyles.railHeader}><b id="community-channels-heading">Channels</b></div>
            <div className={navigationStyles.subDestinationList}>
              {channels.map((room) => <button type="button" className={navigationStyles.subDestination} key={room.channelId} data-community-room={room.id} aria-current={activeRoom?.kind === "great-hall" && room.id === "great-hall" ? "page" : selectedTarget?.channelId === room.channelId ? "page" : undefined} onClick={() => selectRoom(room)}><span># {room.label}</span><small>{room.id === "great-hall" ? "BBS" : "BUZZ"}</small></button>)}
            </div>
          </section>

          <section aria-labelledby="community-forums-heading">
            <div className={navigationStyles.railHeader}><b id="community-forums-heading">Forums</b></div>
            <div className={navigationStyles.subDestinationList}>
              {forums.map((room) => <button type="button" className={navigationStyles.subDestination} key={room.channelId} aria-current={selectedTarget?.channelId === room.channelId ? "page" : undefined} onClick={() => selectRoom(room)}><span>{room.label}</span><small>FORUM</small></button>)}
            </div>
          </section>

          <section aria-labelledby="community-dms-heading">
            <div className={navigationStyles.railHeader}><b id="community-dms-heading">Direct Messages</b></div>
            <div className={navigationStyles.subDestinationList}>
              {dms.length ? dms.map((dm) => <button type="button" className={navigationStyles.subDestination} key={dm.id} aria-current={selectedTarget?.kind === "dm" && selectedTarget.id === dm.id ? "page" : undefined} onClick={() => selectDm(dm)}><span>{dm.participants.map((pubkey) => memberLabel(pubkey, community?.members ?? [])).join(", ") || "Direct Message"}</span><small>DM</small></button>) : <p><small>No BUZZ DMs yet. Use Message beside a member.</small></p>}
            </div>
          </section>

          <section aria-labelledby="community-plotpickle-heading">
            <div className={navigationStyles.railHeader}><b id="community-plotpickle-heading">PlotPickle</b></div>
            <div className={navigationStyles.subDestinationList}>
              <button type="button" className={navigationStyles.subDestination} aria-current={utilityView === "story-rooms" ? "page" : undefined} onClick={() => { setUtilityView("story-rooms"); setSelectedTarget(null); }}><span>Private Story Rooms</span><small>{storyRooms.length}/6</small></button>
              <button type="button" className={navigationStyles.subDestination} aria-current={utilityView === "studios" ? "page" : undefined} onClick={() => { setUtilityView("studios"); setSelectedTarget(null); setActiveRoom(null); }}><span>Connected Studios</span><small>BUZZ</small></button>
              <button type="button" className={navigationStyles.subDestination} aria-current={utilityView === "agents" ? "page" : undefined} onClick={() => { setUtilityView("agents"); setSelectedTarget(null); setActiveRoom(null); }}><span>Agents &amp; Stewards</span><small>ROSTER</small></button>
            </div>
          </section>
        </nav>
      </aside>

      <div className={navigationStyles.communityContent}>
        {!connected ? <section className={styles.setupCard}><div><span>Community requires BUZZ</span><h2>Connect the Human BUZZ identity from Profile.</h2><p>PlotPickle remains fully usable without BUZZ. Live Channels, Forums, DMs, presence and Huddles stay gated until the active Human has a verified BUZZ identity.</p></div><button type="button" onClick={() => { if (!openProfileIdentity()) onOpenSettings(); }}>Open Profile</button></section>
        : !operational ? <section className={styles.setupCard}><div><span>Prepare Community rooms</span><h2>{guildhall ? `${guildhall.readyCount}/${guildhall.totalCount} BUZZ rooms ready` : "Checking BUZZ rooms"}</h2><p>PlotPickle creates only the missing native BUZZ Channels and Forums defined for the built-in Community. BUZZ remains the message and membership authority.</p></div><button type="button" disabled={!guildhall?.canSetup || busy === "setup"} onClick={() => void setupGuildhall()}>{busy === "setup" ? "Preparing…" : "Create missing BUZZ rooms"}</button></section>
        : utilityView === "studios" ? <main className={styles.stack}><ConnectedStudiosPanel onOpenGreatHall={openGreatHall} /></main>
        : utilityView === "agents" ? <main className={styles.stack}><CommunityAgentRoster /></main>
        : utilityView === "story-rooms" ? <main className={styles.stack}>
            <section className={styles.sectionHeading}><div><span>Private Story Rooms</span><h2>{project ? project.title : "Open a story to prepare its private rooms"}</h2><p>These compatibility-safe private Story Room channels remain the same BUZZ rooms used before the new Channels, Forums and DMs workspace. They are preserved rather than duplicated.</p></div><button type="button" disabled={!project || !community?.identityVerified || busy === "story-rooms"} onClick={() => void ensureStoryRooms()}>{busy === "story-rooms" ? "Preparing…" : storyRooms.length === 6 ? "Story Rooms ready" : "Create missing Story Rooms"}</button></section>
            <section className={styles.memberGrid}>{COMMUNITY_VISIBLE_STORY_ROOMS.map((definition) => { const record = storyRooms.find((room) => room.roomId === definition.id); return <article key={definition.id} data-ready={record ? "true" : "false"}><header><div><strong>Hall {definition.hallNumber} · {definition.label}</strong></div><span>{record ? "Ready" : "Not created"}</span></header><p>{definition.description}</p><button type="button" disabled={!record} onClick={() => openStoryRoom(definition.id)}>Open Hall {definition.hallNumber}</button></article>; })}</section>
            {activeRoom?.kind === "story-room" ? (() => { const record = storyRooms.find((room) => room.roomId === activeRoom.roomId); return record ? <CommunityStoryRoomAccess channel={record.channel} greatHallMembers={community?.members ?? []} desktopUrl={desktopUrl} /> : null; })() : null}
          </main>
        : activeRoom ? <CommunityBackdoorTerminal
            connected={connected}
            canPost={humanCanPost}
            nodeName={community?.community || "BUZZ"}
            humanIdentity={humanIdentity}
            activeRoom={activeRoom}
            greatHallChannelId={community?.greatHall?.id || ""}
            members={community?.members ?? []}
            recentActivity={community?.recentActivity ?? []}
            readyGuildhallRooms={guildhall?.readyRooms ?? []}
            storyRooms={storyRooms}
            reviews={[]}
            desktopUrl={desktopUrl}
            onExit={() => setActiveRoom(null)}
            onNotice={setNotice}
            onOpenSettings={() => { if (!openProfileIdentity()) onOpenSettings(); }}
            onRefreshCommunity={() => refresh().then(() => undefined)}
            onSelectGreatHall={openGreatHall}
            onSelectStoryRoom={openStoryRoom}
          />
        : <CommunityBuzzSocial target={selectedTarget} members={community?.members ?? []} canPost={humanCanPost} desktopUrl={desktopUrl} onOpenDm={openDm} />}
      </div>
    </div>
  </div>;
}
