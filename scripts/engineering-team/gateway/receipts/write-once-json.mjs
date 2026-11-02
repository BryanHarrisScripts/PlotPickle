/**
 * Private owner-local, fail-closed write-once JSON receipt.
 * No overwrite or replay, and the file is fsynced before acknowledgement.
 * Parent directory must have been separately validated and created.
 */
import { open } from 'node:fs/promises';

export async function appendPrivateJsonOnce(filename, record) {
  let handle;
  try {
    handle = await open(filename, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(record) + '\n');
    await handle.sync();
    return true;
  } catch (error) {
    // Existing, forbidden or unavailable receipt must never be overwritten.
    if (error?.code === 'EEXIST' || error?.code === 'EACCES' ||
        error?.code === 'EPERM' || error?.code === 'ENOENT')
      return false;
    throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}
