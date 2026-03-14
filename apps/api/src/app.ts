import Fastify from "fastify";

import { registerAuthContext, type ActorResolver } from "./auth.js";
import { createDatabaseWarehouseState } from "./domain/database-warehouse-state.js";
import { createWarehouseState, type WarehouseState } from "./domain/warehouse-state.js";
import { registerCountRoutes } from "./routes/counts.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerInventoryRoutes } from "./routes/inventory.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { registerPackingRoutes } from "./routes/packing.js";
import { registerPickingRoutes } from "./routes/picking.js";
import { registerProductRoutes } from "./routes/products.js";
import { registerReceivingRoutes } from "./routes/receiving.js";
import { registerReturnRoutes } from "./routes/returns.js";
import { registerShipmentRoutes } from "./routes/shipments.js";
import { registerTaskRoutes } from "./routes/tasks.js";

type BuildAppOptions = {
  actorResolver?: ActorResolver;
  warehouseState?: WarehouseState;
};

export function buildApp(options: BuildAppOptions = {}) {
  const warehouseState = options.warehouseState ?? resolveWarehouseState();
  const app = Fastify({
    trustProxy: process.env.TRUST_PROXY !== "false",
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  if (options.actorResolver) {
    registerAuthContext(app, {
      actorResolver: options.actorResolver
    });
  } else {
    registerAuthContext(app);
  }

  app.get("/", () => ({
    name: "AIMaha Kruksetra WMS API",
    version: "0.1.0"
  }));

  registerHealthRoutes(app);
  registerDashboardRoutes(app, warehouseState);
  registerProductRoutes(app, warehouseState);
  registerInventoryRoutes(app, warehouseState);
  registerCountRoutes(app, warehouseState);
  registerOrderRoutes(app, warehouseState);
  registerTaskRoutes(app, warehouseState);
  registerPickingRoutes(app, warehouseState);
  registerPackingRoutes(app, warehouseState);
  registerReceivingRoutes(app, warehouseState);
  registerReturnRoutes(app, warehouseState);
  registerShipmentRoutes(app, warehouseState);

  return app;
}

function resolveWarehouseState() {
  if (process.env.WMS_STORAGE === "memory") {
    return createWarehouseState();
  }

  if (process.env.DATABASE_URL) {
    return createDatabaseWarehouseState();
  }

  return createWarehouseState();
}
