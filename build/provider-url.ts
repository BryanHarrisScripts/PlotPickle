export function normalizedUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Use an HTTP or HTTPS server address.");
  if (url.username || url.password) throw new Error("Do not put credentials in the server address.");
  return url.toString().replace(/\/$/, "");
}
