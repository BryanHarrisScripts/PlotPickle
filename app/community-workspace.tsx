"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createGreatHallActiveRoom, humanBuzzFingerprint, isKnownHumanBuzzIdentity, type ActiveBbsRoom, type HumanBuzzIdentity } from "../lib/buzz-story-room";
import CommunityBackdoorTerminal from "./community-backdoor-terminal";
import CommunityBuzzSocial, { type CommunitySocialTarget } from "./community-buzz-social";
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
  const [dms, setDms] = useState<BuzzDm[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<CommunitySocialTarget | null>(null);
  const [terminalRoom, setTerminalRoom] = useState<ActiveBbsRoom | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    void refresh()
      .then(({ humanBody, guildhallBody }) => {
        if (!cancelled && humanBody.humanCommunityAllowed && guildhallBody.operational) void refreshDms();
      })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "Community status could not be loaded."); });
    return () => { cancelled = true; };
  }, [refresh, refreshDms]);

  async function setupGuildhall() {
    setBusy("setup");
    try {
      const result = await request<GuildhallStatus & { ok: true }>("/guildhall/setup", { method: "POST" });
      setGuildhall(result);
      await refresh();
      await refreshDms();
      setNotice(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The BUZZ Community rooms could not be prepared.");
    } finally {
      setBusy("");
    }
  }

  function selectRoom(room: GuildhallRoom) {
    if (room.id === "great-hall") {
      const active = createGreatHallActiveRoom(community?.greatHall);
      if (!active) { setNotice("Great Hall is not available from BUZZ yet."); return; }
      setTerminalRoom(active);
      setSelectedTarget(null);
      return;
    }
    setTerminalRoom(null);
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
    setTerminalRoom(null);
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
      const next = [body.dm, ...dms.filter((dm) => dm.id !== body.dm.id)];
      setDms(next);
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
              {channels.map((room) => <button type="button" className={navigationStyles.subDestination} key={room.channelId} data-community-room={room.id} aria-current={terminalRoom && room.id === "great-hall" ? "page" : selectedTarget?.channelId === room.channelId ? "page" : undefined} onClick={() => selectRoom(room)}><span># {room.label}</span><small>{room.id === "great-hall" ? "BBS" : "BUZZ"}</small></button>)}
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
        </nav>
      </aside>

      <div className={navigationStyles.communityContent}>
        {!connected ? <section className={styles.setupCard}><div><span>Community requires BUZZ</span><h2>Connect the Human BUZZ identity from Profile.</h2><p>PlotPickle remains fully usable without BUZZ. Live Channels, Forums, DMs, presence and Huddles stay gated until the active Human has a verified BUZZ identity.</p></div><button type="button" onClick={() => { if (!openProfileIdentity()) onOpenSettings(); }}>Open Profile</button></section>
        : !operational ? <section className={styles.setupCard}><div><span>Prepare Community rooms</span><h2>{guildhall ? `${guildhall.readyCount}/${guildhall.totalCount} BUZZ rooms ready` : "Checking BUZZ rooms"}</h2><p>PlotPickle creates only the missing native BUZZ Channels and Forums defined for the built-in Community. BUZZ remains the message and membership authority.</p></div><button type="button" disabled={!guildhall?.canSetup || busy === "setup"} onClick={() => void setupGuildhall()}>{busy === "setup" ? "Preparing…" : "Create missing BUZZ rooms"}</button></section>
        : terminalRoom ? <CommunityBackdoorTerminal
            connected={connected}
            canPost={humanCanPost}
            nodeName={community?.community || "BUZZ"}
            humanIdentity={humanIdentity}
            activeRoom={terminalRoom}
            greatHallChannelId={community?.greatHall?.id || ""}
            members={community?.members ?? []}
            recentActivity={community?.recentActivity ?? []}
            readyGuildhallRooms={guildhall?.readyRooms ?? []}
            storyRooms={[]}
            reviews={[]}
            desktopUrl={desktopUrl}
            onExit={() => setTerminalRoom(null)}
            onNotice={setNotice}
            onOpenSettings={() => { if (!openProfileIdentity()) onOpenSettings(); }}
            onRefreshCommunity={() => refresh().then(() => undefined)}
            onSelectGreatHall={() => undefined}
            onSelectStoryRoom={() => undefined}
          />
        : <CommunityBuzzSocial target={selectedTarget} members={community?.members ?? []} canPost={humanCanPost} desktopUrl={desktopUrl} onOpenDm={openDm} />}
      </div>
    </div>
  </div>;
}
