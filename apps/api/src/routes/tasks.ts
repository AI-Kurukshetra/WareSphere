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

  app.get(
    "/api/v1/tasks/picking",
    {
      preHandler: requireRoles("admin", "manager", "picker", "packer")
    },
    async () => ({
      tasks: await warehouseState.listPickingTasks()
    })
  );

  app.get(
    "/api/v1/tasks/packing",
    {
      preHandler: requireRoles("admin", "manager", "packer")
    },
    async () => ({
      tasks: await warehouseState.listPackingTasks()
    })
  );

  app.get(
    "/api/v1/tasks/counting",
    {
      preHandler: requireRoles("admin", "manager", "receiver")
    },
    async () => ({
      tasks: await warehouseState.listCountTasks()
    })
  );
}
