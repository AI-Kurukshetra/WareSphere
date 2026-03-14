import type { FastifyInstance } from "fastify";

import { requireRoles } from "../auth.js";
import type { WarehouseState } from "../domain/warehouse-state.js";

export function registerProductRoutes(app: FastifyInstance, warehouseState: WarehouseState) {
  app.get(
    "/api/v1/products",
    {
      preHandler: requireRoles("admin", "manager")
    },
    async () => ({
      products: await warehouseState.listProducts()
    })
  );
}
