import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", () => ({
    status: "ok",
    service: "@wms/api",
    timestamp: new Date().toISOString()
  }));
}
