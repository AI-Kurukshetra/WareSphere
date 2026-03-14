import { NextResponse } from "next/server";

import { sessionCookieName } from "../../../lib/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const redirectTo = formData.get("redirectTo");
  const destination =
    typeof redirectTo === "string" && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/sign-in";
  const response = NextResponse.redirect(new URL(destination, request.url));

  response.cookies.delete(sessionCookieName);

  return response;
}
