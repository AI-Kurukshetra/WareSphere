import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../../.env.local" });
config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_MIGRATION_URL or DATABASE_URL is required for Drizzle operations.");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "../../supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl
  }
});
