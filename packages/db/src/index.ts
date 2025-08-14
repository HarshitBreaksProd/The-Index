import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Please define it (e.g., in apps/server/.env)"
  );
}

const sql = neon(connectionString);
export const db = drizzle(sql);
