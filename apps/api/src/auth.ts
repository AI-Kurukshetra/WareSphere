import { createHmac, createPublicKey, timingSafeEqual, verify } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";

import { getDb, roles, users } from "@wms/db";
import { roleSchema, type RoleKey } from "@wms/shared";

export type AuthenticatedActor = {
  userId: string;
  email: string;
  displayName: string;
  role: RoleKey;
  authSource: "supabase_jwt" | "dev_headers" | "injected";
};

export type ActorResolver = (request: FastifyRequest) => Promise<AuthenticatedActor | null>;

declare module "fastify" {
  interface FastifyRequest {
    actor: AuthenticatedActor | null;
    authError: AuthError | null;
  }
}

type SupabaseJwtPayload = {
  sub?: string;
  email?: string;
  exp?: number;
  role?: string;
  app_metadata?: {
    role?: string;
  };
  user_metadata?: {
    display_name?: string;
  };
};

type UserActorLookup = {
  userId?: string | null;
  email?: string | null;
  authSource: AuthenticatedActor["authSource"];
};

export class AuthError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function registerAuthContext(
  app: FastifyInstance,
  options: {
    actorResolver?: ActorResolver;
  } = {}
) {
  const actorResolver = options.actorResolver ?? createDefaultActorResolver();

  app.decorateRequest("actor", null);
  app.decorateRequest("authError", null);

  app.addHook("preHandler", async (request) => {
    request.actor = null;
    request.authError = null;

    try {
      request.actor = await actorResolver(request);
    } catch (error) {
      if (error instanceof AuthError) {
        request.authError = error;
        return;
      }

      throw error;
    }
  });
}

export function requireRoles(...allowedRoles: RoleKey[]) {
  return async function guard(request: FastifyRequest, reply: FastifyReply) {
    if (request.authError) {
      return sendAuthError(request.authError, reply);
    }

    if (!request.actor) {
      return reply.status(401).send({
        error: "unauthorized",
        message: "Authentication is required for this resource."
      });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(request.actor.role)) {
      return reply.status(403).send({
        error: "forbidden",
        message: `Role ${request.actor.role} is not allowed to access this resource.`
      });
    }
  };
}

export function createInjectedActorResolver(actor: AuthenticatedActor): ActorResolver {
  return () =>
    Promise.resolve({
      ...actor,
      authSource: "injected"
    });
}

function createDefaultActorResolver(): ActorResolver {
  return async (request) => {
    const authorization = readHeader(request, "authorization");

    if (authorization) {
      return resolveBearerActor(authorization);
    }

    if (allowDevAuthHeaders()) {
      return resolveDevHeaderActor(request);
    }

    return null;
  };
}

async function resolveBearerActor(authorization: string) {
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new AuthError(401, "invalid_authorization_header", "Authorization header must use Bearer authentication.");
  }

  const secret = process.env.SUPABASE_JWT_SECRET?.trim() ?? null;

  const token = match[1];

  if (!token) {
    throw new AuthError(401, "invalid_authorization_header", "Bearer token value is missing.");
  }

  const payload = await verifySupabaseJwt(token, secret);
  const fallbackRole = parseRoleClaim(payload.app_metadata?.role ?? payload.role);

  if (process.env.DATABASE_URL) {
    return lookupUserActor(buildUserLookup(payload.sub, payload.email, "supabase_jwt"));
  }

  if (!payload.sub) {
    throw new AuthError(401, "invalid_token", "Supabase access token is missing the user subject.");
  }

  if (!fallbackRole) {
    throw new AuthError(
      403,
      "missing_application_role",
      "Supabase access token does not include an application role claim."
    );
  }

  return {
    userId: payload.sub,
    email: payload.email ?? `${payload.sub}@local.invalid`,
    displayName: payload.user_metadata?.display_name ?? payload.email ?? payload.sub,
    role: fallbackRole,
    authSource: "supabase_jwt"
  } satisfies AuthenticatedActor;
}

async function resolveDevHeaderActor(request: FastifyRequest) {
  const userId = readHeader(request, "x-dev-user-id");
  const email = readHeader(request, "x-dev-email");
  const displayName = readHeader(request, "x-dev-display-name");
  const devRole = parseRoleClaim(readHeader(request, "x-dev-role"));

  if (!userId && !email && !devRole) {
    return null;
  }

  if (process.env.DATABASE_URL && (userId || email)) {
    return lookupUserActor(buildUserLookup(userId, email, "dev_headers"));
  }

  if (!devRole) {
    throw new AuthError(
      400,
      "missing_dev_role",
      "x-dev-role is required when dev auth headers are used without a provisioned application user."
    );
  }

  return {
    userId: userId ?? `dev-${devRole}`,
    email: email ?? `${devRole}@local.test`,
    displayName: displayName ?? `Dev ${capitalize(devRole)}`,
    role: devRole,
    authSource: "dev_headers"
  } satisfies AuthenticatedActor;
}

async function lookupUserActor(input: UserActorLookup) {
  const db = getDb();

  if (input.userId) {
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        isActive: users.isActive,
        role: roles.key
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, input.userId))
      .limit(1);

    if (user[0]) {
      return toActor(user[0], input.authSource);
    }
  }

  if (input.email) {
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        isActive: users.isActive,
        role: roles.key
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.email, input.email))
      .limit(1);

    if (user[0]) {
      return toActor(user[0], input.authSource);
    }
  }

  throw new AuthError(
    403,
    "user_not_provisioned",
    "Authenticated user is not provisioned in the application database."
  );
}

function toActor(
  user: {
    id: string;
    email: string;
    displayName: string;
    isActive: boolean;
    role: RoleKey;
  },
  authSource: AuthenticatedActor["authSource"]
) {
  if (!user.isActive) {
    throw new AuthError(403, "inactive_user", "Authenticated user account is inactive.");
  }

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    authSource
  } satisfies AuthenticatedActor;
}

async function verifySupabaseJwt(token: string, secret: string | null) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new AuthError(401, "invalid_token", "Supabase access token is malformed.");
  }

  const header = parseJsonSegment<{ alg?: string; typ?: string; kid?: string }>(encodedHeader);
  const signedData = `${encodedHeader}.${encodedPayload}`;
  const providedSignature = decodeBase64Url(encodedSignature);

  if (header.alg === "HS256") {
    if (!secret) {
      throw new AuthError(
        500,
        "auth_configuration_error",
        "SUPABASE_JWT_SECRET must be configured for HS256 Supabase access tokens."
      );
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(signedData)
      .digest();

    if (
      providedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(providedSignature, expectedSignature)
    ) {
      throw new AuthError(401, "invalid_token_signature", "Supabase access token signature is invalid.");
    }
  } else if (header.alg === "ES256") {
    const publicKey = await resolveEs256PublicKey(header.kid);
    const isValid = verify(
      null,
      Buffer.from(signedData),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      providedSignature
    );

    if (!isValid) {
      throw new AuthError(401, "invalid_token_signature", "Supabase access token signature is invalid.");
    }
  } else {
    throw new AuthError(401, "unsupported_token_alg", `Token algorithm ${header.alg ?? "unknown"} is not supported.`);
  }

  const payload = parseJsonSegment<SupabaseJwtPayload>(encodedPayload);
  const currentUnixTime = Math.floor(Date.now() / 1000);

  if (typeof payload.exp === "number" && payload.exp <= currentUnixTime) {
    throw new AuthError(401, "expired_token", "Supabase access token has expired.");
  }

  return payload;
}

type JwksKey = { kty: string; crv: string; x: string; y: string; kid?: string };
let cachedJwks: JwksKey[] | null = null;
let jwksFetchedAt = 0;

async function resolveEs256PublicKey(kid: string | undefined) {
  if (cachedJwks && Date.now() - jwksFetchedAt < 300_000) {
    const key = findJwk(cachedJwks, kid);
    if (key) return key;
  }

  const jwksUrl = process.env.SUPABASE_URL
    ? `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`
    : null;

  if (jwksUrl) {
    await fetchJwks(jwksUrl);
  }

  if (cachedJwks) {
    const key = findJwk(cachedJwks, kid);
    if (key) return key;
  }

  throw new AuthError(
    401,
    "jwks_unavailable",
    "ES256 public keys are not available. Check SUPABASE_URL configuration."
  );
}

function findJwk(keys: JwksKey[], kid: string | undefined) {
  const jwk = kid ? keys.find((k) => k.kid === kid) : keys[0];
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256") return null;

  return createPublicKey({ key: jwk, format: "jwk" });
}

async function fetchJwks(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const data = (await response.json()) as { keys?: JwksKey[] };
    if (data.keys && Array.isArray(data.keys)) {
      cachedJwks = data.keys;
      jwksFetchedAt = Date.now();
    }
  } catch {
    // JWKS fetch failed — will retry next request
  }
}

function parseJsonSegment<T>(value: string) {
  try {
    return JSON.parse(decodeBase64Url(value).toString("utf8")) as T;
  } catch {
    throw new AuthError(401, "invalid_token", "Supabase access token contains an invalid JSON payload.");
  }
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  const padding = remainder === 0 ? "" : "=".repeat(4 - remainder);

  return Buffer.from(`${normalized}${padding}`, "base64");
}

function parseRoleClaim(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = roleSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

function readHeader(request: FastifyRequest, headerName: string) {
  const value = request.headers[headerName];

  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim() || null;
  }

  return null;
}

function buildUserLookup(
  userId: string | null | undefined,
  email: string | null | undefined,
  authSource: AuthenticatedActor["authSource"]
) {
  const lookup: UserActorLookup = {
    authSource
  };

  if (userId) {
    lookup.userId = userId;
  }

  if (email) {
    lookup.email = email;
  }

  return lookup;
}

function allowDevAuthHeaders() {
  return process.env.NODE_ENV === "test" || (
    process.env.ALLOW_DEV_AUTH_HEADERS === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

function sendAuthError(error: AuthError, reply: FastifyReply) {
  return reply.status(error.statusCode).send({
    error: error.code,
    message: error.message
  });
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
