import { NextResponse } from "next/server";

import { getSupabaseClient } from "../../../lib/supabase";
import {
  createBearerSession,
  createSessionCookieValue,
  resolvePostSignInPath,
  sessionCookieName,
  sessionCookieOptions
} from "../../../lib/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo");

  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return NextResponse.redirect(new URL("/sign-in?error=missing-credentials", request.url));
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });

  if (error || !data.session) {
    return NextResponse.redirect(new URL("/sign-in?error=auth-failed", request.url));
  }

  try {
    const session = createBearerSession(data.session.access_token);
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
