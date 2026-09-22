import { sql } from "drizzle-orm";
import { db } from "@/db";

let garantido: Promise<void> | null = null;

/**
 * Garante que as tabelas existam (espelha src/db/schema.ts).
 * Útil em ambientes novos onde `drizzle-kit push` ainda não foi executado.
 */
export function ensureSchema(): Promise<void> {
  if (!garantido) {
    garantido = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "estacoes" (
          "codigo" varchar(16) PRIMARY KEY NOT NULL,
          "nome" text NOT NULL,
          "tipo" varchar(20) NOT NULL,
          "municipio" text,
          "uf" text,
          "responsavel" text,
          "operadora" text,
          "rio" text,
          "latitude" double precision NOT NULL,
          "longitude" double precision NOT NULL,
          "altitude" double precision,
          "distancia_km" double precision NOT NULL,
          "telemetrica" boolean DEFAULT false NOT NULL,
          "pluviometro" boolean DEFAULT false NOT NULL,
          "climatologica" boolean DEFAULT false NOT NULL,
          "operando" boolean DEFAULT false NOT NULL,
          "periodo_inicio" date,
          "periodo_fim" date,
          "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
        )`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "cache_respostas" (
          "chave" text PRIMARY KEY NOT NULL,
          "dados" jsonb NOT NULL,
          "criado_em" timestamp with time zone DEFAULT now() NOT NULL
        )`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "consultas" (
          "id" serial PRIMARY KEY NOT NULL,
          "tipo" varchar(32) NOT NULL,
          "acao" varchar(16) DEFAULT 'consulta' NOT NULL,
          "estacoes" text NOT NULL,
          "descricao" text,
          "data_inicio" date NOT NULL,
          "data_fim" date NOT NULL,
          "registros" integer DEFAULT 0 NOT NULL,
          "criado_em" timestamp with time zone DEFAULT now() NOT NULL
        )`);
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "consultas_criado_em_idx" ON "consultas" USING btree ("criado_em")`,
      );
    })().catch((err) => {
      garantido = null;
      throw err;
    });
  }
  return garantido;
}
