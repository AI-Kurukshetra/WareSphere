import "server-only";

import { redirect } from "next/navigation";

import type { RoleKey } from "@wms/shared";

import { getDefaultPathForRole, getSession, type AppPath, type AppSession } from "./session";

export async function requireRouteAccess(path: AppPath, allowedRoles?: readonly RoleKey[]) {
  const session = await getSession();

  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(path)}`);
  }

  const requiredRoles = allowedRoles ?? [];

  if (requiredRoles.length > 0 && !requiredRoles.includes(session.role)) {
    redirect(getDefaultPathForRole(session.role));
  }

  return session as AppSession;
}
