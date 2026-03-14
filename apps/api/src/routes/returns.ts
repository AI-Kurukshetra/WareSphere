import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";

import { type InitiateReturnInput, type ProcessReturnInput } from "@wms/shared";

import { requireRoles } from "../auth.js";
import { type WarehouseState, WarehouseDomainError } from "../domain/warehouse-state.js";

export function registerReturnRoutes(app: FastifyInstance, warehouseState: WarehouseState) {
  app.get(
    "/api/v1/returns",
    {
      preHandler: requireRoles("admin", "manager", "receiver")
    },
    async () => ({
      returns: await warehouseState.listReturns()
    })
  );

  app.post<{ Body: InitiateReturnInput }>(
    "/api/v1/returns/initiate",
    {
      preHandler: requireRoles("admin", "manager", "receiver")
    },
    async (request, reply) => {
      try {
        return await warehouseState.createReturn(request.body, request.actor);
      } catch (error) {
        return sendKnownError(error, reply);
      }
    }
  );

  app.post<{ Body: ProcessReturnInput }>(
    "/api/v1/returns/process",
    {
      preHandler: requireRoles("admin", "manager", "receiver")
    },
    async (request, reply) => {
      try {
        return await warehouseState.processReturn(request.body, request.actor);
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
