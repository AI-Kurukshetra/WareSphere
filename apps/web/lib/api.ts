import "server-only";

import { redirect } from "next/navigation";

import {
  apiRouteGroups,
  dashboardMetrics,
  dashboardResponseSchema,
  inventoryOverviewResponseSchema,
  putawayInputSchema,
  receiveStockInputSchema,
  receivingActionResponseSchema,
  receivingQueueResponseSchema,
  routeGroupsResponseSchema
} from "@wms/shared";

import { buildApiAuthHeaders, type AppSession } from "./session";

type Parsable<T> = {
  parse: (value: unknown) => T;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

export class ApiRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function fetchPublicWithFallback<T>(path: string, schema: Parsable<T>, fallback: T) {
  if (!apiBaseUrl) {
    return fallback;
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return schema.parse(await response.json());
  } catch {
    return fallback;
  }
}

async function fetchProtected<T>(
  path: string,
  schema: Parsable<T>,
  session: AppSession,
  redirectTarget: string
) {
  if (!apiBaseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be defined for protected API requests.");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    headers: buildApiAuthHeaders(session)
  });

  if (response.status === 401) {
    redirect(`/sign-in?reason=session-expired&next=${encodeURIComponent(redirectTarget)}`);
  }

  if (response.status === 403) {
    redirect("/sign-in?reason=forbidden");
  }

  if (!response.ok) {
    throw await createApiRequestError(path, response);
  }

  return schema.parse(await response.json());
}

async function postProtected<TInput, TOutput>(
  path: string,
  schema: Parsable<TOutput>,
  input: TInput,
  session: AppSession,
  redirectTarget: string
) {
  if (!apiBaseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be defined for protected API requests.");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      ...buildApiAuthHeaders(session),
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (response.status === 401) {
    redirect(`/sign-in?reason=session-expired&next=${encodeURIComponent(redirectTarget)}`);
  }

  if (response.status === 403) {
    redirect("/sign-in?reason=forbidden");
  }

  if (!response.ok) {
    throw await createApiRequestError(path, response);
  }

  return schema.parse(await response.json());
}

export async function getDashboardMetrics(session: AppSession) {
  const payload = await fetchProtected("/api/v1/dashboard", dashboardResponseSchema, session, "/");

  return payload.metrics;
}

export async function getRouteGroups() {
  const payload = await fetchPublicWithFallback("/api/v1/routes", routeGroupsResponseSchema, {
    groups: apiRouteGroups
  });

  return payload.groups;
}

export async function getReceivingQueue(session: AppSession) {
  const payload = await fetchProtected(
    "/api/v1/tasks/receiving",
    receivingQueueResponseSchema,
    session,
    "/receiving"
  );

  return payload.tasks;
}

export async function getInventoryOverview(session: AppSession) {
  const payload = await fetchProtected(
    "/api/v1/inventory",
    inventoryOverviewResponseSchema,
    session,
    "/inventory"
  );

  return payload.records;
}

export async function confirmReceipt(session: AppSession, input: unknown) {
  const payload = receiveStockInputSchema.parse(input);

  return postProtected(
    "/api/v1/receiving/confirm",
    receivingActionResponseSchema,
    payload,
    session,
    "/receiving"
  );
}

export async function putAway(session: AppSession, input: unknown) {
  const payload = putawayInputSchema.parse(input);

  return postProtected(
    "/api/v1/receiving/putaway",
    receivingActionResponseSchema,
    payload,
    session,
    "/receiving"
  );
}

export async function getDashboardPreview() {
  return dashboardMetrics;
}

async function createApiRequestError(path: string, response: Response) {
  let message = `Request to ${path} failed with status ${response.status}.`;
  let code = "api_error";

  try {
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };

    if (typeof payload.error === "string" && payload.error.length > 0) {
      code = payload.error;
    }

    if (typeof payload.message === "string" && payload.message.length > 0) {
      message = payload.message;
    }
  } catch {
    // Preserve the default error message when the response body is not JSON.
  }

  return new ApiRequestError(response.status, code, message);
}
