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
        writeSync(fd, JSON.stringify({ schemaVersion: 1, epoch }) + '\\n');
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
      try { return same(lstatSync(filename), identity) && markerValid(); }
      catch { return false; }
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
    if (handle.epoch !== release.ownershipEpoch || !handle.fileValid()) return false;
    const row = handle.db.prepare('SELECT grant_id FROM coding_resource_owner WHERE resource = ?')
      .get(RESOURCE);
    return row?.grant_id !== release.grantId && handle.fileValid();
  } catch { return false; }
  finally { try { handle?.db.close(); } catch {} }
}
