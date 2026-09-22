# Pluviometria de Campo Bom e região — dados ANA

Plataforma Next.js (App Router) + PostgreSQL (Drizzle ORM) que consulta a API pública da ANA
(inventário de estações, telemetria e séries históricas de chuva) e o Open-Meteo (temperatura
histórica), com exportação em CSV.

## Rodando localmente

```bash
cp .env.example .env      # ajuste DATABASE_URL
npm install
npm run db:push           # cria as tabelas (opcional: a app também cria ao iniciar)
npm run dev
```

## Deploy no Render

### Opção 1 — Blueprint (recomendado)

O arquivo `render.yaml` já descreve o banco e o serviço web.

1. Suba o projeto para um repositório no GitHub/GitLab (o `.env` é ignorado pelo Git).
2. No Render: **New +** → **Blueprint** → selecione o repositório → **Apply**.
3. Aguarde o deploy. O health check em `/api/health` confirma que a app subiu e falou com o banco.

### Opção 2 — configuração manual

**1. Banco de dados:** New + → **PostgreSQL** → nome `pluviometria-db` → Create. Copie a **Internal Database URL**.

**2. Serviço web:** New + → **Web Service** → conecte o repositório e preencha:

| Campo | Valor |
| --- | --- |
| **Language / Runtime** | `Node` |
| **Build Command** | `npm ci && npm run build` |
| **Start Command** | `npm run start` |
| **Health Check Path** | `/api/health` |

**3. Environment Variables** (aba *Environment*):

| Chave | Valor |
| --- | --- |
| `DATABASE_URL` | Internal Database URL copiada no passo 1 |
| `DATABASE_SSL` | `true` |
| `NODE_VERSION` | `22` |

Não é preciso definir `PORT`: o Render injeta a variável e o `next start` a utiliza automaticamente.

**4. Tabelas:** são criadas automaticamente na primeira requisição (`src/db/ensure.ts`).
Se preferir criar antes, rode `npm run db:push` com `DATABASE_URL` apontando para a
**External Database URL** do Render.

### Observações

- No plano gratuito o serviço "dorme" após 15 min sem acesso; a primeira requisição seguinte
  demora ~30–60 s. O banco gratuito do Render expira após 90 dias (faça upgrade ou recrie).
- A API da ANA (`telemetriaws1.ana.gov.br`) é acessada via HTTP a partir do servidor; se o Render
  bloquear ou a ANA mudar o endereço, ajuste `ANA_BASE_URL`.

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | ambiente de desenvolvimento |
| `npm run build` | build de produção |
| `npm run start` | inicia o servidor de produção |
| `npm run db:push` | aplica o schema Drizzle no banco de `DATABASE_URL` |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
