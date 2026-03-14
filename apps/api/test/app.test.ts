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

  it("rejects receiver access to inventory overview", async () => {
    const app = buildTestApp("receiver");
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/inventory"
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
