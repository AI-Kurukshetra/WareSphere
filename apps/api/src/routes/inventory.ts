import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";

import { type AdjustInventoryInput } from "@wms/shared";

import { requireRoles } from "../auth.js";
import { WarehouseDomainError } from "../domain/warehouse-state.js";
import type { WarehouseState } from "../domain/warehouse-state.js";

export function registerInventoryRoutes(app: FastifyInstance, warehouseState: WarehouseState) {
  app.get(
    "/api/v1/inventory",
    {
      preHandler: requireRoles("admin", "manager", "receiver")
    },
    async () => ({
      records: await warehouseState.listInventory()
    })
  );

  app.post<{ Body: AdjustInventoryInput }>(
    "/api/v1/inventory/adjust",
    {
      preHandler: requireRoles("admin", "manager")
    },
    async (request, reply) => {
      try {
        return await warehouseState.adjustInventory(request.body, request.actor);
      } catch (error) {
        return sendKnownError(error, reply);
      }
    }
  );
}

function sendKnownError(error: unknown, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "validation_error",
      details: error.flatten()
    });
  }

  if (error instanceof WarehouseDomainError) {
    return reply.status(error.statusCode).send({
      error: error.name,
      message: error.message
    });
  }

  throw error;
}
