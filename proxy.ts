import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname !== "/") return NextResponse.next();

  // Legacy remains available only when explicitly requested. Default startup
  // must enter Skin V1 before any Legacy Skin React tree can be rendered.
  if (searchParams.get("skin") === "legacy") return NextResponse.next();

  // #2189: Block-native Write is a current profile-owned PPF workspace that
  // still lives on the root application route. Do not redirect this explicit
  // Human handoff into the Skin V1 Dashboard host, which does not own Write.
  // Keep this allowlist narrow so ordinary "/" and Dashboard startup continue
  // to enter Skin V1 before any legacy root surface can flash.
  if (searchParams.get("workspace") === "write") return NextResponse.next();

  const destination = request.nextUrl.clone();
  destination.pathname = "/skin-v1";
  destination.searchParams.delete("skin");
  return NextResponse.redirect(destination);
}

export const config = { matcher: ["/"] };
