import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/** Cache local do inventário de estações da ANA (Campo Bom e arredores). */
export const estacoes = pgTable("estacoes", {
  codigo: varchar("codigo", { length: 16 }).primaryKey(),
  nome: text("nome").notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull(),
  municipio: text("municipio"),
  uf: text("uf"),
  responsavel: text("responsavel"),
  operadora: text("operadora"),
  rio: text("rio"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  altitude: doublePrecision("altitude"),
  distanciaKm: doublePrecision("distancia_km").notNull(),
  telemetrica: boolean("telemetrica").notNull().default(false),
  pluviometro: boolean("pluviometro").notNull().default(false),
  climatologica: boolean("climatologica").notNull().default(false),
  operando: boolean("operando").notNull().default(false),
  periodoInicio: date("periodo_inicio"),
  periodoFim: date("periodo_fim"),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
});

/** Cache das respostas das APIs externas (ANA / Open-Meteo), já normalizadas. */
export const cacheRespostas = pgTable("cache_respostas", {
  chave: text("chave").primaryKey(),
  dados: jsonb("dados").$type<unknown>().notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

/** Histórico de consultas e exportações realizadas na plataforma. */
export const consultas = pgTable(
  "consultas",
  {
    id: serial("id").primaryKey(),
    tipo: varchar("tipo", { length: 32 }).notNull(),
    acao: varchar("acao", { length: 16 }).notNull().default("consulta"),
    estacoes: text("estacoes").notNull(),
    descricao: text("descricao"),
    dataInicio: date("data_inicio").notNull(),
    dataFim: date("data_fim").notNull(),
    registros: integer("registros").notNull().default(0),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("consultas_criado_em_idx").on(t.criadoEm)],
);
