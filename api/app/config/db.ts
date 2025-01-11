import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";

const sqlite = new Database(
  process.env.NODE_ENV === "production"
    ? "/usr/src/app/data/db.sqlite"
    : "db.sqlite"
);

export const db = drizzle(sqlite, {
  schema,
});
