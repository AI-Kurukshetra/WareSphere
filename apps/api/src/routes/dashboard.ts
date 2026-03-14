import type { FastifyInstance } from "fastify";

import { apiRouteGroups } from "@wms/shared";

import { requireRoles } from "../auth.js";
import type { WarehouseState } from "../domain/warehouse-state.js";

export function registerDashboardRoutes(app: FastifyInstance, warehouseState: WarehouseState) {
  app.get(
    "/api/v1/dashboard",
    {
      preHandler: requireRoles("admin", "manager")
    },
    async () => ({
      metrics: await warehouseState.getDashboardMetrics(),
      generatedAt: new Date().toISOString()
    })
  );

  app.get("/api/v1/routes", () => ({
    groups: apiRouteGroups
  }));
}
