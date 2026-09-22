// Configuração do drizzle-kit para ambientes hospedados (lê DATABASE_URL do ambiente).
// Uso: npm run db:push   (o arquivo drizzle.config.json continua sendo usado no sandbox local)
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url },
});
