import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

/**
 * SSL é ativado automaticamente para bancos hospedados (Render, Neon, Supabase, etc.)
 * ou quando DATABASE_SSL=true / sslmode=require. Localmente (127.0.0.1) fica desligado.
 */
function configurarSsl(url: string): PoolConfig["ssl"] {
  if (process.env.DATABASE_SSL === "false") return undefined;
  const hospedado = /render\.com|neon\.tech|supabase\.(co|com)|amazonaws\.com|azure\.com|railway\.app|sslmode=require/i.test(
    url,
  );
  if (process.env.DATABASE_SSL === "true" || hospedado) return { rejectUnauthorized: false };
  return undefined;
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: configurarSsl(databaseUrl),
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
