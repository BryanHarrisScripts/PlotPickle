const expected = process.argv[2] || process.env.GITHUB_SHA || "";
const origin = process.argv[3] || "https://plotpickle.com";
if (!expected) {
  process.stderr.write("Usage: node scripts/verify-public-site-drift.mjs <expected-sha> [origin]\n");
  process.exit(64);
}
const response = await fetch(origin.replace(/\/$/u, "") + "/source.json", { headers: { accept: "application/json" } });
if (!response.ok) throw new Error("Public provenance request failed with HTTP " + response.status);
const actual = await response.json();
if (actual.sourceCommit !== expected) {
  process.stderr.write("Public-site drift: expected " + expected + " but production reports " + String(actual.sourceCommit || "missing") + "\n");
  process.exit(1);
}
process.stdout.write("Public site matches source commit " + expected + "\n");
