import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname !== "/") return NextResponse.next();

  // Welcome remains an optional Simple Start route. The root always opens the
  // core local workspace without requiring a cookie or query flag.
  return NextResponse.next();
}

export const config = { matcher: ["/"] };
