import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname !== "/") return NextResponse.next();
  if (searchParams.get("workspace") === "1") return NextResponse.next();
  if (request.cookies.get("plotpickle-open-last")?.value === "1") return NextResponse.next();
  const welcome = request.nextUrl.clone();
  welcome.pathname = "/welcome";
  welcome.search = "";
  return NextResponse.redirect(welcome);
}

export const config = { matcher: ["/"] };
