const UNSUPPORTED_BATCH_VALUE = /[\r\n\0"&|<>^%!]/u;

function checkedBatchValue(value) {
  const text = String(value);
  if (UNSUPPORTED_BATCH_VALUE.test(text)) {
    throw new Error(`Windows batch value contains unsupported command-shell characters: ${text}`);
  }
  return text;
}

/**
 * Build a cmd.exe invocation whose command text contains only fixed environment
 * variable references. Dynamic command paths and arguments are placed in the
 * child environment after strict metacharacter rejection, so they are not
 * concatenated into shell command text.
 */
export function windowsBatchInvocation(command, args = [], environment = {}) {
  const values = [command, ...args].map(checkedBatchValue);
  const env = { ...environment };
  env.PLOTPICKLE_BATCH_COMMAND = values[0];

  const argumentReferences = [];
  for (let index = 1; index < values.length; index += 1) {
    const name = `PLOTPICKLE_BATCH_ARG_${index - 1}`;
    env[name] = values[index];
    argumentReferences.push(`"%${name}%"`);
  }

  const commandLine = [`call "%PLOTPICKLE_BATCH_COMMAND%"`, ...argumentReferences].join(" ");
  return Object.freeze({
    executable: "cmd.exe",
    args: Object.freeze(["/d", "/s", "/c", commandLine]),
    env,
  });
}
