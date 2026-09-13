"use client";

import { useEffect, useMemo, useState } from "react";
import { authenticatedProfileFetch } from "../../../core/auth/profile-request-browser";
import { CommunityStoryRoomOwnerRequests } from "../../../modules/community/story-room-directory";
import CommunityStoryRoomListing from "./community-story-room-listing";
import styles from "./community-story-room-access.module.css";

type CommunityMember = {
  pubkey: string;
  displayName: string;
  presence: string;
  updatedAt: string;
  role?: string;
  isOwner?: boolean;
};
type BuzzChannel = { id: string; name: string; description: string };
type ResolvedHuman = { pubkey: string; displayName: string; kind: "human" };
type AccessPayload = {
  ok: boolean;
  channel: BuzzChannel;
  members: CommunityMember[];
  ownerPubkey?: string;
  identity?: ResolvedHuman;
  message: string;
};

type Props = {
  readonly channel: BuzzChannel;
  readonly greatHallMembers: readonly CommunityMember[];
  readonly desktopUrl: string;
};

async function request(path: string, init?: RequestInit) {
  const response = await authenticatedProfileFetch(path, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as AccessPayload & { message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
  return body;
}

function fingerprint(pubkey: string) {
  const value = pubkey.trim();
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

export default function CommunityStoryRoomAccess({ channel, greatHallMembers, desktopUrl }: Props) {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [knownPubkey, setKnownPubkey] = useState("");
  const [buzzId, setBuzzId] = useState("");
  const [resolved, setResolved] = useState<ResolvedHuman | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const availableKnownPeople = useMemo(() => greatHallMembers.filter((person) => (
    !members.some((member) => member.pubkey.toLowerCase() === person.pubkey.toLowerCase())
  )), [greatHallMembers, members]);

  async function refresh(showNotice = false) {
    const body = await request(`/api/local-buzz/story-room-access?channel=${encodeURIComponent(channel.id)}`);
    const nextMembers = Array.isArray(body.members) ? body.members : [];
    setMembers(nextMembers);
    if (showNotice) setNotice(body.message);
    setKnownPubkey((current) => {
      const stillAvailable = current && greatHallMembers.some((person) => (
        person.pubkey === current
        && !nextMembers.some((member) => member.pubkey.toLowerCase() === person.pubkey.toLowerCase())
      ));
      if (stillAvailable) return current;
      const next = greatHallMembers.find((person) => !nextMembers.some((member) => member.pubkey.toLowerCase() === person.pubkey.toLowerCase()));
      return next?.pubkey || "";
    });
  }

  useEffect(() => {
    setMembers([]);
    setKnownPubkey("");
    setBuzzId("");
    setResolved(null);
    setNotice("");
    void refresh(false).catch((error) => setNotice(error instanceof Error ? error.message : "Story Room access could not be loaded."));
  }, [channel.id]);

  async function reviewIdentity(pubkey: string) {
    const candidate = pubkey.trim().toLowerCase();
    setResolved(null);
    setNotice("");
    setBusy("resolve");
    try {
      const body = await request(`/api/local-buzz/story-room-access/resolve?pubkey=${encodeURIComponent(candidate)}`);
      if (!body.identity) throw new Error("BUZZ did not return a verified public identity.");
      setResolved(body.identity);
      setNotice(body.message || `BUZZ ID resolved as ${body.identity.displayName}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That BUZZ ID could not be resolved.");
    } finally {
      setBusy("");
    }
  }

  async function addResolvedHuman() {
    if (!resolved) return;
    setBusy("add");
    setNotice("");
    try {
      const body = await request("/api/local-buzz/story-room-access", {
        method: "POST",
        body: JSON.stringify({ channel: channel.id, pubkey: resolved.pubkey }),
      });
      setMembers(Array.isArray(body.members) ? body.members : []);
      setResolved(null);
      setBuzzId("");
      setKnownPubkey("");
      setNotice("Access granted as a normal member after BUZZ confirmed the resulting Story Room membership.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Story Room access could not be granted.");
    } finally {
      setBusy("");
    }
  }

  async function removeMember(member: CommunityMember) {
    if (member.isOwner || member.role === "owner") return;
    setBusy(member.pubkey);
    setNotice("");
    try {
      const body = await request("/api/local-buzz/story-room-access", {
        method: "DELETE",
        body: JSON.stringify({ channel: channel.id, pubkey: member.pubkey }),
      });
      setMembers(Array.isArray(body.members) ? body.members : []);
      setNotice("Story Room access removed after BUZZ confirmed the updated membership state.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Story Room access could not be removed.");
    } finally {
      setBusy("");
    }
  }

  return <>
    <CommunityStoryRoomListing channel={channel} />
    <CommunityStoryRoomOwnerRequests channel={channel} />
    <section className={styles.card} aria-label="People with Story Room access" data-story-room-human-access="phase-2">
      <header>
        <div>
          <span>People with access</span>
          <h3>Invite a Human by verified BUZZ public identity.</h3>
          <p>Normal Human access always uses the member role. PlotPickle never asks for another person&apos;s private key, nsec, password or token.</p>
        </div>
        <button type="button" disabled={Boolean(busy)} onClick={() => void refresh(true)}>Refresh access</button>
      </header>

      <div className={styles.memberList}>
        {members.length ? members.map((member) => {
          const owner = Boolean(member.isOwner || member.role === "owner");
          return <article key={member.pubkey} data-story-room-owner={owner ? "true" : "false"}>
            <div><i data-presence={member.presence || "offline"} aria-hidden="true" /><span><strong>{member.displayName}</strong><small>{fingerprint(member.pubkey)} · {owner ? "Owner" : "Member"}</small></span></div>
            {owner ? <strong className={styles.ownerLabel}>Owner</strong> : <button type="button" disabled={Boolean(busy)} onClick={() => void removeMember(member)}>{busy === member.pubkey ? "Removing…" : "Remove"}</button>}
          </article>;
        }) : <p>No member roster was returned yet. The room owner remains the authority for this Private Story Room.</p>}
      </div>

      <div className={styles.inviteGrid}>
        <section className={styles.inviteCard} aria-label="Add known Community person">
          <span>Known Community person</span>
          <h4>Choose someone PlotPickle already knows.</h4>
          <p>Known people can come from current Community activity. Great Hall membership is not required for Story Room membership because you can also add any resolvable Human by public BUZZ ID.</p>
          <label><span>Person</span><select value={knownPubkey} onChange={(event) => { setKnownPubkey(event.target.value); setResolved(null); }} disabled={!availableKnownPeople.length || Boolean(busy)}><option value="">{availableKnownPeople.length ? "Choose person" : "No additional known people available"}</option>{availableKnownPeople.map((person) => <option key={person.pubkey} value={person.pubkey}>{person.displayName} · {fingerprint(person.pubkey)}</option>)}</select></label>
          <button type="button" disabled={!knownPubkey || Boolean(busy)} onClick={() => void reviewIdentity(knownPubkey)}>{busy === "resolve" ? "Checking…" : "Review identity"}</button>
        </section>

        <section className={styles.inviteCard} aria-label="Add by public BUZZ ID">
          <span>Add by BUZZ ID</span>
          <h4>Paste the other person&apos;s public BUZZ ID.</h4>
          <p>For now this is the 64-character hexadecimal public key. Do not paste an nsec, private key, password or auth token.</p>
          <label><span>BUZZ ID (public)</span><input value={buzzId} inputMode="text" autoComplete="off" spellCheck={false} placeholder="64-character public BUZZ key" onChange={(event) => { setBuzzId(event.target.value.trim()); setResolved(null); }} /></label>
          <button type="button" disabled={!buzzId || Boolean(busy)} onClick={() => void reviewIdentity(buzzId)}>{busy === "resolve" ? "Checking…" : "Review BUZZ ID"}</button>
        </section>
      </div>

      {resolved ? <section className={styles.identityReview} aria-label="Resolved BUZZ identity" data-story-room-resolved-human="true">
        <div><span>Verified public identity</span><h4>{resolved.displayName}</h4><p>{fingerprint(resolved.pubkey)} · Human · member access</p></div>
        <button type="button" disabled={Boolean(busy)} onClick={() => void addResolvedHuman()}>{busy === "add" ? "Adding…" : "Add person"}</button>
      </section> : null}

      {desktopUrl ? <div className={styles.desktopLink}><a href={desktopUrl}>Open this Community in Buzz Desktop</a></div> : null}
      <p className={styles.note}>BUZZ remains the membership authority. PlotPickle reports success only after BUZZ confirms the resulting channel membership. Agent access remains a separate explicit Agent/Story Bridge contract.</p>
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    </section>
  </>;
}
