export function requiredCliValue(argv, flag) {
  const position = argv.indexOf(flag);
  const value = position >= 0 ? argv[position + 1] : "";
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required ${flag} argument.`);
  }
  return value;
}
