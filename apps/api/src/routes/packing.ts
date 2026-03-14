import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";

import { type PackOrderInput } from "@wms/shared";

import { requireRoles } from "../auth.js";
import { type WarehouseState, WarehouseDomainError } from "../domain/warehouse-state.js";

export function registerPackingRoutes(app: FastifyInstance, warehouseState: WarehouseState) {
  app.post<{ Body: PackOrderInput }>(
    "/api/v1/packing/confirm",
    {
      preHandler: requireRoles("admin", "manager", "packer")
    },
    async (request, reply) => {
      try {
        return await warehouseState.confirmPack(request.body, request.actor);
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
