import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";

import { type PutawayInput, type ReceiveStockInput } from "@wms/shared";

import { requireRoles } from "../auth.js";
import { type WarehouseState, WarehouseDomainError } from "../domain/warehouse-state.js";

export function registerReceivingRoutes(app: FastifyInstance, warehouseState: WarehouseState) {
  app.post<{ Body: ReceiveStockInput }>(
    "/api/v1/receiving/confirm",
    {
      preHandler: requireRoles("admin", "manager", "receiver")
    },
    async (request, reply) => {
      try {
        return await warehouseState.confirmReceipt(request.body, request.actor);
      } catch (error) {
        return sendKnownError(error, reply);
      }
    }
  );

  app.post<{ Body: PutawayInput }>(
    "/api/v1/receiving/putaway",
    {
      preHandler: requireRoles("admin", "manager", "receiver")
    },
    async (request, reply) => {
      try {
        return await warehouseState.putAway(request.body, request.actor);
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
