"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PPFProject } from "../core/project/project";
import { authenticatedProfileFetch } from "../core/auth/profile-request-browser";
import { loadFoundationProject } from "../core/storage/foundation-project-browser";
import { PLOTPICKLE_BUZZ_COMMUNITY } from "../lib/buzz/buzz-default-community";
import {
  BUZZ_STORY_ROOMS,
  isKnownHumanBuzzIdentity,
  type BuzzStoryRoomId,
  type HumanBuzzIdentity,
} from "../lib/buzz/buzz-story-room";
import {
  buzzLegacyStoryRoomName,
  buzzStoryRoomDisplayName,
} from "../lib/buzz/story-room-identity";
import CommunityBuzzSocial, { type CommunitySocialTarget } from "../modules/community/community-buzz-social";
import CommunityStoryRoomDirectory from "../modules/community/story-room-directory";
import { PLOTPICKLE_PLAYHOUSE_PLUGIN } from "../plugins/plotpickle-playhouse";
import CommunityAgentRoster from "./community-agent-roster";
import CommunityStoryRoomAccess from "./_components/community/community-story-room-access";
import ConnectedStudiosPanel from "./connected-studios-panel";
import navigationStyles from "./community-navigation.module.css";
import styles from "./community-workspace.module.css";

const BUZZ_API = "/api/local-buzz";
const COMMUNITY_BBS_NAME = PLOTPICKLE_BUZZ_COMMUNITY.name;
const PRIVATE_STORY_ROOM_ID: BuzzStoryRoomId = "story";
const ROOM_RAIL_DESCRIPTIONS: Readonly<Record<string, string>> = Object.freeze({
  "great-hall": "Welcome, questions & general chat",
  "story-council": "Story planning, structure & critique",
  "wyrmwood-ring": "Challenges, lessons & game discussion",
  marquee: "Posters, key art & promotion",
});

const PUBLIC_ROOMS = PLOTPICKLE_PLAYHOUSE_PLUGIN.rooms.map((room) => ({
  ...room,
  railDescription: ROOM_RAIL_DESCRIPTIONS[room.id] || room.description,
}));

type BuzzChannel = { id: string; name: string; description: string };
type CommunityMember = { pubkey: string; displayName: string; picture: string; presence: string; updatedAt: string };
type ActivityItem = { id: string; content: string; author: string; createdAt: string };
type HumanPresentation = { displayName: string; avatarUrl: string; publicBio: string };
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
type StoryRoomRecord = {
  roomId: BuzzStoryRoomId;
  displayName: string;
  channel: BuzzChannel;
  listingId: string;
  created?: boolean;
  mappedFromLegacy?: boolean;
};
type UtilityView = "social" | "directory" | "story-rooms" | "studios" | "agents";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedProfileFetch(`${BUZZ_API}${path}`, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
  return body;
}

function storyRoomIdentityBody(project: PPFProject, createMissing: boolean) {
  return {
    projectId: project.id,
    createMissing,
    rooms: BUZZ_STORY_ROOMS.map((room) => ({
      id: room.id,
      legacyName: buzzLegacyStoryRoomName(project, room.id),
      displayName: buzzStoryRoomDisplayName(project, room.id),
      description: `${project.title} · ${room.description}`,
    })),
  };
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

function socialTarget(room: GuildhallRoom, label: string, description: string): CommunitySocialTarget {
  return {
    kind: room.type === "forum" ? "forum" : "channel",
    id: room.id,
    label,
    channelId: room.channelId,
    description,
    visibility: room.visibility,
  };
}

export default function CommunityWorkspace({ onOpenSettings }: { readonly onOpenSettings: () => void }) {
  const [community, setCommunity] = useState<CommunityStatus | null>(null);
  const [guildhall, setGuildhall] = useState<GuildhallStatus | null>(null);
  const [humanIdentity, setHumanIdentity] = useState<HumanBuzzIdentity | null>(null);
  const [humanPresentation, setHumanPresentation] = useState<HumanPresentation | null>(null);
  const [project, setProject] = useState<PPFProject | null>(null);
  const [storyRooms, setStoryRooms] = useState<StoryRoomRecord[]>([]);
  const [dms, setDms] = useState<BuzzDm[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<CommunitySocialTarget | null>(null);
  const [utilityView, setUtilityView] = useState<UtilityView>("social");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const humanCanPost = isKnownHumanBuzzIdentity(humanIdentity);
  const callerName = humanIdentity?.displayName.trim() || "UNVERIFIED WRITER";
  const desktopUrl = buzzDesktopUrl(community?.relayUrl || "", community?.community || "");
  const readyRoomById = useMemo(() => new Map((guildhall?.readyRooms ?? []).map((room) => [room.id, room])), [guildhall?.readyRooms]);
  const privateStoryRoom = storyRooms.find((room) => room.roomId === PRIVATE_STORY_ROOM_ID) ?? null;

  const chooseRoom = useCallback((roomId: string) => {
    const definition = PUBLIC_ROOMS.find((room) => room.id === roomId);
    const room = definition ? readyRoomById.get(definition.id) : null;
    if (!definition || !room) {
      setNotice("That Community room is not ready yet.");
      return;
    }
    setSelectedTarget(socialTarget(room, definition.label, definition.description));
    setUtilityView("social");
  }, [readyRoomById]);

  const refresh = useCallback(async () => {
    const [communityBody, guildhallBody, humanBody, presentationBody] = await Promise.all([
      request<CommunityStatus & { ok: true }>("/community/status"),
      request<GuildhallStatus & { ok: true }>("/guildhall/status"),
      request<HumanBuzzIdentity & { ok: true }>("/human-identity"),
      fetch("/api/auth/profile-presentation", { cache: "no-store", credentials: "same-origin" })
        .then(async (response) => {
          if (!response.ok) throw new Error("The active Human presentation could not be loaded.");
          return response.json() as Promise<{ profile: HumanPresentation }>;
        })
        .catch(() => ({ profile: { displayName: "", avatarUrl: "", publicBio: "" } })),
    ]);
    setCommunity(communityBody);
    setGuildhall(guildhallBody);
    setHumanIdentity(humanBody);
    setHumanPresentation(presentationBody.profile);
    const greatHallDefinition = PUBLIC_ROOMS.find((room) => room.id === "great-hall");
    const greatHall = guildhallBody.readyRooms.find((room) => room.id === "great-hall");
    setSelectedTarget((current) => current ?? (greatHall && greatHallDefinition ? socialTarget(greatHall, greatHallDefinition.label, greatHallDefinition.description) : null));
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
    const body = await request<{ rooms: StoryRoomRecord[] }>("/story-room-identity", {
      method: "POST",
      body: JSON.stringify(storyRoomIdentityBody(currentProject, false)),
    });
    setStoryRooms(Array.isArray(body.rooms) ? body.rooms : []);
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
    if (!project) { setNotice("Open LEARN or PLAN once so PlotPickle has an active story before creating its Private Story Room."); return; }
    setBusy("story-rooms");
    try {
      const body = await request<{ rooms: StoryRoomRecord[]; message: string }>("/story-room-identity", {
        method: "POST",
        body: JSON.stringify(storyRoomIdentityBody(project, true)),
      });
      setStoryRooms(Array.isArray(body.rooms) ? body.rooms : []);
      setNotice(body.message || `Private Story Room is ready for ${project.title}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Private Story Room could not be prepared.");
    } finally {
      setBusy("");
    }
  }

  function selectDm(dm: BuzzDm) {
    setUtilityView("social");
    setSelectedTarget({
      kind: "dm",
      id: dm.id,
      label: dm.participants.map((pubkey) => memberLabel(pubkey, community?.members ?? [])).join(", ") || "Direct Message",
      channelId: dm.id,
      description: "Private BUZZ conversation between the selected participants.",
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
      setNotice("Direct Message opened in BUZZ.");
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
        <header className={navigationStyles.railHeader}><b>{community?.community || COMMUNITY_BBS_NAME}</b></header>
        <div className={navigationStyles.destinationDetails} data-community-bbs-server="true">
          <small>{connected ? "BUZZ CONNECTED" : "BUZZ IDENTITY REQUIRED"}</small>
          <div className={navigationStyles.humanIdentity} data-community-caller="verified-human">
            <span className={navigationStyles.humanAvatar}>
              {humanPresentation?.avatarUrl
                ? <Image src={humanPresentation.avatarUrl} alt={`${humanPresentation.displayName || callerName} profile avatar`} width={48} height={48} unoptimized />
                : <span aria-hidden="true">{(humanPresentation?.displayName || callerName).trim().slice(0, 1).toUpperCase() || "H"}</span>}
            </span>
            <p><strong>{humanPresentation?.displayName || callerName}</strong><br /><small>Human profile</small></p>
          </div>
          <small>{connected ? "You speak as yourself. Agents use separate identities." : community?.message || guildhall?.message || "Checking BUZZ…"}</small>
          {!connected ? <button type="button" className={navigationStyles.destinationButton} onClick={() => { if (!openProfileIdentity()) onOpenSettings(); }}><b>Open Profile · BUZZ Identity</b></button> : null}
          {notice ? <p role="status"><small>{notice}</small></p> : null}
        </div>

        <nav className={navigationStyles.destinationList} aria-label="Community rooms and Direct Messages">
          <section aria-labelledby="community-rooms-heading">
            <div className={navigationStyles.railHeader}><b id="community-rooms-heading">Rooms</b></div>
            <div className={navigationStyles.subDestinationList}>
              {PUBLIC_ROOMS.map((definition) => {
                const room = readyRoomById.get(definition.id);
                const current = selectedTarget?.id === definition.id && utilityView === "social";
                return <button type="button" className={navigationStyles.subDestination} key={definition.id} disabled={!room} aria-current={current ? "page" : undefined} onClick={() => chooseRoom(definition.id)}><span>{definition.label}</span><small>{definition.railDescription}</small></button>;
              })}
            </div>
          </section>

          <section aria-labelledby="community-discovery-heading">
            <div className={navigationStyles.railHeader}><b id="community-discovery-heading">Discover</b></div>
            <div className={navigationStyles.subDestinationList}>
              <button type="button" className={navigationStyles.subDestination} aria-current={utilityView === "directory" ? "page" : undefined} onClick={() => { setUtilityView("directory"); setSelectedTarget(null); }}><span>Story Rooms Directory</span><small>REQUEST ACCESS</small></button>
            </div>
          </section>

          <section aria-labelledby="community-dms-heading">
            <div className={navigationStyles.railHeader}><b id="community-dms-heading">Direct Messages</b></div>
            <div className={navigationStyles.subDestinationList}>
              {dms.length ? dms.map((dm) => <button type="button" className={navigationStyles.subDestination} key={dm.id} aria-current={selectedTarget?.kind === "dm" && selectedTarget.id === dm.id ? "page" : undefined} onClick={() => selectDm(dm)}><span>{dm.participants.map((pubkey) => memberLabel(pubkey, community?.members ?? [])).join(", ") || "Direct Message"}</span><small>DM</small></button>) : <p><small>No Direct Messages yet.</small></p>}
            </div>
          </section>

          <section aria-labelledby="community-plotpickle-heading">
            <div className={navigationStyles.railHeader}><b id="community-plotpickle-heading">Your PlotPickle</b></div>
            <div className={navigationStyles.subDestinationList}>
              <button type="button" className={navigationStyles.subDestination} aria-current={utilityView === "story-rooms" ? "page" : undefined} onClick={() => { setUtilityView("story-rooms"); setSelectedTarget(null); }}><span>Private Story Room</span><small>{privateStoryRoom ? "READY" : project ? "SET UP" : "NO STORY"}</small></button>
              <button type="button" className={navigationStyles.subDestination} aria-current={utilityView === "studios" ? "page" : undefined} onClick={() => { setUtilityView("studios"); setSelectedTarget(null); }}><span>Connected Studios</span><small>PEOPLE</small></button>
              <button type="button" className={navigationStyles.subDestination} aria-current={utilityView === "agents" ? "page" : undefined} onClick={() => { setUtilityView("agents"); setSelectedTarget(null); }}><span>Agents</span><small>{PLOTPICKLE_PLAYHOUSE_PLUGIN.agents.length} OFFICIAL</small></button>
            </div>
          </section>
        </nav>
      </aside>

      <div className={navigationStyles.communityContent}>
        {!connected ? <section className={styles.setupCard}><div><span>Community requires BUZZ</span><h2>Connect your BUZZ identity from Profile.</h2><p>PlotPickle remains usable without BUZZ. Community conversation turns on when the active Human has a verified BUZZ identity.</p></div><button type="button" onClick={() => { if (!openProfileIdentity()) onOpenSettings(); }}>Open Profile</button></section>
        : !operational ? <section className={styles.setupCard}><div><span>Prepare {COMMUNITY_BBS_NAME}</span><h2>{guildhall ? `${guildhall.readyCount}/${guildhall.totalCount} BUZZ rooms ready` : "Checking Community"}</h2><p>PlotPickle will prepare the missing BUZZ rooms once. The normal user view will still show only the useful Community rooms contributed by the active Community plugin.</p></div><button type="button" disabled={!guildhall?.canSetup || busy === "setup"} onClick={() => void setupGuildhall()}>{busy === "setup" ? "Preparing…" : "Prepare Community"}</button></section>
        : utilityView === "directory" ? <CommunityStoryRoomDirectory />
        : utilityView === "studios" ? <main className={styles.stack}><ConnectedStudiosPanel onOpenGreatHall={() => chooseRoom("great-hall")} /></main>
        : utilityView === "agents" ? <main className={styles.stack}><CommunityAgentRoster /></main>
        : utilityView === "story-rooms" ? <main className={styles.stack}>
            <section className={styles.sectionHeading}><div><span>Private Story Room</span><h2>{project ? (privateStoryRoom?.displayName || buzzStoryRoomDisplayName(project, PRIVATE_STORY_ROOM_ID)) : "Open a story first"}</h2><p>{project ? `${project.title} · Stable BUZZ channel identity; the normal room name never exposes the project UUID. PlotPickle keeps the older category channels underneath for compatibility.` : "One private project space for story discussion."}</p></div><button type="button" disabled={!project || !community?.identityVerified || busy === "story-rooms" || Boolean(privateStoryRoom)} onClick={() => void ensureStoryRooms()}>{busy === "story-rooms" ? "Preparing…" : privateStoryRoom ? "Ready" : "Create Private Story Room"}</button></section>
            {privateStoryRoom ? <CommunityStoryRoomAccess channel={privateStoryRoom.channel} greatHallMembers={community?.members ?? []} desktopUrl={desktopUrl} /> : <p className={styles.empty}>{project ? "Create the Private Story Room when you want a BUZZ space dedicated to this story." : "Start or open a story in LEARN or PLAN first."}</p>}
          </main>
        : <CommunityBuzzSocial target={selectedTarget} members={community?.members ?? []} canPost={humanCanPost} desktopUrl={desktopUrl} humanPresentation={humanPresentation} onOpenDm={openDm} />}
      </div>
    </div>
  </div>;
}
