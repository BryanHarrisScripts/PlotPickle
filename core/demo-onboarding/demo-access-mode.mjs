function enabled(value) {
  return value?.trim().toLowerCase() === "true";
}

export function getDemoAccessMode(environment = process.env) {
  if (environment.PLOTPICKLE_ACCESS_MODE?.trim() !== "server-network") return "desktop-loopback";
  const bindHost = environment.PLOTPICKLE_BIND_HOST?.trim() || "";
  const externalOrigin = environment.PLOTPICKLE_EXTERNAL_ORIGIN?.trim() || "";
  const explicitlyEnabled = enabled(environment.PLOTPICKLE_SERVER_NETWORK_ENABLED);
  return bindHost && externalOrigin && explicitlyEnabled ? "server-network" : "desktop-loopback";
}

export function demoLocalDesktopAllowed(environment = process.env) {
  return getDemoAccessMode(environment) === "desktop-loopback";
}
