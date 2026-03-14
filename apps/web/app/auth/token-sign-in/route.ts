import { NextResponse } from "next/server";

import {
  createBearerSession,
  createSessionCookieValue,
  resolvePostSignInPath,
  sessionCookieName,
  sessionCookieOptions
} from "../../../lib/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const accessToken = formData.get("accessToken");
  const redirectTo = formData.get("redirectTo");

  if (typeof accessToken !== "string" || accessToken.trim().length === 0) {
    return NextResponse.redirect(new URL("/sign-in?error=missing-token", request.url));
  }

  try {
    const session = createBearerSession(accessToken.trim());
    const destination = resolvePostSignInPath(
      session.role,
      typeof redirectTo === "string" ? redirectTo : null
    );
    const response = NextResponse.redirect(new URL(destination, request.url));

    response.cookies.set(
      sessionCookieName,
      createSessionCookieValue(session),
      sessionCookieOptions
    );

    return response;
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=invalid-token", request.url));
  }
}
