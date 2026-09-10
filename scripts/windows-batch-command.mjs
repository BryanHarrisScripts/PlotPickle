const UNSUPPORTED_BATCH_VALUE = /[\r\n\0"&|<>^%!]/u;

function checkedBatchValue(value) {
  const text = String(value);
  if (UNSUPPORTED_BATCH_VALUE.test(text)) {
    throw new Error(`Windows batch value contains unsupported command-shell characters: ${text}`);
  }
  return text;
}

function quotedBatchValue(value) {
  return `"${checkedBatchValue(value)}"`;
}

/**
 * Build a cmd.exe invocation whose command text contains only fixed environment
 * variable references. Dynamic command paths and arguments are placed in the
 * child environment after strict metacharacter rejection, so they are not
 * concatenated into shell command text.
 *
 * Each environment value is quoted before expansion. The /c payload is then
 * passed as separate, static arguments instead of one nested quoted command
 * string. This avoids Node/cmd.exe quote-stripping edge cases while preserving
 * PATH-resolved batch names and absolute paths containing spaces.
 */
export function windowsBatchInvocation(command, args = [], environment = {}) {
  const values = [command, ...args].map(checkedBatchValue);
  const env = { ...environment };
  env.PLOTPICKLE_BATCH_COMMAND = quotedBatchValue(values[0]);

  const argumentReferences = [];
  for (let index = 1; index < values.length; index += 1) {
    const name = `PLOTPICKLE_BATCH_ARG_${index - 1}`;
    env[name] = quotedBatchValue(values[index]);
    argumentReferences.push(`%${name}%`);
  }

  return Object.freeze({
    executable: "cmd.exe",
    args: Object.freeze(["/d", "/c", "call", "%PLOTPICKLE_BATCH_COMMAND%", ...argumentReferences]),
    env,
  });
}
