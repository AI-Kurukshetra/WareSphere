import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";

import { type ConfirmCountInput, type ReleaseCountTaskInput } from "@wms/shared";

import { requireRoles } from "../auth.js";
import { type WarehouseState, WarehouseDomainError } from "../domain/warehouse-state.js";

export function registerCountRoutes(app: FastifyInstance, warehouseState: WarehouseState) {
  app.post<{ Body: ReleaseCountTaskInput }>(
    "/api/v1/counts/release",
    {
      preHandler: requireRoles("admin", "manager")
    },
    async (request, reply) => {
      try {
        return await warehouseState.releaseCountTask(request.body, request.actor);
      } catch (error) {
        return sendKnownError(error, reply);
      }
    }
  );

  app.post<{ Body: ConfirmCountInput }>(
    "/api/v1/counts/confirm",
    {
      preHandler: requireRoles("admin", "manager", "receiver")
    },
    async (request, reply) => {
      try {
        return await warehouseState.confirmCount(request.body, request.actor);
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
