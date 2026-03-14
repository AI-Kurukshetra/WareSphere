import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";

import { type AllocateOrderInput } from "@wms/shared";

import { requireRoles } from "../auth.js";
import { type WarehouseState, WarehouseDomainError } from "../domain/warehouse-state.js";

export function registerOrderRoutes(app: FastifyInstance, warehouseState: WarehouseState) {
  app.get(
    "/api/v1/orders",
    {
      preHandler: requireRoles("admin", "manager", "picker", "packer")
    },
    async () => ({
      orders: await warehouseState.listOrders()
    })
  );

  app.post<{ Body: AllocateOrderInput }>(
    "/api/v1/orders/allocate",
    {
      preHandler: requireRoles("admin", "manager")
    },
    async (request, reply) => {
      try {
        return await warehouseState.allocateOrder(request.body, request.actor);
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
