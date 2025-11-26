import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
	throw new Error("database url not found");
}

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
