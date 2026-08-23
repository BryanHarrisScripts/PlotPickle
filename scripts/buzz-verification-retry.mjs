export const BUZZ_VERIFY_MAX_ATTEMPTS = 3;
export const BUZZ_VERIFY_RETRY_DELAY_MS = 450;

export function transientBuzzVerificationFailure(error) {
  if (!error) return false;
  const name = String(error.name || "");
  const message = String(error.message || error).toLowerCase();
  if (name === "TimeoutError" || name === "AbortError") return true;
  if (name === "TypeError" && /fetch|network|socket|connection/.test(message)) return true;
  return /fetch failed|econnreset|econnrefused|etimedout|eai_again|socket hang up|network error/.test(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTransientBuzzRetry(operation, options = {}) {
  const attempts = Math.max(1, Math.min(5, Number(options.attempts) || BUZZ_VERIFY_MAX_ATTEMPTS));
  const delayMs = Math.max(0, Math.min(5_000, Number(options.delayMs) || BUZZ_VERIFY_RETRY_DELAY_MS));
  const sleepImpl = options.sleepImpl || sleep;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!transientBuzzVerificationFailure(error) || attempt >= attempts) throw error;
      await sleepImpl(delayMs * attempt);
    }
  }
  throw lastError;
}
