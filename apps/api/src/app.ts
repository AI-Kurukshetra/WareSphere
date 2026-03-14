import Fastify from "fastify";

import { registerAuthContext, type ActorResolver } from "./auth.js";
import { createDatabaseWarehouseState } from "./domain/database-warehouse-state.js";
import { createWarehouseState, type WarehouseState } from "./domain/warehouse-state.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerInventoryRoutes } from "./routes/inventory.js";
import { registerProductRoutes } from "./routes/products.js";
import { registerReceivingRoutes } from "./routes/receiving.js";
import { registerTaskRoutes } from "./routes/tasks.js";

type BuildAppOptions = {
  actorResolver?: ActorResolver;
  warehouseState?: WarehouseState;
};

export function buildApp(options: BuildAppOptions = {}) {
  const warehouseState = options.warehouseState ?? resolveWarehouseState();
  const app = Fastify({
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
  registerTaskRoutes(app, warehouseState);
  registerReceivingRoutes(app, warehouseState);

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
