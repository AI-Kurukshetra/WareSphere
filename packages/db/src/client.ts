import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

let database: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (database) {
    return database;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be defined before creating a database client.");
  }

  const client = postgres(process.env.DATABASE_URL, { max: 5, prepare: false });
  database = drizzle(client, { schema });

  return database;
}
