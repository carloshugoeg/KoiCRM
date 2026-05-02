# ARCHITECTURE_PLAN.md

Arquitectura completa del CRM real `crm-core/`: white label, multitenant, modular, escalable, adaptable a múltiples industrias, con caso aquasistemas como plantilla de referencia para V1.

Este documento se lee **junto** con `DEMO_INVENTORY.md` (qué) y se ejecuta vía `IMPLEMENTATION_BACKLOG.md` (cómo y cuándo).

---

## 1. Stack y justificación

| Capa                | Elección                                                                           | Por qué                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend + backend  | **Next.js 14 (App Router) + TypeScript strict**                                    | RSC reduce JS al cliente; Server Actions evitan boilerplate de API; un solo build, un solo deploy.                                                     |
| Estilos             | **Tailwind CSS 3 + shadcn/ui (Radix)**                                             | Productividad alta, componentes accesibles. NO se copia código del demo; shadcn instala primitives en el repo.                                         |
| Charts              | **Recharts**                                                                       | Mismo motor que el demo, librería pública; sólo se usa la API, no se porta código.                                                                     |
| Form / validación   | **React Hook Form + Zod**                                                          | Schemas Zod compartidos entre client y server.                                                                                                         |
| ORM / DB            | **Prisma + PostgreSQL 15+**                                                        | Schema declarativo, migraciones versionadas. RLS en Postgres es nativo.                                                                                |
| Auth                | **Auth.js v5 (NextAuth)**                                                          | Sessions con cookies httpOnly, providers email + OAuth Google, soporta MFA y RBAC propio. Clerk queda documentado como swap-in si se prefiere managed. |
| Object storage      | **S3-compatible (R2 default)**                                                     | Uploads firmados, sin pasar binarios por la app.                                                                                                       |
| Email transaccional | **Resend** (default), Postmark/SES alternativos                                    | Para invitaciones, password reset, alertas.                                                                                                            |
| Logger              | **pino** + correlación por requestId                                               | Liviano, JSON-first.                                                                                                                                   |
| Tests               | **Vitest** (unit), **Postgres real en Docker** (integration), **Playwright** (E2E) | RLS sólo se valida con Postgres real.                                                                                                                  |
| Drag & drop         | **@dnd-kit/core**                                                                  | Accesible (keyboard sensor), liviano, no requiere react-beautiful-dnd.                                                                                 |
| Toasts              | **sonner**                                                                         | Stack-friendly, accesible.                                                                                                                             |
| Date utils          | **date-fns** + `Intl.DateTimeFormat` con `es-GT`                                   | TZ explícito por tenant.                                                                                                                               |
| Currency            | `Intl.NumberFormat(locale, {style:'currency', currency})`                          | Por tenant.                                                                                                                                            |
| Lint / format       | **ESLint + Prettier**                                                              | Pre-commit con `lint-staged`.                                                                                                                          |
| Package manager     | **pnpm**                                                                           | Espacio en disco, monorepo-friendly si más adelante.                                                                                                   |
| Node version        | LTS actual (20+)                                                                   | Soporta server actions y stream APIs.                                                                                                                  |

**Lo que NO se usa**: localforage, Express, persistencia en JSON file, base64 para imágenes en DB, Redux global, react-beautiful-dnd, zustand global. Cada uno tiene un reemplazo arriba.

---

## 2. Estructura de carpetas

```
crm-core/
├── app/                              # Next.js App Router
│   ├── (marketing)/                  # landing pública
│   │   └── page.tsx
│   ├── (auth)/                       # /signin /signup /forgot /reset
│   │   ├── signin/
│   │   ├── signup/
│   │   └── reset/
│   ├── app/                          # área autenticada
│   │   ├── layout.tsx                # auth guard + layout base
│   │   ├── (onboarding)/             # crear primer tenant, elegir industria
│   │   └── [tenantSlug]/
│   │       ├── layout.tsx            # tenant resolver + RLS context + branding
│   │       ├── pipeline/
│   │       ├── clients/[clientId]/
│   │       ├── calendar/
│   │       ├── archive/
│   │       ├── stats/
│   │       └── settings/
│   │           ├── appearance/
│   │           ├── users/
│   │           ├── catalogs/         # equipment, channels, status, fu-reasons
│   │           ├── pipeline/
│   │           └── custom-fields/
│   ├── api/                          # route handlers
│   │   ├── auth/[...nextauth]/
│   │   ├── upload/                   # firmar URLs S3
│   │   └── webhooks/
│   └── globals.css
├── components/                       # UI primitives + composites compartidos
│   ├── ui/                           # shadcn primitives
│   ├── data-table/
│   ├── kanban/
│   ├── calendar/
│   └── charts/
├── features/                         # dominios verticales
│   ├── deals/
│   │   ├── actions.ts                # server actions (mutaciones)
│   │   ├── queries.ts                # data access (con tenant scope)
│   │   ├── schemas.ts                # zod
│   │   ├── policies.ts               # RBAC checks
│   │   ├── components/
│   │   └── __tests__/
│   ├── clients/
│   ├── pipeline/
│   ├── follow-ups/
│   ├── quotes/
│   ├── payments/
│   ├── attachments/
│   ├── calendar/
│   ├── stats/
│   ├── branding/
│   ├── catalogs/
│   ├── custom-fields/
│   ├── users/
│   └── tenants/
├── lib/
│   ├── db/                           # prisma client + helpers
│   │   ├── client.ts
│   │   └── rls.ts                    # withTenant() helper
│   ├── auth/                         # auth.ts, middlewares, session helpers
│   ├── tenant/                       # resolveTenant(), tenant context
│   ├── industry/                     # registry de plantillas
│   ├── config/                       # custom-fields engine, dynamic schemas
│   ├── storage/                      # S3 sign helpers
│   ├── email/                        # resend wrapper
│   ├── logging/                      # pino
│   ├── id/                           # generadores (deal id, slug)
│   └── intl/                         # locale/currency helpers por tenant
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   │   └── 000001_init/
│   │       ├── migration.sql
│   │       └── rls.sql               # policies SQL crudas
│   └── seed/
│       ├── core.ts                   # data mínima cross-tenant
│       ├── industry-aquasistemas.ts  # plantilla aplicable a un tenant
│       └── demo-aquasistemas.ts      # tenant demo poblado
├── tests/
│   ├── unit/
│   ├── integration/                  # Postgres real
│   │   └── rls.test.ts               # garantiza aislamiento
│   └── e2e/                          # Playwright
├── docs/
│   └── adr/                          # ADRs cuando se desvíen del plan
├── public/
├── scripts/                          # utilities (db reset, seed runners)
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
└── vitest.config.ts
```

**Convenciones**:

- Cada feature en `features/*` es autónoma: queries, actions, schemas, policies, componentes, tests.
- Componentes de `components/*` son agnósticos de dominio.
- `lib/*` es plumbing puro (sin lógica de dominio).

---

## 3. Capas del sistema

```
UI (RSC + client components puntuales)
   │
   ▼
Server Actions / Route Handlers      ← Zod input + RBAC + tenant guard
   │
   ▼
Feature services (features/*)         ← lógica de negocio
   │
   ▼
Repositorios / queries (Prisma)       ← withTenant() + scope por tenantId
   │
   ▼
PostgreSQL                            ← RLS como segunda línea
```

**Reglas**:

- Nunca llamar Prisma desde un componente directo. Pasar por `features/<x>/queries.ts` o `actions.ts`.
- Toda action/query autenticada se ejecuta dentro de `withTenant(tenantId, fn)` que setea `app.tenant_id` en una transacción Postgres y la RLS filtra.
- Nunca asumir tenant del cliente. Resolver server-side desde session + slug URL.

---

## 4. Modelo multitenant

### 4.1 Entidades de identidad

```prisma
model Tenant {
  id          String   @id @default(cuid())
  slug        String   @unique          // "acme"
  name        String
  industrySlug String?                  // "aquasistemas"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  branding    TenantBranding?
  settings    TenantSettings?
  memberships Membership[]
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?
  password  String?  // si email+password; null si OAuth-only
  emailVerified DateTime?
  createdAt DateTime @default(now())
  memberships Membership[]
}

enum Role { OWNER ADMIN MEMBER VIEWER }

model Membership {
  id        String   @id @default(cuid())
  userId    String
  tenantId  String
  role      Role
  createdAt DateTime @default(now())
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant    Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([userId, tenantId])
  @@index([tenantId])
}
```

### 4.2 Resolver de tenant

- **Estrategia primaria**: segmento de URL `/app/[tenantSlug]/*`. Slug se valida en `app/app/[tenantSlug]/layout.tsx` resolviendo a `Tenant.id` y verificando que la sesión tiene `Membership` activa.
- **Subdominio opcional**: `acme.koicrm.com` → middleware reescribe a `/app/acme/...`. Activable post-V1.
- **Switching de tenant**: si el usuario tiene varios memberships, UI ofrece dropdown. La elección actualiza la URL.

### 4.3 RLS (Row Level Security)

- Cada tabla de negocio tiene `tenantId` (FK a `Tenant`, NOT NULL, indexado).
- Migración SQL cruda activa RLS en cada tabla:
  ```sql
  ALTER TABLE "Deal" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "Deal"
    USING ("tenantId" = current_setting('app.tenant_id')::text);
  ```
- En cada request autenticada:
  ```ts
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
  ```
- El cliente Prisma usa un usuario sin `BYPASSRLS`. Migraciones corren con un usuario admin separado.

### 4.4 Cross-tenant operations

Permitidas sólo en código superuser (admin del SaaS), nunca expuesto en la UI de tenant. Marcado con `// SUPERUSER:` y excluido del flujo normal.

---

## 5. Modelo de autorización (RBAC)

| Rol      | Permisos                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| `OWNER`  | Todo lo del tenant + transferir/eliminar tenant + facturación.                                                 |
| `ADMIN`  | Todo excepto borrar tenant: settings, branding, catálogos, custom fields, invitar/remover usuarios (no OWNER). |
| `MEMBER` | CRUD de deals/clients/follow-ups/quotes/payments suyos y compartidos; lectura completa del tenant.             |
| `VIEWER` | Sólo lectura.                                                                                                  |

- Verificación en **dos lugares**: server action (defensa en profundidad) y query (filtro). RLS garantiza el aislamiento de tenant; RBAC es a nivel app.
- Helper `requireRole(action, role)` lanza si no cumple.
- Per-feature: `features/<x>/policies.ts` exporta `canCreate`, `canEdit`, `canDelete`, `canView` que reciben `(session, tenant, resource)`.

---

## 6. White label / branding

```prisma
model TenantBranding {
  tenantId          String   @id
  logoUrl           String?  // S3 URL
  primaryColor      String?  // hex
  bgColorLight      String?
  bgColorDark       String?
  bgImageUrl        String?
  headerBgColor     String?
  kpiBgColor        String?
  productName       String?  // overrides "AquaCRM"
  tenant            Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model TenantSettings {
  tenantId       String  @id
  locale         String  @default("es-GT")
  currency       String  @default("GTQ")
  timezone       String  @default("America/Guatemala")
  phoneFormat    String  @default("XXXX-XXXX")
  whatsappCountryCode String @default("+502")
  dealIdPrefix   String  @default("DEAL")
  dealIdYearDigits Int   @default(2) // 2 o 4
  defaultPipelineId String?
  tenant         Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

- `app/app/[tenantSlug]/layout.tsx` carga branding una vez y lo expone vía `TenantBrandingProvider`.
- Tailwind variables CSS se setean en root via inline style; tema dark/light decide variantes.
- Logo URL pasa a `<Image>` con `next/image`.

---

## 7. Modelo de datos adaptable

### 7.1 Tablas core fuertes

```
Tenant, User, Membership, TenantBranding, TenantSettings  ─ identidad / config
Pipeline, PipelineStage                                    ─ flujo de ventas
Deal, DealEquipment (M-N)                                  ─ oportunidad
Client                                                     ─ persona+empresa única por tenant
Quote, Payment, Attachment                                 ─ documentos por deal
FollowUp, Note                                             ─ operación
Activity                                                   ─ audit log
CatalogItem                                                ─ catálogos genéricos
CustomFieldDefinition                                       ─ schema dinámico
SavedView                                                  ─ vistas guardadas
IndustryTemplate                                            ─ plantillas
Counter                                                     ─ secuencias por tenant (deal id)
```

### 7.2 Custom fields (estrategia híbrida)

```prisma
model CustomFieldDefinition {
  id          String   @id @default(cuid())
  tenantId    String
  entity      String   // "Deal" | "Client" | "Quote" | "Payment"
  key         String   // snake_case, único por (tenant, entity)
  label       String
  type        String   // "text" | "number" | "date" | "select" | "multiselect" | "boolean" | "url"
  options     Json?    // para select/multiselect
  required    Boolean  @default(false)
  order       Int      @default(0)
  metadata    Json?
  createdAt   DateTime @default(now())
  @@unique([tenantId, entity, key])
  @@index([tenantId, entity])
}
```

Cada tabla extensible (Deal, Client, Quote, Payment) tiene `customData Json?`. Validación:

- `lib/config/custom-fields.ts` deriva un `Zod.object({ ... })` desde las definitions vigentes.
- Server actions validan input contra ese schema antes de persistir.
- Limites V1: sin relaciones entre custom fields, sin fórmulas, sin validaciones server-side custom (más allá de tipo).

### 7.3 Pipelines configurables

```prisma
model Pipeline {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  isDefault Boolean  @default(false)
  stages    PipelineStage[]
  @@index([tenantId])
}

model PipelineStage {
  id          String   @id @default(cuid())
  tenantId    String
  pipelineId  String
  order       Int
  key         String   // "prospecto"
  label       String
  sublabel    String?
  color       String
  iconKey     String   // mapping a lucide
  locked      Boolean  @default(false)
  pipeline    Pipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  @@unique([pipelineId, key])
  @@index([tenantId])
}
```

V1: cada tenant tiene un pipeline default (creado por la plantilla de industria). Multi-pipeline → Post-V1 (decisión-pendiente).

### 7.4 Catálogos genéricos

```prisma
model CatalogItem {
  id         String   @id @default(cuid())
  tenantId   String
  catalogKey String   // "equipment" | "salesChannel" | "dealStatus" | "followupReason"
  key        String   // estable, ej "bomba" o "whatsapp"
  label      String
  color      String?
  iconKey    String?
  metadata   Json?
  order      Int      @default(0)
  active     Boolean  @default(true)
  @@unique([tenantId, catalogKey, key])
  @@index([tenantId, catalogKey])
}
```

Reemplaza `sf-equipment`, `sf-channels`, `STATUS_OPTIONS`, `FU_REASONS`. Cada catálogo es renderizable y administrable desde Settings → Catálogos.

### 7.5 Deal core + relaciones

```prisma
model Deal {
  id              String   @id                          // "DEAL-0032-RO-26"
  tenantId        String
  pipelineId      String
  stageId         String
  clientId        String?
  ownerId         String                                  // collaborator/User asignado
  channelKey      String                                  // referencia a CatalogItem(catalogKey="salesChannel")
  statusKey       String                                  // CatalogItem(catalogKey="dealStatus")
  name            String
  company         String?
  phone           String?
  whatsapp        String?
  email           String?
  value           Decimal  @db.Decimal(14,2)             // moneda almacenada en unidades enteras de currency del tenant
  isArchived      Boolean  @default(false)
  customData      Json?
  createdAt       DateTime @default(now())
  stageEnteredAt  DateTime @default(now())
  updatedAt       DateTime @updatedAt
  client          Client?  @relation(fields: [clientId], references: [id])
  pipeline        Pipeline @relation(fields: [pipelineId], references: [id])
  stage           PipelineStage @relation(fields: [stageId], references: [id])
  owner           User    @relation(fields: [ownerId], references: [id])
  equipment       DealEquipment[]
  quotes          Quote[]
  payments        Payment[]
  followUps       FollowUp[]
  notes           Note[]
  activities      Activity[]
  attachments     Attachment[]
  @@index([tenantId, isArchived])
  @@index([tenantId, stageId])
  @@index([tenantId, ownerId])
  @@index([tenantId, clientId])
}

model DealEquipment {
  dealId        String
  equipmentKey  String     // CatalogItem.key
  customLabel   String?    // si equipo no está en catálogo
  deal          Deal @relation(fields:[dealId], references:[id], onDelete: Cascade)
  @@id([dealId, equipmentKey])
}
```

### 7.6 Client

```prisma
model Client {
  id         String   @id @default(cuid())
  tenantId   String
  name       String
  company    String?
  phone      String?
  whatsapp   String?
  email      String?
  notes      String?  // notas globales (lo que el demo guardaba en ClientOverride)
  customData Json?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  deals      Deal[]
  @@unique([tenantId, name, company])
  @@index([tenantId])
}
```

Lookup canónico por `(name, company)` (lowercase, trimmed). Detect-or-create al crear deal.

### 7.7 Quote / Payment / Attachment

```prisma
model Quote {
  id        String   @id @default(cuid())
  tenantId  String
  dealId    String
  number    String
  date      DateTime
  fileUrl   String?  // S3 URL
  isVoid    Boolean  @default(false)
  customData Json?
  createdAt DateTime @default(now())
  deal      Deal @relation(fields:[dealId], references:[id], onDelete: Cascade)
  @@index([tenantId, dealId])
}

model Payment {
  id        String   @id @default(cuid())
  tenantId  String
  dealId    String
  number    String   // "FAC-912" / "REC-105"
  date      DateTime
  fileUrl   String?
  isVoid    Boolean  @default(false)
  customData Json?
  createdAt DateTime @default(now())
  deal      Deal @relation(fields:[dealId], references:[id], onDelete: Cascade)
  @@index([tenantId, dealId])
}

model Attachment {
  id        String   @id @default(cuid())
  tenantId  String
  dealId    String?
  clientId  String?
  url       String
  mimeType  String
  size      Int
  createdAt DateTime @default(now())
  @@index([tenantId, dealId])
}
```

### 7.8 FollowUp / Note

```prisma
model FollowUp {
  id          String   @id @default(cuid())
  tenantId    String
  dealId      String
  date        DateTime               // sólo fecha (00:00 local), comparada al noon
  reasonKey   String                  // CatalogItem(catalogKey="followupReason")
  result      String?
  completed   Boolean  @default(false)
  completedAt DateTime?
  createdById String?
  createdAt   DateTime @default(now())
  deal        Deal @relation(fields:[dealId], references:[id], onDelete: Cascade)
  @@index([tenantId, dealId])
  @@index([tenantId, completed, date])
}

model Note {
  id        String   @id @default(cuid())
  tenantId  String
  dealId    String?
  clientId  String?
  text      String
  createdById String?
  createdAt DateTime @default(now())
  @@index([tenantId, dealId])
  @@index([tenantId, clientId])
}
```

### 7.9 Activity (audit log)

```prisma
model Activity {
  id        String   @id @default(cuid())
  tenantId  String
  entity    String   // "Deal" | "Client" | …
  entityId  String
  type      String   // "created" | "stageChanged" | "valueChanged" | …
  payload   Json
  userId    String?
  createdAt DateTime @default(now())
  @@index([tenantId, entity, entityId])
  @@index([tenantId, createdAt])
}
```

### 7.10 SavedView (vistas guardadas)

```prisma
model SavedView {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String?  // null = compartida con todo el tenant
  entity    String   // "Deal" | "Client"
  name      String
  config    Json     // { filters, sort, columns, layout }
  createdAt DateTime @default(now())
  @@index([tenantId, entity])
}
```

### 7.11 IndustryTemplate

```prisma
model IndustryTemplate {
  slug      String   @id        // "aquasistemas"
  name      String
  version   Int
  payload   Json                 // catálogos, pipeline, custom fields, branding default
  createdAt DateTime @default(now())
}
```

Aplicado al onboarding de un tenant: `applyIndustryTemplate(tenantId, slug)` materializa Pipeline + PipelineStages + CatalogItems + CustomFieldDefinitions + Branding default.

### 7.12 Counter (secuencias por tenant)

```prisma
model Counter {
  tenantId String
  key      String   // "deal"
  value    Int      @default(0)
  @@id([tenantId, key])
}
```

Generación de Deal.id: en transacción incrementar y formatear `{prefix}-{counter:0000}-{ownerInitials}-{YYYY|YY}`.

---

## 8. Estrategia de migraciones

- Prisma Migrate en modo `migrate dev` (local) y `migrate deploy` (CI/prod).
- Naming: `YYYYMMDDHHMM_descripcion`.
- Cada migración estructural genera un `migration.sql`.
- RLS policies viven en `migration.sql` (no en `schema.prisma`). Cada tabla nueva agrega `ALTER TABLE … ENABLE RLS` + policy en la misma migración.
- DB de tests usa `prisma migrate deploy` antes de la suite, sobre Postgres en Docker (`testcontainers`).

---

## 9. Estrategia de seeds

| Seed                            | Cuándo                                                   | Contenido                                                                                                                                               |
| ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seed/core.ts`                  | Bootstrap inicial (dev y demo).                          | `IndustryTemplate(slug=aquasistemas)`. En dev: usuario admin `dev@local`. NUNCA en prod.                                                                |
| `seed/industry-aquasistemas.ts` | Aplicada en onboarding cuando un tenant elige industria. | Pipeline default 6 stages, CatalogItems para equipment/channels/status/followupReason, branding default (colores AquaCRM), `dealIdPrefix=AQX`.          |
| `seed/demo-aquasistemas.ts`     | Comando opcional `pnpm seed:demo`.                       | Tenant "demo-aqua", usuario owner demo, 4 colaboradores (Roberto/Emanuel/Jhonatan/Leticia), 30 deals representativos sin imágenes, follow-ups variados. |

Todo seed reproducible (idempotente). Datos demo siempre marcados con flag (`Tenant.slug` empieza con `demo-`). Nunca usados como persistencia real.

---

## 10. API / backend

- **Server Actions** (`features/<x>/actions.ts`) para mutaciones intra-app: validan input con Zod, verifican RBAC, ejecutan dentro de `withTenant()`, registran `Activity`, devuelven `{ ok, data | error }`.
- **Route Handlers** (`app/api/*`) para:
  - `auth/[...nextauth]` (Auth.js).
  - `upload/sign` — firma URL de S3 para upload directo.
  - `webhooks/*` — futuros (Stripe, email, etc.).
- Sin API REST pública en V1. Si más adelante hace falta, se expone con un endpoint `api/v1/*` y autenticación por API key + tenant.

---

## 11. Frontend

- **RSC por defecto**. Client components (`"use client"`) sólo donde se requiera estado interactivo: kanban DnD, filtros con datepicker, modales con form complejo, calendario.
- **Patrones por vista**:
  - Pipeline → server fetches deals filtrados, client component recibe lista y maneja DnD optimista. On drop, server action `moveDeal({dealId, toStageId})` + `revalidatePath`.
  - Clientes → server fetches lista; sidebar es client (búsqueda) recibiendo data inicial; ficha se carga vía nested route `[clientId]`.
  - Calendario → server fetches follow-ups del mes; grid puede ser server-rendered con interactividad mínima client-side.
  - Estadísticas → server agrega métricas (consultas SQL); charts en client components consumen JSON.
- **Loading / error**: convención de `loading.tsx` y `error.tsx` por route segment.
- **Notificaciones**: `sonner` toast en client, gatillado tras server action exitosa o error.

---

## 12. Estado de aplicación

- **Server state**: RSC + revalidación con `revalidatePath` / `revalidateTag` tras mutación.
- **Client state**: `useState` / `useReducer` por componente. Sin global store.
- **TanStack Query**: sólo si una vista cliente necesita polling/optimistic con sync server (caso candidato: kanban si DnD pesado y el feedback debe ser inmediato).
- **URL como estado**: filtros del pipeline, paginación de archivo, rango de stats viven en query params (`?stage=ganado&from=2026-01-01`). Se persisten al refrescar y se comparten por link.

---

## 13. Validaciones

- Schemas Zod por feature en `features/<x>/schemas.ts`.
- `react-hook-form` consume Zod via `@hookform/resolvers/zod`. Mismo schema en server action input.
- Custom-field engine genera schemas Zod dinámicos a partir de `CustomFieldDefinition` y los compone con el core schema.

---

## 14. Observabilidad / logging

- `lib/logging/logger.ts` exporta logger pino con métodos contextuales: `logger.tenant(tenantId).info(...)`.
- Cada server action genera `requestId` (uuid) y lo agrega al log + a la response en errores.
- Mínimo: log de creación/edición de tenants, login, errores 5xx, server actions fallidas.
- Métricas básicas: latencia de server action (timer), errores por feature.
- Sentry opcional V1 (recomendado en M10).

---

## 15. Manejo de errores

- Server actions devuelven discriminated union:
  ```ts
  type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
  ```
- Errores esperables (validation, not-found, forbidden) → `code` específico, mensaje user-friendly.
- Errores inesperables → log + mensaje genérico al cliente.
- UI muestra toast con `error.message` cuando `code` es esperable; toast genérico "Algo salió mal, inténtalo de nuevo." en otros casos.
- 404/403 → `notFound()` / pantallas dedicadas de Next.

---

## 16. Seguridad mínima V1

- Auth.js con cookies httpOnly + sameSite=lax, sesión rotada.
- CSRF: server actions tienen origin check nativo de Next.
- Validación server-side estricta con Zod (nunca confiar en client).
- RLS como segunda línea (defense in depth).
- Rate limit en login/signup/forgot/reset (Upstash Ratelimit o equivalente).
- Uploads firmados: backend genera URL firmada con `Content-Type` y tamaño máx; cliente sube directo a S3.
- Sanitización de texto user-generated: V1 sólo plain text en notas (no HTML). Si en post-V1 hay rich-text, sanitizar con DOMPurify server-side.
- Headers de seguridad (CSP, X-Frame-Options, etc.) configurados en `next.config.mjs`.
- Email de password reset con token de uso único + expiración 30 min.
- MFA: stub V1 (campo `mfaSecret` en User) → activación Post-V1 (decisión-pendiente).

---

## 17. Testing

| Nivel       | Herramienta                             | Cobertura objetivo                                                                                                   |
| ----------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                                  | Funciones puras, schemas, helpers de fechas/IDs/RLS context.                                                         |
| Integration | Vitest + Postgres real (testcontainers) | Repos, server actions, RLS aislamiento, Counter de deal id, custom-fields engine.                                    |
| E2E         | Playwright                              | Login, crear deal, mover en kanban, cerrar como ganado, agregar follow-up, completar follow-up, branding por tenant. |

**Tests obligatorios desde M3**:

- `tests/integration/rls.test.ts`: dos tenants, cada uno crea deals, ningún tenant ve los del otro vía Prisma. Si esto falla, BLOQUEA merge.
- `tests/integration/counter.test.ts`: 50 creates concurrentes mantienen secuencia única por tenant.

CI corre los tres niveles en GitHub Actions; PR no se mergea sin verde.

---

## 18. Proceso para agentes (operativo)

(Reglas detalladas en `AGENT_RULES.md`. Resumen aquí del flujo.)

1. Leer los 5 docs (`AGENT_RULES.md` lista el orden).
2. Tomar una task de `IMPLEMENTATION_BACKLOG.md`. Confirmar criterios de aceptación.
3. Implementar dentro del feature/lib correspondiente. No tocar `hardcoded-demo/`.
4. Escribir tests requeridos antes/durante.
5. Correr lint, type-check y tests.
6. Marcar subtasks done conforme se completan; al final marcar la task done en backlog (índice + sección).
7. Si surgen subtasks nuevas, agregarlas al `.md` antes de resolverlas.
8. Si una decisión grande se desvía del plan: ADR en `docs/adr/NNNN-titulo.md` referenciado desde `DECISIONS_AND_OPEN_QUESTIONS.md`.

---

## 19. Configuración / env

`.env.example`:

```
DATABASE_URL=postgres://app_user:...@localhost:5432/koicrm
DATABASE_ADMIN_URL=postgres://admin_user:...@localhost:5432/koicrm
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_REGION=
RESEND_API_KEY=
LOG_LEVEL=info
NODE_ENV=development
```

`DATABASE_URL` corre con usuario sin `BYPASSRLS`. `DATABASE_ADMIN_URL` se usa sólo en migraciones y seeds (puede tener `BYPASSRLS` o ser `postgres`).

---

## 20. Performance / escalabilidad

Para V1 (alcance del demo, decenas de tenants, miles de deals por tenant):

- Índices `(tenantId, ...)` en cada tabla de negocio.
- Server-side pagination con cursor para listas (no offset si pasa de N).
- Búsqueda básica con `ILIKE` + `pg_trgm` (extensión Postgres). Más adelante: `tsvector` o Meilisearch.
- Charts agregados en SQL (no en client).
- Imágenes via S3 CDN.

Post-V1 considerar: read replicas, particionado por tenant, search dedicado.

---

## 21. Internacionalización

V1: locale fijo por tenant (`TenantSettings.locale`), strings de UI en es-GT. Estructura preparada con `next-intl` o equivalente, pero un solo idioma cargado.

Post-V1 (decisión-pendiente): catálogo de traducciones por tenant + multi-idioma.

---

## 22. Deploy / hosting (recomendación, decisión-pendiente)

- Vercel para Next.js.
- Postgres administrado: Neon o Supabase (RLS nativo, branching).
- R2 (Cloudflare) para storage.
- Resend para email.
- Domain: `koicrm.com` con tenants en `/{slug}` (V1) y subdominio `{slug}.koicrm.com` (Post-V1).

Alternativas autohospedadas: Postgres en Fly.io + MinIO + SMTP propio. Documentado en `DECISIONS_AND_OPEN_QUESTIONS.md`.

---

## 23. ADRs

Carpeta `crm-core/docs/adr/`. Plantilla:

```
# ADR NNNN: {Título}
Fecha: YYYY-MM-DD
Status: Proposed | Accepted | Superseded
Contexto:
Decisión:
Consecuencias:
Alternativas evaluadas:
```

Las decisiones grandes ya tomadas en este plan **no requieren ADR retro** — viven en `DECISIONS_AND_OPEN_QUESTIONS.md`. Cualquier desviación futura sí.

---

## 24. Línea aquasistemas vs core (regla anti-leakage)

| Pertenece a CORE                         | Pertenece a PLANTILLA aquasistemas             | Pertenece a TENANT           |
| ---------------------------------------- | ---------------------------------------------- | ---------------------------- |
| Tablas Deal/Client/Pipeline/CatalogItem… | Catálogo equipment (Bomba, Jacuzzi…)           | Logo, colores, datos reales  |
| Engine de custom fields                  | Custom fields opcionales (post-V1: pH, dureza) | Sus catálogos editados       |
| Engine de pipeline configurable          | Pipeline default 6 stages                      | Stages renombrados/agregados |
| Engine de branding                       | Branding default                               | Branding final               |
| RLS, RBAC, auth, billing                 | —                                              | Memberships y roles          |
| ID generator parametrizado               | `dealIdPrefix=AQX` default                     | Prefix custom                |
| Locale/currency engine                   | `es-GT` + `GTQ` default                        | Locale propio                |

**Regla**: si un agente necesita escribir la palabra "aquasistemas", "AQX", "Bomba", "Jacuzzi" o equivalentes en `app/`, `features/`, `components/` o `lib/`, está mal. Esos términos sólo pueden aparecer en `prisma/seed/industry-aquasistemas.ts`, `prisma/seed/demo-aquasistemas.ts` o tests.
