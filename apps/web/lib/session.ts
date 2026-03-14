import "server-only";

import { cookies } from "next/headers";

import { roleSchema, type RoleKey } from "@wms/shared";

export const sessionCookieName = "wms_session";
export const sessionCookieOptions = {
  httpOnly: true,
  maxAge: 60 * 60 * 12,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production"
};

export const routeAccessByPath = {
  "/": ["admin", "manager"],
  "/receiving": ["admin", "manager", "receiver"],
  "/inventory": ["admin", "manager"],
  "/orders": ["admin", "manager", "picker", "packer"],
  "/returns": ["admin", "manager", "receiver"]
} as const satisfies Record<string, readonly RoleKey[]>;

export type AppPath = keyof typeof routeAccessByPath;

export type DevSession = {
  kind: "dev";
  userId: string;
  email: string;
  displayName: string;
  role: RoleKey;
};

export type BearerSession = {
  kind: "bearer";
  accessToken: string;
  email: string;
  displayName: string;
  role: RoleKey;
};

export type AppSession = DevSession | BearerSession;

type JwtPayload = {
  email?: string;
  role?: string;
  sub?: string;
  app_metadata?: {
    role?: string;
  };
  user_metadata?: {
    display_name?: string;
  };
};

const roleProfiles: Record<
  RoleKey,
  {
    defaultPath: AppPath;
    displayName: string;
    email: string;
    userId: string;
  }
> = {
  admin: {
    userId: "90000000-0000-0000-0000-000000000001",
    email: "admin@local.test",
    displayName: "Local Admin",
    defaultPath: "/"
  },
  manager: {
    userId: "90000000-0000-0000-0000-000000000002",
    email: "manager@local.test",
    displayName: "Local Manager",
    defaultPath: "/"
  },
  receiver: {
    userId: "90000000-0000-0000-0000-000000000003",
    email: "receiver@local.test",
    displayName: "Local Receiver",
    defaultPath: "/receiving"
  },
  picker: {
    userId: "90000000-0000-0000-0000-000000000004",
    email: "picker@local.test",
    displayName: "Local Picker",
    defaultPath: "/orders"
  },
  packer: {
    userId: "90000000-0000-0000-0000-000000000005",
    email: "packer@local.test",
    displayName: "Local Packer",
    defaultPath: "/orders"
  }
};

export function createDevSession(role: RoleKey): DevSession {
  const profile = roleProfiles[role];

  return {
    kind: "dev",
    userId: profile.userId,
    email: profile.email,
    displayName: profile.displayName,
    role
  };
}

export function createBearerSession(accessToken: string): BearerSession {
  const payload = decodeJwtPayload(accessToken);
  const role = parseRole(payload.app_metadata?.role ?? payload.role);

  if (!role) {
    throw new Error("Access token is missing a supported application role claim.");
  }

  return {
    kind: "bearer",
    accessToken,
    email: payload.email ?? `${payload.sub ?? role}@session.local`,
    displayName: payload.user_metadata?.display_name ?? payload.email ?? `Bearer ${capitalize(role)}`,
    role
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(sessionCookieName)?.value;

  if (!raw) {
    return null;
  }

  return parseSessionCookieValue(raw);
}

export function getDefaultPathForRole(role: RoleKey): AppPath {
  return roleProfiles[role].defaultPath;
}

export function getRoleProfiles() {
  return roleProfiles;
}

export function canAccessPath(role: RoleKey, path: AppPath) {
  return (routeAccessByPath[path] as readonly RoleKey[]).includes(role);
}

export function createSessionCookieValue(session: AppSession) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

export function parseSessionCookieValue(value: string) {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;

    if (!isRecord(parsed)) {
      return null;
    }

    const role = parseRole(parsed.role);

    if (!role) {
      return null;
    }

    if (parsed.kind === "dev") {
      const userId = parseString(parsed.userId);
      const email = parseString(parsed.email);
      const displayName = parseString(parsed.displayName);

      if (!userId || !email || !displayName) {
        return null;
      }

      return {
        kind: "dev",
        userId,
        email,
        displayName,
        role
      } satisfies DevSession;
    }

    if (parsed.kind === "bearer") {
      const accessToken = parseString(parsed.accessToken);
      const email = parseString(parsed.email);
      const displayName = parseString(parsed.displayName);

      if (!accessToken || !email || !displayName) {
        return null;
      }

      return {
        kind: "bearer",
        accessToken,
        email,
        displayName,
        role
      } satisfies BearerSession;
    }

    return null;
  } catch {
    return null;
  }
}

export function buildApiAuthHeaders(session: AppSession) {
  if (session.kind === "bearer") {
    return {
      authorization: `Bearer ${session.accessToken}`
    };
  }

  return {
    "x-dev-email": session.email,
    "x-dev-role": session.role,
    "x-dev-user-id": session.userId
  };
}

export function normalizeRedirectTarget(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  if (value.startsWith("/auth/")) {
    return null;
  }

  if (value === "/sign-in") {
    return null;
  }

  if (value in routeAccessByPath) {
    return value as AppPath;
  }

  return null;
}

export function resolvePostSignInPath(role: RoleKey, redirectTarget?: string | null) {
  const normalized = normalizeRedirectTarget(redirectTarget ?? null);

  if (normalized && canAccessPath(role, normalized)) {
    return normalized;
  }

  return getDefaultPathForRole(role);
}

function decodeJwtPayload(accessToken: string) {
  const segments = accessToken.split(".");

  if (segments.length !== 3) {
    throw new Error("Access token must be a valid JWT.");
  }

  const encodedPayload = segments[1];

  if (!encodedPayload) {
    throw new Error("Access token payload is missing.");
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as JwtPayload;
  } catch {
    throw new Error("Access token payload is invalid.");
  }
}

function parseRole(value: unknown) {
  const parsed = roleSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

function parseString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
