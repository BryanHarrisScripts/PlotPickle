/**
 * #3142: SQLite-backed single-resource ownership claim. This is an admission
 * primitive, not a worker, grant, durable queue, verifier or lease reaper.
 * Crashed attempts retain their row until independent owner reconciliation.
 * The database is inside the existing protected coding-attempt receipts root.
 */
import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, lstatSync, openSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const RESOURCE = 'authorized-coding-single-worker';
const DB = '.coding-ownership.sqlite';
const EPOCH_MARKER = '.coding-ownership-epoch.json';

const same = (left, right) => left.isFile() && !left.isSymbolicLink() &&
  left.dev === right.dev && left.ino === right.ino;

function openVerifiedDatabase(receipts, readOnly) {
  const filename = path.join(receipts, DB);
  // Do not follow a pre-existing symlink into unrelated or untrusted storage.
  try {
    if (lstatSync(filename).isSymbolicLink()) throw Error('OWNERSHIP_DB_SYMLINK');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    if (readOnly) throw Error('OWNERSHIP_DB_MISSING');
  }
  const db = new DatabaseSync(filename, { readOnly });
  try {
    const identity = lstatSync(filename);
    if (!identity.isFile() || identity.isSymbolicLink()) throw Error('OWNERSHIP_DB_UNVERIFIABLE');
    db.exec('PRAGMA busy_timeout = 3000');
    if (!readOnly) {
      db.exec('PRAGMA synchronous = FULL');
      db.exec(`CREATE TABLE IF NOT EXISTS coding_ledger_epoch (
        id INTEGER PRIMARY KEY CHECK(id = 1), epoch TEXT NOT NULL
      ) STRICT`);
      db.exec(`CREATE TABLE IF NOT EXISTS coding_resource_owner (
        resource TEXT PRIMARY KEY, grant_id TEXT NOT NULL, nonce TEXT NOT NULL,
        acquired_at INTEGER NOT NULL
      ) STRICT`);
      db.prepare('INSERT OR IGNORE INTO coding_ledger_epoch (id, epoch) VALUES (1, ?)').run(randomUUID());
    }
    const epoch = db.prepare('SELECT epoch FROM coding_ledger_epoch WHERE id = 1').get()?.epoch;
    if (typeof epoch !== 'string' || epoch.length !== 36) throw Error('OWNERSHIP_EPOCH_UNVERIFIABLE');
    // A second immutable epoch witness detects deletion/replacement of the
    // SQLite pathname. Creating a new empty DB cannot reset a prior claim.
    const markerPath = path.join(receipts, EPOCH_MARKER);
    let marker;
    try {
      const st = lstatSync(markerPath);
      if (!st.isFile() || st.isSymbolicLink()) throw Error('OWNERSHIP_MARKER_UNVERIFIABLE');
    } catch (error) {
      if (error?.code !== 'ENOENT' || readOnly) throw error;
      let fd;
      try {
        fd = openSync(markerPath, 'wx', 0o600);
        writeSync(fd, JSON.stringify({ schemaVersion: 1, epoch }) + '\n');
        fsyncSync(fd);
      } catch (creationError) {
        if (creationError?.code !== 'EEXIST') throw creationError;
      } finally { if (fd !== undefined) closeSync(fd); }
    }
    const markerIdentity = lstatSync(markerPath);
    if (!markerIdentity.isFile() || markerIdentity.isSymbolicLink())
      throw Error('OWNERSHIP_MARKER_UNVERIFIABLE');
    const markerValid = () => {
      try {
        const st = lstatSync(markerPath);
        if (!same(st, markerIdentity)) return false;
        marker = JSON.parse(readFileSync(markerPath, 'utf8'));
        return marker?.schemaVersion === 1 && marker?.epoch === epoch &&
          same(lstatSync(markerPath), markerIdentity);
      } catch { return false; }
    };
    if (!markerValid()) throw Error('OWNERSHIP_EPOCH_MARKER_MISMATCH');
    const fileValid = () => {
      const st = lstatSync(filename, { throwIfNoEntry: false });
      return Boolean(st && same(st, identity) && markerValid());
    };
    if (!fileValid()) throw Error('OWNERSHIP_DB_REPLACED');
    return { db, epoch, fileValid };
  } catch (error) { db.close(); throw error; }
}

/** Atomic unique insert and exact owner-nonce deletion across Node processes. */
export function claimCodingOwnership(receipts, grantId, acquiredAt) {
  const handle = openVerifiedDatabase(receipts, false);
  const { db, epoch, fileValid } = handle;
  const nonce = randomUUID();
  try {
    if (!fileValid()) throw Error('OWNERSHIP_DB_REPLACED');
    db.prepare(`INSERT INTO coding_resource_owner
      (resource, grant_id, nonce, acquired_at) VALUES (?, ?, ?, ?)`)
      .run(RESOURCE, grantId, nonce, acquiredAt);
    const owned = () => {
      try {
        if (!fileValid()) return false;
        const row = db.prepare('SELECT grant_id, nonce FROM coding_resource_owner WHERE resource = ?')
          .get(RESOURCE);
        return row?.grant_id === grantId && row?.nonce === nonce && fileValid();
      } catch { return false; }
    };
    return {
      epoch, nonce, owned,
      release() {
        if (!owned()) return false;
        const result = db.prepare(`DELETE FROM coding_resource_owner
          WHERE resource = ? AND grant_id = ? AND nonce = ?`)
          .run(RESOURCE, grantId, nonce);
        return result.changes === 1 && fileValid();
      },
      close() { db.close(); },
    };
  } catch (error) { db.close(); throw error; }
}

/** Only the separate publisher reads this; neither it nor a receipt grants work. */
export function codingReleaseIsReconciled(receipts, release) {
  if (!release || typeof release.ownershipEpoch !== 'string') return false;
  let handle;
  try {
    handle = openVerifiedDatabase(receipts, true);
    if (handle.epoch !== release.ownershipEpoch || !handle.fileValid() ||
        !/^[a-f0-9]{32}$/.test(release.grantId || '') ||
        !/^[a-f0-9-]{36}$/.test(release.ownershipNonce || '')) return false;
    // A claimed release must still match the original two immutable
    // hardlinks. An invented receipt or a reused nonce is not proof.
    const stem = '.coding-attempt-' + release.ownershipNonce;
    const ownerFile = path.join(receipts, stem + '.lock');
    const guardFile = path.join(receipts, stem + '.guard');
    const lockStat = lstatSync(ownerFile), guardStat = lstatSync(guardFile);
    if (!same(lockStat, guardStat) || lockStat.size > 1024) return false;
    const owner = JSON.parse(readFileSync(ownerFile, 'utf8'));
    if (owner.schemaVersion !== 1 ||
        owner.grantId !== release.grantId ||
        owner.ownerNonce !== release.ownershipNonce ||
        owner.ownershipEpoch !== release.ownershipEpoch ||
        owner.state !== 'NONREPLAYABLE_OWNER_EVIDENCE') return false;
    const row = handle.db.prepare('SELECT grant_id FROM coding_resource_owner WHERE resource = ?')
      .get(RESOURCE);
    return row?.grant_id !== release.grantId &&
      same(lstatSync(ownerFile), lockStat) &&
      same(lstatSync(guardFile), guardStat) &&
      handle.fileValid();
  } catch { return false; }
  finally { handle?.db.close(); }
}

/**
 * Owner-gated recovery of a conclusively rejected source-syntax attempt.
 * The caller MUST independently verify the exact uncommitted staged worktree,
 * absent GitHub branch/PR, exited worker process and unchanged supervisor.
 * It never replays the old grant or writes a successful coding/publish receipt.
 */
export function reconcileSyntaxRejectedOwnership(receipts, {
  grantId, sourceHead, consent, stageAndRemoteVerified,
} = {}) {
  const DENY = Object.freeze({ state: 'BLOCKED', code: 'SYNTAX_RECONCILIATION_UNVERIFIED' });
  if (!/^[a-f0-9]{32}$/.test(grantId || '') ||
      !/^[a-f0-9]{40}$/.test(sourceHead || '') ||
      consent !== 'RECONCILE_ONE_FAILED_SYNTAX_CLAIM_NO_REPLAY' ||
      stageAndRemoteVerified !== true) return DENY;
  let h;
  try {
    h = openVerifiedDatabase(receipts, false);
    if (!h.fileValid()) return DENY;
    const row = h.db.prepare('SELECT grant_id, nonce FROM coding_resource_owner WHERE resource = ?')
      .get(RESOURCE);
    if (row?.grant_id !== grantId || !/^[a-f0-9-]{36}$/.test(row.nonce || '')) return DENY;
    const stem = path.join(receipts, '.coding-attempt-' + row.nonce);
    const a = lstatSync(stem + '.lock'), b = lstatSync(stem + '.guard');
    if (!same(a,b) || a.size > 1024) return DENY;
    const owner = JSON.parse(readFileSync(stem + '.lock', 'utf8'));
    if (owner.schemaVersion !== 1 || owner.state !== 'NONREPLAYABLE_OWNER_EVIDENCE' ||
        owner.grantId !== grantId || owner.ownerNonce !== row.nonce ||
        owner.ownershipEpoch !== h.epoch) return DENY;
    const resultPath = path.join(receipts, grantId + '.result.json');
    const rs = lstatSync(resultPath);
    if (!rs.isFile() || rs.isSymbolicLink() || rs.size < 2 || rs.size > 4096) return DENY;
    const outcome = JSON.parse(readFileSync(resultPath, 'utf8'));
    if (outcome.state !== 'BLOCKED' ||
        outcome.code !== 'CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE' ||
        outcome.phase !== 'CHECK_STAGE_SYNTAX' ||
        outcome.replayAuthorized !== false) return DENY;
    const witness = Object.freeze({ schemaVersion:1, kind:'coding-resource-release',
      grantId, sourceHead, ownershipEpoch:h.epoch, ownershipNonce:row.nonce,
      state:'RECONCILED_SYNTAX_REJECTED_NO_COMMIT', phase:'CHECK_STAGE_SYNTAX',
      replayAuthorized:false, publicationAuthorized:false });
    const file = path.join(receipts, grantId + '.released.json');
    let fd;
    try {
      fd = openSync(file, 'wx', 0o600);
      writeSync(fd, JSON.stringify(witness) + '\n');
      fsyncSync(fd);
    } catch (e) {
      if (e?.code !== 'EEXIST') return DENY;
      const st = lstatSync(file);
      if (!st.isFile() || st.isSymbolicLink() || st.size > 4096) return DENY;
      const prior = JSON.parse(readFileSync(file, 'utf8'));
      if (JSON.stringify(prior) !== JSON.stringify(witness)) return DENY;
    } finally { if (fd !== undefined) closeSync(fd); }
    if (!h.fileValid() || !same(lstatSync(stem + '.lock'), a) ||
        !same(lstatSync(stem + '.guard'), b)) return DENY;
    const deleted = h.db.prepare(`DELETE FROM coding_resource_owner
      WHERE resource = ? AND grant_id = ? AND nonce = ?`)
      .run(RESOURCE, grantId, row.nonce);
    if (deleted.changes !== 1 || !h.fileValid()) return DENY;
    return Object.freeze({ state:'RECONCILED_SYNTAX_REJECTED_NO_COMMIT',
      sourceHead, grantId, retryOriginalAuthorized:false,
      publicationAuthorized:false, originalEvidencePreserved:true });
  } catch { return DENY; }
  finally { h?.db.close(); }
}
