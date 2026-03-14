import "server-only";

import { redirect } from "next/navigation";

import {
  adjustInventoryInputSchema,
  allocateOrderInputSchema,
  apiRouteGroups,
  confirmCountInputSchema,
  countConfirmationResponseSchema,
  countQueueResponseSchema,
  countReleaseResponseSchema,
  dashboardMetrics,
  dashboardResponseSchema,
  dispatchShipmentInputSchema,
  initiateReturnInputSchema,
  inventoryAdjustmentResponseSchema,
  inventoryOverviewResponseSchema,
  orderAllocationResponseSchema,
  orderOverviewResponseSchema,
  packOrderInputSchema,
  packingActionResponseSchema,
  packingQueueResponseSchema,
  pickStockInputSchema,
  pickingActionResponseSchema,
  pickingQueueResponseSchema,
  processReturnInputSchema,
  returnInitiationResponseSchema,
  returnOverviewResponseSchema,
  returnResolutionResponseSchema,
  releaseCountTaskInputSchema,
  shipmentOverviewResponseSchema,
  shippingActionResponseSchema,
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

const apiBaseUrl = process.env.API_BASE_URL?.trim() ?? process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

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
    throw new Error("API_BASE_URL must be defined for protected API requests.");
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
    throw new Error("API_BASE_URL must be defined for protected API requests.");
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

export async function getCountQueue(session: AppSession) {
  const payload = await fetchProtected(
    "/api/v1/tasks/counting",
    countQueueResponseSchema,
    session,
    "/counts"
  );

  return payload.tasks;
}

export async function getOrderOverview(session: AppSession) {
  const payload = await fetchProtected(
    "/api/v1/orders",
    orderOverviewResponseSchema,
    session,
    "/orders"
  );

  return payload.orders;
}

export async function getPickingQueue(session: AppSession) {
  const payload = await fetchProtected(
    "/api/v1/tasks/picking",
    pickingQueueResponseSchema,
    session,
    "/orders"
  );

  return payload.tasks;
}

export async function getPackingQueue(session: AppSession) {
  const payload = await fetchProtected(
    "/api/v1/tasks/packing",
    packingQueueResponseSchema,
    session,
    "/orders"
  );

  return payload.tasks;
}

export async function getShipments(session: AppSession) {
  const payload = await fetchProtected(
    "/api/v1/shipments",
    shipmentOverviewResponseSchema,
    session,
    "/orders"
  );

  return payload.shipments;
}

export async function getReturns(session: AppSession) {
  const payload = await fetchProtected(
    "/api/v1/returns",
    returnOverviewResponseSchema,
    session,
    "/returns"
  );

  return payload.returns;
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

export async function allocateOrder(session: AppSession, input: unknown) {
  const payload = allocateOrderInputSchema.parse(input);

  return postProtected(
    "/api/v1/orders/allocate",
    orderAllocationResponseSchema,
    payload,
    session,
    "/orders"
  );
}

export async function confirmPick(session: AppSession, input: unknown) {
  const payload = pickStockInputSchema.parse(input);

  return postProtected(
    "/api/v1/picking/confirm",
    pickingActionResponseSchema,
    payload,
    session,
    "/orders"
  );
}

export async function confirmPack(session: AppSession, input: unknown) {
  const payload = packOrderInputSchema.parse(input);

  return postProtected(
    "/api/v1/packing/confirm",
    packingActionResponseSchema,
    payload,
    session,
    "/orders"
  );
}

export async function dispatchShipment(session: AppSession, input: unknown) {
  const payload = dispatchShipmentInputSchema.parse(input);

  return postProtected(
    "/api/v1/shipments/dispatch",
    shippingActionResponseSchema,
    payload,
    session,
    "/orders"
  );
}

export async function releaseCountTask(session: AppSession, input: unknown) {
  const payload = releaseCountTaskInputSchema.parse(input);

  return postProtected(
    "/api/v1/counts/release",
    countReleaseResponseSchema,
    payload,
    session,
    "/counts"
  );
}

export async function confirmCount(session: AppSession, input: unknown) {
  const payload = confirmCountInputSchema.parse(input);

  return postProtected(
    "/api/v1/counts/confirm",
    countConfirmationResponseSchema,
    payload,
    session,
    "/counts"
  );
}

export async function adjustInventory(session: AppSession, input: unknown) {
  const payload = adjustInventoryInputSchema.parse(input);

  return postProtected(
    "/api/v1/inventory/adjust",
    inventoryAdjustmentResponseSchema,
    payload,
    session,
    "/counts"
  );
}

export async function initiateReturn(session: AppSession, input: unknown) {
  const payload = initiateReturnInputSchema.parse(input);

  return postProtected(
    "/api/v1/returns/initiate",
    returnInitiationResponseSchema,
    payload,
    session,
    "/returns"
  );
}

export async function processReturn(session: AppSession, input: unknown) {
  const payload = processReturnInputSchema.parse(input);

  return postProtected(
    "/api/v1/returns/process",
    returnResolutionResponseSchema,
    payload,
    session,
    "/returns"
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
