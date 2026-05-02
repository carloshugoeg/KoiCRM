# koi-crm

White-label multitenant CRM. Cada tenant tiene su propia configuración de marca, pipeline, catálogos y campos personalizados. Diseñado para múltiples industrias; la plantilla inicial es **aquasistemas** (venta e instalación de filtros de agua).

## Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)
- Docker (para Postgres local)

## Quickstart

```bash
pnpm install
cp .env.example .env          # edita DATABASE_URL / NEXTAUTH_SECRET si hace falta
pnpm db:up                    # levanta Postgres 15 en Docker
pnpm db:migrate               # corre migraciones
pnpm dev                      # http://localhost:3000
```

## Scripts

| Script             | Descripción                                |
| ------------------ | ------------------------------------------ |
| `pnpm dev`         | Dev server con hot-reload                  |
| `pnpm build`       | Build de producción                        |
| `pnpm start`       | Sirve el build de producción               |
| `pnpm type-check`  | `tsc --noEmit` — zero errores requeridos   |
| `pnpm lint`        | ESLint sobre todo el código                |
| `pnpm lint:check`  | ESLint + Prettier check (usado en CI)      |
| `pnpm format`      | Prettier write                             |
| `pnpm test`        | Vitest run                                 |
| `pnpm test:watch`  | Vitest watch mode                          |
| `pnpm db:up`       | `docker compose up -d`                     |
| `pnpm db:down`     | `docker compose down`                      |
| `pnpm db:reset`    | Baja el volumen y reinicia Postgres limpio |
| `pnpm db:migrate`  | `prisma migrate dev`                       |
| `pnpm db:generate` | `prisma generate` (regenera el cliente)    |

## Documentación de planificación

Toda la planificación vive en `crm-core/` junto al código:

| Documento                                                            | Contenido                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------- |
| [DEMO_INVENTORY.md](./DEMO_INVENTORY.md)                             | Inventario completo de la demo de referencia          |
| [ARCHITECTURE_PLAN.md](./ARCHITECTURE_PLAN.md)                       | Stack, estructura, multitenancy, RLS, decisiones      |
| [IMPLEMENTATION_BACKLOG.md](./IMPLEMENTATION_BACKLOG.md)             | Backlog ejecutable M1–M10 con criterios de aceptación |
| [AGENT_RULES.md](./AGENT_RULES.md)                                   | Reglas operativas para agentes de código              |
| [DECISIONS_AND_OPEN_QUESTIONS.md](./DECISIONS_AND_OPEN_QUESTIONS.md) | Decisiones tomadas, pendientes y riesgos              |

## Arquitectura rápida

- **Next.js 14 App Router** + TypeScript strict
- **Tailwind CSS 3** + shadcn/ui (Radix primitives)
- **Prisma 6** + PostgreSQL 15 — schema declarativo, migraciones versionadas
- **Row Level Security** en Postgres — `app_user` sin BYPASSRLS, `admin_user` con BYPASSRLS
- **Auth.js v5** — sessions httpOnly, email + OAuth Google
- Multitenancy por `tenantSlug` en URL + `tenantId` en cada fila

Ver [ARCHITECTURE_PLAN.md](./ARCHITECTURE_PLAN.md) para el diseño completo.
