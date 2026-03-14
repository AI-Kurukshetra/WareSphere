import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { RoleKey } from "@wms/shared";

import { createInjectedActorResolver } from "../src/auth.js";
import { createWarehouseState } from "../src/domain/warehouse-state.js";
import { buildApp } from "../src/app.js";

describe("api app", () => {
  it("reports healthy status", async () => {
    const app = buildApp({
      warehouseState: createWarehouseState()
    });
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });
    const payload = JSON.parse(response.body) as { status: string };

    expect(response.statusCode).toBe(200);
    expect(payload.status).toBe("ok");
    await app.close();
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const app = buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/tasks/receiving"
    });
    const payload = JSON.parse(response.body) as { error: string };

    expect(response.statusCode).toBe(401);
    expect(payload.error).toBe("unauthorized");
    await app.close();
  });

  it("returns the receiving queue for receiver access", async () => {
    const app = buildTestApp("receiver");
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/tasks/receiving"
    });
    const payload = JSON.parse(response.body) as {
      tasks: Array<{ id: string }>;
    };

    expect(response.statusCode).toBe(200);
    expect(payload.tasks).toHaveLength(2);
    await app.close();
  });

  it("returns the order backlog for picker access", async () => {
    const app = buildTestApp("picker");
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/orders"
    });
    const payload = JSON.parse(response.body) as {
      orders: Array<{ id: string; status: string }>;
    };

    expect(response.statusCode).toBe(200);
    expect(payload.orders).toHaveLength(3);
    expect(payload.orders[0]?.id).toBe("SHOP-1101");
    await app.close();
  });

  it("rejects receiver access to manual inventory adjustments", async () => {
    const app = buildTestApp("receiver");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/inventory/adjust",
      payload: {
        inventoryId: "inv-chair-bulk",
        quantityDelta: -1,
        reasonCode: "variance check"
      }
    });
    const payload = JSON.parse(response.body) as { error: string; message: string };

    expect(response.statusCode).toBe(403);
    expect(payload.error).toBe("forbidden");
    expect(payload.message).toMatch(/receiver/i);
    await app.close();
  });

  it("returns the inventory overview for manager access", async () => {
    const app = buildTestApp("manager");
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/inventory"
    });
    const payload = JSON.parse(response.body) as {
      records: Array<{ binCode: string }>;
    };

    expect(response.statusCode).toBe(200);
    expect(payload.records[0]?.binCode).toBeDefined();
    await app.close();
  });

  it("releases a cycle count task from an inventory record", async () => {
    const app = buildTestApp("manager");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/counts/release",
      payload: {
        inventoryId: "inv-lamp-bulk"
      }
    });
    const payload = JSON.parse(response.body) as {
      task: { id: string; expectedQuantity: number; binCode: string; status: string };
    };

    expect(response.statusCode).toBe(200);
    expect(payload.task.id).toBe("COUNT-SKU-LAMP-003-B-04-01-01");
    expect(payload.task.expectedQuantity).toBe(64);
    expect(payload.task.binCode).toBe("B-04-01");
    expect(payload.task.status).toBe("open");
    await app.close();
  });

  it("confirms a cycle count and applies the variance to inventory", async () => {
    const app = buildTestApp("manager");

    await app.inject({
      method: "POST",
      url: "/api/v1/counts/release",
      payload: {
        inventoryId: "inv-lamp-bulk"
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/counts/confirm",
      payload: {
        taskId: "COUNT-SKU-LAMP-003-B-04-01-01",
        binCode: "B-04-01",
        barcode: "8901000000035",
        countedQuantity: 63
      }
    });
    const payload = JSON.parse(response.body) as {
      task: { status: string; countedQuantity: number | null; varianceQuantity: number | null };
      inventoryRecord: { binCode: string; onHandQuantity: number };
    };

    expect(response.statusCode).toBe(200);
    expect(payload.task.status).toBe("completed");
    expect(payload.task.countedQuantity).toBe(63);
    expect(payload.task.varianceQuantity).toBe(-1);
    expect(payload.inventoryRecord.binCode).toBe("B-04-01");
    expect(payload.inventoryRecord.onHandQuantity).toBe(63);
    await app.close();
  });

  it("posts a manual inventory adjustment for manager access", async () => {
    const app = buildTestApp("manager");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/inventory/adjust",
      payload: {
        inventoryId: "inv-chair-bulk",
        quantityDelta: 2,
        reasonCode: "cycle count variance"
      }
    });
    const payload = JSON.parse(response.body) as {
      inventoryRecord: { binCode: string; onHandQuantity: number };
    };

    expect(response.statusCode).toBe(200);
    expect(payload.inventoryRecord.binCode).toBe("B-01-02");
    expect(payload.inventoryRecord.onHandQuantity).toBe(50);
    await app.close();
  });

  it("confirms inbound stock against a receiving task", async () => {
    const app = buildTestApp("receiver");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/receiving/confirm",
      payload: {
        taskId: "REC-1008",
        barcode: "8901000000011",
        quantity: 8
      }
    });
    const payload = JSON.parse(response.body) as {
      task: { receivedQuantity: number; status: string };
      inventoryRecord: { binCode: string; onHandQuantity: number };
    };

    expect(response.statusCode).toBe(200);
    expect(payload.task.receivedQuantity).toBe(8);
    expect(payload.task.status).toBe("in_progress");
    expect(payload.inventoryRecord.binCode).toBe("STAGE-A1");
    expect(payload.inventoryRecord.onHandQuantity).toBe(8);
    await app.close();
  });

  it("allocates a new order and creates pick tasks", async () => {
    const app = buildTestApp("manager");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/orders/allocate",
      payload: {
        orderId: "SHOP-1101"
      }
    });
    const payload = JSON.parse(response.body) as {
      order: { id: string; status: string; unitsAllocated: number };
      tasks: Array<{ id: string }>;
    };

    expect(response.statusCode).toBe(200);
    expect(payload.order.id).toBe("SHOP-1101");
    expect(payload.order.status).toBe("allocated");
    expect(payload.order.unitsAllocated).toBe(3);
    expect(payload.tasks).toHaveLength(2);
    await app.close();
  });

  it("rejects a barcode mismatch during receiving", async () => {
    const app = buildTestApp("receiver");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/receiving/confirm",
      payload: {
        taskId: "REC-1008",
        barcode: "8901000000999",
        quantity: 8
      }
    });
    const payload = JSON.parse(response.body) as {
      error: string;
      message: string;
    };

    expect(response.statusCode).toBe(409);
    expect(payload.error).toBe("WarehouseDomainError");
    expect(payload.message).toMatch(/barcode/i);
    await app.close();
  });

  it("moves staged stock into the destination bin", async () => {
    const app = buildTestApp("receiver");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/receiving/putaway",
      payload: {
        taskId: "REC-1009",
        destinationBin: "B-03-07"
      }
    });
    const payload = JSON.parse(response.body) as {
      task: { status: string };
      inventoryRecord: { binCode: string; onHandQuantity: number };
    };

    expect(response.statusCode).toBe(200);
    expect(payload.task.status).toBe("completed");
    expect(payload.inventoryRecord.binCode).toBe("B-03-07");
    expect(payload.inventoryRecord.onHandQuantity).toBe(24);
    await app.close();
  });

  it("returns the picking queue for picker access", async () => {
    const app = buildTestApp("picker");
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/tasks/picking"
    });
    const payload = JSON.parse(response.body) as {
      tasks: Array<{ id: string }>;
    };

    expect(response.statusCode).toBe(200);
    expect(payload.tasks).toHaveLength(2);
    expect(payload.tasks[0]?.id).toBe("PICK-WOO-2204-01");
    await app.close();
  });

  it("confirms a picking task from the assigned bin", async () => {
    const app = buildTestApp("picker");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/picking/confirm",
      payload: {
        taskId: "PICK-WOO-2204-01",
        sourceBin: "B-01-02",
        barcode: "8901000000011",
        quantity: 4
      }
    });
    const payload = JSON.parse(response.body) as {
      task: { status: string; pickedQuantity: number };
      order: { status: string; unitsPicked: number };
      inventoryRecord: { onHandQuantity: number; allocatedQuantity: number };
    };

    expect(response.statusCode).toBe(200);
    expect(payload.task.status).toBe("completed");
    expect(payload.task.pickedQuantity).toBe(4);
    expect(payload.order.status).toBe("picking");
    expect(payload.order.unitsPicked).toBe(4);
    expect(payload.inventoryRecord.onHandQuantity).toBe(44);
    expect(payload.inventoryRecord.allocatedQuantity).toBe(6);
    await app.close();
  });

  it("rejects a bin mismatch during picking", async () => {
    const app = buildTestApp("picker");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/picking/confirm",
      payload: {
        taskId: "PICK-WOO-2204-01",
        sourceBin: "B-99-01",
        barcode: "8901000000011",
        quantity: 1
      }
    });
    const payload = JSON.parse(response.body) as {
      error: string;
      message: string;
    };

    expect(response.statusCode).toBe(409);
    expect(payload.error).toBe("WarehouseDomainError");
    expect(payload.message).toMatch(/assigned bin/i);
    await app.close();
  });

  it("releases a packing task when the final pick is confirmed", async () => {
    const app = buildTestApp("manager");

    await app.inject({
      method: "POST",
      url: "/api/v1/picking/confirm",
      payload: {
        taskId: "PICK-WOO-2204-01",
        sourceBin: "B-01-02",
        barcode: "8901000000011",
        quantity: 4
      }
    });

    const finalPick = await app.inject({
      method: "POST",
      url: "/api/v1/picking/confirm",
      payload: {
        taskId: "PICK-WOO-2204-02",
        sourceBin: "B-03-07",
        barcode: "8901000000028",
        quantity: 3
      }
    });
    const finalPickPayload = JSON.parse(finalPick.body) as {
      order: { id: string; status: string; unitsPicked: number };
    };

    const queue = await app.inject({
      method: "GET",
      url: "/api/v1/tasks/packing"
    });
    const queuePayload = JSON.parse(queue.body) as {
      tasks: Array<{ id: string; expectedQuantity: number; status: string }>;
    };

    expect(finalPick.statusCode).toBe(200);
    expect(finalPickPayload.order.id).toBe("WOO-2204");
    expect(finalPickPayload.order.status).toBe("picking");
    expect(finalPickPayload.order.unitsPicked).toBe(7);
    expect(queue.statusCode).toBe(200);
    expect(queuePayload.tasks).toHaveLength(1);
    expect(queuePayload.tasks[0]?.id).toBe("PACK-WOO-2204");
    expect(queuePayload.tasks[0]?.expectedQuantity).toBe(7);
    expect(queuePayload.tasks[0]?.status).toBe("open");
    await app.close();
  });

  it("packs a fully picked order and dispatches its shipment", async () => {
    const app = buildTestApp("manager");

    await app.inject({
      method: "POST",
      url: "/api/v1/picking/confirm",
      payload: {
        taskId: "PICK-WOO-2204-01",
        sourceBin: "B-01-02",
        barcode: "8901000000011",
        quantity: 4
      }
    });

    await app.inject({
      method: "POST",
      url: "/api/v1/picking/confirm",
      payload: {
        taskId: "PICK-WOO-2204-02",
        sourceBin: "B-03-07",
        barcode: "8901000000028",
        quantity: 3
      }
    });

    const packResponse = await app.inject({
      method: "POST",
      url: "/api/v1/packing/confirm",
      payload: {
        taskId: "PACK-WOO-2204",
        packageCount: 2
      }
    });
    const packPayload = JSON.parse(packResponse.body) as {
      task: { id: string; status: string; packedQuantity: number };
      order: { status: string; unitsPacked: number };
      shipment: { id: string; status: string; packageCount: number };
    };

    const shipmentsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/shipments"
    });
    const shipmentsPayload = JSON.parse(shipmentsResponse.body) as {
      shipments: Array<{ id: string; status: string }>;
    };

    const shipmentId = packPayload.shipment.id;

    expect(packResponse.statusCode).toBe(200);
    expect(packPayload.task.id).toBe("PACK-WOO-2204");
    expect(packPayload.task.status).toBe("completed");
    expect(packPayload.task.packedQuantity).toBe(7);
    expect(packPayload.order.status).toBe("packed");
    expect(packPayload.order.unitsPacked).toBe(7);
    expect(packPayload.shipment.status).toBe("packed");
    expect(packPayload.shipment.packageCount).toBe(2);
    expect(shipmentId).toBeDefined();
    expect(shipmentsPayload.shipments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: shipmentId,
          status: "packed"
        })
      ])
    );

    const dispatchResponse = await app.inject({
      method: "POST",
      url: "/api/v1/shipments/dispatch",
      payload: {
        shipmentId,
        carrierCode: "delhivery",
        serviceLevel: "surface",
        trackingNumber: "TRK-WOO2204"
      }
    });
    const dispatchPayload = JSON.parse(dispatchResponse.body) as {
      shipment: { status: string; trackingNumber: string | null };
      order: { id: string; status: string };
    };

    expect(dispatchResponse.statusCode).toBe(200);
    expect(dispatchPayload.order.id).toBe("WOO-2204");
    expect(dispatchPayload.order.status).toBe("shipped");
    expect(dispatchPayload.shipment.status).toBe("dispatched");
    expect(dispatchPayload.shipment.trackingNumber).toBe("TRK-WOO2204");
    await app.close();
  });

  it("creates and lists a return request for a shipped order", async () => {
    const app = buildTestApp("receiver");
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/returns/initiate",
      payload: {
        orderId: "SHOP-1188",
        sku: "SKU-LAMP-003",
        quantity: 1,
        sourceReference: "RMA-SHOP-1188-01"
      }
    });
    const createPayload = JSON.parse(createResponse.body) as {
      returnRequest: { id: string; status: string; orderId: string; quantity: number };
      order: { id: string; status: string };
    };

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/returns"
    });
    const listPayload = JSON.parse(listResponse.body) as {
      returns: Array<{ id: string; status: string }>;
    };

    expect(createResponse.statusCode).toBe(200);
    expect(createPayload.returnRequest.orderId).toBe("SHOP-1188");
    expect(createPayload.returnRequest.status).toBe("initiated");
    expect(createPayload.returnRequest.quantity).toBe(1);
    expect(createPayload.order.status).toBe("shipped");
    expect(listResponse.statusCode).toBe(200);
    expect(listPayload.returns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createPayload.returnRequest.id,
          status: "initiated"
        })
      ])
    );
    await app.close();
  });

  it("restocks a processed return into inventory", async () => {
    const app = buildTestApp("receiver");

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/returns/initiate",
      payload: {
        orderId: "SHOP-1188",
        sku: "SKU-LAMP-003",
        quantity: 1,
        sourceReference: "RMA-SHOP-1188-02"
      }
    });
    const createPayload = JSON.parse(createResponse.body) as {
      returnRequest: { id: string };
    };

    const processResponse = await app.inject({
      method: "POST",
      url: "/api/v1/returns/process",
      payload: {
        returnId: createPayload.returnRequest.id,
        barcode: "8901000000035",
        disposition: "restock",
        destinationBin: "B-04-01"
      }
    });
    const processPayload = JSON.parse(processResponse.body) as {
      returnRequest: { status: string; destinationBin: string | null; disposition: string | null };
      inventoryRecord: { binCode: string; onHandQuantity: number };
    };

    expect(processResponse.statusCode).toBe(200);
    expect(processPayload.returnRequest.status).toBe("restocked");
    expect(processPayload.returnRequest.disposition).toBe("restock");
    expect(processPayload.returnRequest.destinationBin).toBe("B-04-01");
    expect(processPayload.inventoryRecord.binCode).toBe("B-04-01");
    expect(processPayload.inventoryRecord.onHandQuantity).toBe(65);
    await app.close();
  });

  it("rejects return creation for an order that has not shipped", async () => {
    const app = buildTestApp("receiver");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/returns/initiate",
      payload: {
        orderId: "SHOP-1101",
        sku: "SKU-CHAIR-001",
        quantity: 1,
        sourceReference: "RMA-SHOP-1101-01"
      }
    });
    const payload = JSON.parse(response.body) as {
      error: string;
      message: string;
    };

    expect(response.statusCode).toBe(409);
    expect(payload.error).toBe("WarehouseDomainError");
    expect(payload.message).toMatch(/must be shipped/i);
    await app.close();
  });

  it("accepts a verified Supabase bearer token for manager-only routes", async () => {
    const originalJwtSecret = process.env.SUPABASE_JWT_SECRET;
    const jwtSecret = "unit-test-secret";
    process.env.SUPABASE_JWT_SECRET = jwtSecret;

    const app = buildTestApp();
    try {
      const token = createJwt(
        {
          sub: "manager-user",
          email: "manager@test.local",
          role: "manager",
          exp: Math.floor(Date.now() / 1000) + 60
        },
        jwtSecret
      );
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dashboard",
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const payload = JSON.parse(response.body) as {
        metrics: Array<{ id: string }>;
      };

      expect(response.statusCode).toBe(200);
      expect(payload.metrics[0]?.id).toBeDefined();
    } finally {
      process.env.SUPABASE_JWT_SECRET = originalJwtSecret;
      await app.close();
    }
  });
});

function buildTestApp(role?: RoleKey) {
  if (role) {
    return buildApp({
      warehouseState: createWarehouseState(),
      actorResolver: createInjectedActorResolver(createActor(role))
    });
  }

  return buildApp({
    warehouseState: createWarehouseState()
  });
}

function createActor(role: RoleKey) {
  return {
    userId: `${role}-user`,
    email: `${role}@test.local`,
    displayName: `Test ${capitalize(role)}`,
    role,
    authSource: "injected" as const
  };
}

function createJwt(payload: Record<string, unknown>, secret: string) {
  const encodedHeader = encodeBase64Url(
    JSON.stringify({
      alg: "HS256",
      typ: "JWT"
    })
  );
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
