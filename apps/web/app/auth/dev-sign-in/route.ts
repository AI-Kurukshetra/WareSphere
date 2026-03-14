import { NextResponse } from "next/server";

import { roleSchema } from "@wms/shared";

import {
  createDevSession,
  createSessionCookieValue,
  resolvePostSignInPath,
  sessionCookieName,
  sessionCookieOptions
} from "../../../lib/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const requestedRole = formData.get("role");
  const redirectTo = formData.get("redirectTo");
  const parsedRole = roleSchema.safeParse(requestedRole);
  const targetUrl = new URL("/sign-in?error=invalid-role", request.url);

  if (!parsedRole.success) {
    return NextResponse.redirect(targetUrl);
  }

  const session = createDevSession(parsedRole.data);
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
}
