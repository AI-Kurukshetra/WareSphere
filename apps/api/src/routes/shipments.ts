import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";

import { type DispatchShipmentInput } from "@wms/shared";

import { requireRoles } from "../auth.js";
import { type WarehouseState, WarehouseDomainError } from "../domain/warehouse-state.js";

export function registerShipmentRoutes(app: FastifyInstance, warehouseState: WarehouseState) {
  app.get(
    "/api/v1/shipments",
    {
      preHandler: requireRoles("admin", "manager", "packer")
    },
    async () => ({
      shipments: await warehouseState.listShipments()
    })
  );

  app.post<{ Body: DispatchShipmentInput }>(
    "/api/v1/shipments/dispatch",
    {
      preHandler: requireRoles("admin", "manager", "packer")
    },
    async (request, reply) => {
      try {
        return await warehouseState.dispatchShipment(request.body, request.actor);
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
