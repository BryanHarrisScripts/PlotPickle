import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname !== "/") return NextResponse.next();

  // Legacy remains available only when explicitly requested. Default startup
  // must enter Skin V1 before any Legacy Skin React tree can be rendered.
  if (searchParams.get("skin") === "legacy") return NextResponse.next();

  const destination = request.nextUrl.clone();
  destination.pathname = "/skin-v1";
  destination.searchParams.delete("skin");
  return NextResponse.redirect(destination);
}

export const config = { matcher: ["/"] };
