export function isPublicWebPath(pathname: string) {
  return pathname === "/site"
    || pathname === "/about"
    || pathname === "/legal"
    || pathname === "/suggest-report"
    || pathname === "/blog"
    || pathname.startsWith("/blog/");
}
