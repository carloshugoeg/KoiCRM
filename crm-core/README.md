# koi-crm

White-label multitenant CRM. Cada tenant tiene su propia configuración de marca, pipeline, catálogos y campos personalizados. Diseñado para múltiples industrias; la plantilla inicial es **aquasistemas** (venta e instalación de filtros de agua).

## Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)
- Docker (para Postgres local)

## Quickstart

```bash
pnpm install
cp .env.example .env          # edita DATABASE_URL / AUTH_SECRET si hace falta
pnpm db:up                    # levanta Postgres 15 en Docker
pnpm db:migrate               # corre migraciones
pnpm dev                      # http://localhost:3000
pnpm seed:test                # espacio de prueba (opcional, ver abajo)
```

### Espacio de trabajo de prueba

Para probar sin pasar por onboarding ni cargar el demo completo de Aquasistemas:

```bash
pnpm seed:test
```

| Campo    | Valor              |
| -------- | ------------------ |
| Email    | `admin@test.local` |
| Password | `Test1234!`        |
| Slug     | `test`             |
| URL      | `/app/test/pipeline` |

El script es idempotente: vuelve a crear el tenant `test` y el usuario admin si ya existían.

### Google Sign-In (opcional)

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un cliente OAuth **Web** con redirect:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://<tu-dominio>/api/auth/callback/google` (prod; debe coincidir con `AUTH_URL`)
2. En `.env` / `.env.local`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Sin esas variables, los botones de Google no aparecen. Tras el primer login con Google, los usuarios sin tenant van a `/app/onboarding` para crear su espacio de trabajo.

### Persistencia de datos (importante en local)

Tu cuenta de Google identifica **quién eres** (`User`), no dónde viven tus datos. Los deals, clientes y catálogos pertenecen a un **espacio de trabajo** (`Tenant`) enlazado por `Membership`. La URL `/app/{slug}/...` indica qué tenant estás viendo.

| Acción | ¿Borra tus datos? |
| ------ | ----------------- |
| Reiniciar `pnpm dev` / `npm run dev` | No |
| Cerrar sesión y volver a entrar con Google | No |
| `pnpm db:down` + `pnpm db:up` | No |
| `pnpm db:reset` o `docker compose down -v` | **Sí — borra todo** |

Los datos locales viven en el volumen Docker `pgdata`. Si ese volumen se elimina, aunque entres otra vez con el mismo Google, pasarás por onboarding y tendrás un tenant vacío. Para comprobar el estado:

```bash
docker compose exec -T postgres psql -U postgres -d koicrm -c \
  "SELECT t.slug, COUNT(d.id) AS deals FROM \"Tenant\" t
   LEFT JOIN \"Deal\" d ON d.\"tenantId\" = t.id GROUP BY t.id;"
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
| `pnpm db:reset`    | **Destructivo:** borra el volumen `pgdata` y reinicia Postgres vacío (pide confirmación) |
| `pnpm db:migrate`  | `prisma migrate dev`                       |
| `pnpm db:generate` | `prisma generate` (regenera el cliente)    |
| `pnpm seed:test`   | Tenant `test` + admin para desarrollo local |
| `pnpm seed:demo`   | Demo Aquasistemas con deals de muestra      |

## Documentación de planificación

Toda la planificación vive en `crm-core/` junto al código:

| Documento                                                            | Contenido                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------- |
| [DEMO_INVENTORY.md](./DEMO_INVENTORY.md)                             | Inventario completo de la demo de referencia          |
| [ARCHITECTURE_PLAN.md](./ARCHITECTURE_PLAN.md)                       | Stack, estructura, multitenancy, RLS, decisiones      |
| [IMPLEMENTATION_BACKLOG.md](./IMPLEMENTATION_BACKLOG.md)             | Backlog ejecutable M1–M10 con criterios de aceptación |
| [V2_BACKLOG.md](./V2_BACKLOG.md)                                     | Post-V1: correcciones y features de segunda iteración |
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
