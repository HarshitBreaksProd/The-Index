import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Please define it (e.g., in apps/server/.env)"
  );
}

const pool = new Pool({ connectionString });
export const db = drizzle(pool);
