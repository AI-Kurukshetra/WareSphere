import type { FastifyInstance } from "fastify";

import { requireRoles } from "../auth.js";
import type { WarehouseState } from "../domain/warehouse-state.js";

export function registerTaskRoutes(app: FastifyInstance, warehouseState: WarehouseState) {
  app.get(
    "/api/v1/tasks/receiving",
    {
      preHandler: requireRoles("admin", "manager", "receiver")
    },
    async () => ({
      tasks: await warehouseState.listReceivingTasks()
    })
  );
}
