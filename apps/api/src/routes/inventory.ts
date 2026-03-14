import type { FastifyInstance } from "fastify";

import { requireRoles } from "../auth.js";
import type { WarehouseState } from "../domain/warehouse-state.js";

export function registerInventoryRoutes(app: FastifyInstance, warehouseState: WarehouseState) {
  app.get(
    "/api/v1/inventory",
    {
      preHandler: requireRoles("admin", "manager")
    },
    async () => ({
      records: await warehouseState.listInventory()
    })
  );
}
