# IMPLEMENTATION_BACKLOG.md

Backlog ejecutable de la V1 de `crm-core/`. Cada item es una task concreta para un agente de código. Lee primero `DEMO_INVENTORY.md`, `ARCHITECTURE_PLAN.md`, `AGENT_RULES.md` y `DECISIONS_AND_OPEN_QUESTIONS.md` antes de tocar nada.

## Regla de oro

**Nada se marca como done hasta que funcione al 100% según sus criterios de aceptación, con tests verdes y verificación funcional real.** "Pendiente de probar", "creo que funciona", "compila pero no lo corrí" NO cuentan como done.

**Doble marcado**: cuando completes una task, marca el checkbox tanto en el **índice general** (sección "Índice") como en su **sección detallada**. Cuando completes una subtask, marca su checkbox específico.

**Subtasks descubiertas durante implementación**: agrégalas al `.md` ANTES de resolverlas. No marques una task como done si quedaron subtasks pendientes.

**No avances con datos fake como si fueran persistencia real.** Si la task requiere DB, la task está hecha cuando hay tabla, migración, RLS y query funcionando contra Postgres real.

---

## Índice general

### M1 — Foundation
- [x] [T1.1 Bootstrap Next.js + TS strict + pnpm](#t11-bootstrap-nextjs--ts-strict--pnpm)
- [ ] [T1.2 Tailwind + shadcn/ui setup](#t12-tailwind--shadcnui-setup)
- [ ] [T1.3 Lint, format, type-check, CI mínima](#t13-lint-format-type-check-ci-m%C3%ADnima)
- [ ] [T1.4 Prisma + Postgres en Docker para dev](#t14-prisma--postgres-en-docker-para-dev)
- [ ] [T1.5 Estructura de carpetas + README de developer](#t15-estructura-de-carpetas--readme-de-developer)

### M2 — Data model y migraciones
- [ ] [T2.1 Schema Prisma core + identidad](#t21-schema-prisma-core--identidad)
- [ ] [T2.2 Schema Prisma negocio + custom fields](#t22-schema-prisma-negocio--custom-fields)
- [ ] [T2.3 RLS policies y migraciones SQL](#t23-rls-policies-y-migraciones-sql)
- [ ] [T2.4 Counter + ID generator de Deal](#t24-counter--id-generator-de-deal)

### M3 — Tenant / Auth / Roles
- [ ] [T3.1 Auth.js v5 con email+password y OAuth Google](#t31-authjs-v5-con-emailpassword-y-oauth-google)
- [ ] [T3.2 Onboarding: crear tenant, elegir industria, aplicar plantilla](#t32-onboarding-crear-tenant-elegir-industria-aplicar-plantilla)
- [ ] [T3.3 Tenant resolver por slug + layout autenticado](#t33-tenant-resolver-por-slug--layout-autenticado)
- [ ] [T3.4 RBAC + helpers de policy](#t34-rbac--helpers-de-policy)
- [ ] [T3.5 withTenant() helper + tests de RLS](#t35-withtenant-helper--tests-de-rls)
- [ ] [T3.6 Invitar usuarios + email transaccional](#t36-invitar-usuarios--email-transaccional)

### M4 — White label y configuración
- [ ] [T4.1 TenantBranding + provider en layout](#t41-tenantbranding--provider-en-layout)
- [ ] [T4.2 TenantSettings (locale, currency, dealIdPrefix)](#t42-tenantsettings-locale-currency-dealidprefix)
- [ ] [T4.3 Catalog management UI (Settings → Catálogos)](#t43-catalog-management-ui-settings--cat%C3%A1logos)
- [ ] [T4.4 Pipeline editor (Settings → Embudo)](#t44-pipeline-editor-settings--embudo)
- [ ] [T4.5 Custom fields engine + UI básica](#t45-custom-fields-engine--ui-b%C3%A1sica)

### M5 — Core CRM
- [ ] [T5.1 Client CRUD + detect-or-create](#t51-client-crud--detect-or-create)
- [ ] [T5.2 Deal CRUD + ClientFormModal real](#t52-deal-crud--clientformmodal-real)
- [ ] [T5.3 Pipeline kanban con DnD accesible](#t53-pipeline-kanban-con-dnd-accesible)
- [ ] [T5.4 Filtros globales + KPIs del header](#t54-filtros-globales--kpis-del-header)
- [ ] [T5.5 DealDetail modal con tres paneles](#t55-dealdetail-modal-con-tres-paneles)
- [ ] [T5.6 Activity log y history view](#t56-activity-log-y-history-view)
- [ ] [T5.7 ClientsPage (sidebar + ficha + KPIs)](#t57-clientspage-sidebar--ficha--kpis)
- [ ] [T5.8 ArchivePage paginada](#t58-archivepage-paginada)
- [ ] [T5.9 Búsqueda global (Cmd-K)](#t59-b%C3%BAsqueda-global-cmd-k)
- [ ] [T5.10 Notes en Deal y Client](#t510-notes-en-deal-y-client)
- [ ] [T5.11 Print Report (Imprimir)](#t511-print-report-imprimir)

### M6 — Quotes, Payments, Attachments
- [ ] [T6.1 S3 sign helper + upload directo](#t61-s3-sign-helper--upload-directo)
- [ ] [T6.2 Quote CRUD + isVoid + alerta "Falta Cotización"](#t62-quote-crud--isvoid--alerta-falta-cotizaci%C3%B3n)
- [ ] [T6.3 Payment CRUD + alerta "Falta Pago"](#t63-payment-crud--alerta-falta-pago)

### M7 — Follow-ups y Calendario
- [ ] [T7.1 FollowUp CRUD + completar con result](#t71-followup-crud--completar-con-result)
- [ ] [T7.2 CalendarView mensual con color-coding](#t72-calendarview-mensual-con-color-coding)
- [ ] [T7.3 Alertas de overdue en card y panel](#t73-alertas-de-overdue-en-card-y-panel)

### M8 — Estadísticas, KPIs, charts
- [ ] [T8.1 Aggregations server-side por sub-tab](#t81-aggregations-server-side-por-sub-tab)
- [ ] [T8.2 Charts (Recharts) por sub-tab](#t82-charts-recharts-por-sub-tab)
- [ ] [T8.3 Filtro de rango de fecha global del panel](#t83-filtro-de-rango-de-fecha-global-del-panel)

### M9 — Plantilla industria aquasistemas
- [ ] [T9.1 IndustryTemplate aquasistemas (seed)](#t91-industrytemplate-aquasistemas-seed)
- [ ] [T9.2 Aplicar plantilla en onboarding](#t92-aplicar-plantilla-en-onboarding)

### M10 — Hardening, tests, demo data
- [ ] [T10.1 Test suite E2E (Playwright) cubriendo flujos clave](#t101-test-suite-e2e-playwright-cubriendo-flujos-clave)
- [ ] [T10.2 Accesibilidad mínima (kanban teclado, aria-labels)](#t102-accesibilidad-m%C3%ADnima-kanban-teclado-aria-labels)
- [ ] [T10.3 Performance pass (índices, paginación, queries)](#t103-performance-pass-%C3%ADndices-paginaci%C3%B3n-queries)
- [ ] [T10.4 Demo tenant aquasistemas seed `pnpm seed:demo`](#t104-demo-tenant-aquasistemas-seed-pnpm-seeddemo)

---

## Plantilla por task

Cada task usa este formato:

> **Objetivo**: una frase.
> **Archivos esperados**: rutas relativas a `crm-core/`.
> **Dependencias**: tasks que deben estar done antes.
> **Criterios de aceptación**: lista verificable.
> **Tests requeridos**: unit / integration / E2E.
> **Notas de arquitectura**: referencia a sección de `ARCHITECTURE_PLAN.md`.
> **Riesgos / decisiones**.
> **Subtasks**: con checkboxes.

---

## Milestone M1 — Foundation

### T1.1 Bootstrap Next.js + TS strict + pnpm
- **Objetivo**: levantar el proyecto vacío con Next.js 14 App Router + TS strict + pnpm dentro de `crm-core/`.
- **Archivos esperados**: `crm-core/package.json`, `tsconfig.json`, `next.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `pnpm-lock.yaml`.
- **Dependencias**: ninguna.
- **Criterios de aceptación**:
  - `pnpm install` corre limpio.
  - `pnpm dev` levanta en `localhost:3000` y la página renderiza.
  - `tsc --noEmit` pasa con `"strict": true`.
- **Tests requeridos**: ninguno aún.
- **Notas**: §1, §2 de ARCHITECTURE_PLAN.
- **Riesgos**: Node version mismatch — fijar `engines.node` en package.json.
- **Subtasks**:
  - [x] Inicializar `package.json` con `next@14`, `react@18`, `typescript`.
  - [x] `tsconfig.json` con `strict: true`, paths alias `@/*`.
  - [x] `app/layout.tsx` y `app/page.tsx` mínimos.
  - [x] Script `dev`, `build`, `start`, `type-check`.
  - [x] Confirmar build de prod sin warnings.

### T1.2 Tailwind + shadcn/ui setup
- **Objetivo**: estilos listos con Tailwind 3 y shadcn/ui inicializado.
- **Archivos esperados**: `tailwind.config.ts`, `app/globals.css`, `components.json`, `components/ui/*` (button, dialog, dropdown-menu, input, label, select, sheet, sonner, tabs, toast).
- **Dependencias**: T1.1.
- **Criterios de aceptación**:
  - Tailwind compila.
  - `Button` de shadcn renderizable en `app/page.tsx`.
  - Dark mode class strategy configurada.
- **Tests requeridos**: ninguno.
- **Notas**: §1.
- **Subtasks**:
  - [ ] Instalar `tailwindcss`, `postcss`, `autoprefixer`.
  - [ ] `npx shadcn-ui@latest init` con preset slate + class-based dark.
  - [ ] Agregar componentes base (button, dialog, dropdown-menu, input, label, select, sheet, sonner, tabs, toast, tooltip).
  - [ ] Variables CSS de tema (primario, fondo, header, kpi) listas para override por tenant.

### T1.3 Lint, format, type-check, CI mínima
- **Objetivo**: garantías de calidad mecánicas.
- **Archivos esperados**: `.eslintrc.json`, `.prettierrc`, `.github/workflows/ci.yml`, `lint-staged.config.js`, `.husky/pre-commit`.
- **Dependencias**: T1.1.
- **Criterios de aceptación**:
  - `pnpm lint`, `pnpm format`, `pnpm type-check` ejecutan.
  - Pre-commit corre lint-staged.
  - GitHub Actions ejecuta lint + type-check + tests en cada PR.
- **Tests requeridos**: el CI corre vitest (aunque sin tests todavía pasa).
- **Notas**: §17.
- **Subtasks**:
  - [ ] ESLint con `next/core-web-vitals` y `@typescript-eslint`.
  - [ ] Prettier + plugin-tailwind.
  - [ ] Husky pre-commit con lint-staged.
  - [ ] CI workflow básico.

### T1.4 Prisma + Postgres en Docker para dev
- **Objetivo**: DB local lista para desarrollo.
- **Archivos esperados**: `prisma/schema.prisma` (placeholder), `docker-compose.yml`, `.env.example`, `lib/db/client.ts`.
- **Dependencias**: T1.1.
- **Criterios de aceptación**:
  - `docker compose up -d` levanta Postgres 15+ con dos usuarios: `app_user` (sin BYPASSRLS) y `admin_user` (con BYPASSRLS).
  - `pnpm prisma migrate dev` corre contra la DB.
  - `lib/db/client.ts` exporta singleton con conexión usando `app_user`.
- **Tests requeridos**: ninguno aún.
- **Notas**: §4.3, §19.
- **Riesgos**: olvidar el usuario sin BYPASSRLS rompe las pruebas de RLS de M3.
- **Subtasks**:
  - [ ] Compose con Postgres + script init que crea `app_user` y `admin_user`.
  - [ ] `.env.example` con `DATABASE_URL` y `DATABASE_ADMIN_URL`.
  - [ ] Singleton Prisma con `globalThis` para hot-reload.
  - [ ] README con comandos `db:up`, `db:reset`, `db:migrate`.

### T1.5 Estructura de carpetas + README de developer
- **Objetivo**: dejar materializada la estructura de §2 y un README operativo.
- **Archivos esperados**: directorios placeholder (`features/`, `lib/`, `tests/`, `docs/adr/`, `prisma/seed/`), `README.md`, `CONTRIBUTING.md`.
- **Dependencias**: T1.1, T1.4.
- **Criterios de aceptación**:
  - Estructura coincide con §2 de ARCHITECTURE_PLAN.
  - README explica cómo correr local, lint, tests.
  - `CONTRIBUTING.md` apunta a los 5 docs de planificación.
- **Tests requeridos**: —
- **Subtasks**:
  - [ ] Crear directorios y README de cada feature/lib (un párrafo cada uno).
  - [ ] README raíz con quickstart.
  - [ ] CONTRIBUTING.md con flow de PR + reglas de agentes.

---

## Milestone M2 — Data model y migraciones

### T2.1 Schema Prisma core + identidad
- **Objetivo**: Tenant, User, Membership, TenantBranding, TenantSettings, IndustryTemplate.
- **Archivos esperados**: `prisma/schema.prisma`, `prisma/migrations/<ts>_init_identity/migration.sql`.
- **Dependencias**: T1.4.
- **Criterios de aceptación**:
  - Migración aplica limpia.
  - `pnpm prisma generate` funciona.
  - Una creación manual de `Tenant` + `User` + `Membership` desde script funciona.
- **Tests requeridos**: integration `tests/integration/identity.test.ts` que crea tenant+user+membership y verifica unicidad.
- **Notas**: §4.1.
- **Subtasks**:
  - [ ] Definir modelos según §4.1 + §6.
  - [ ] Migración generada.
  - [ ] Script de smoke test manual.

### T2.2 Schema Prisma negocio + custom fields
- **Objetivo**: Pipeline, PipelineStage, CatalogItem, Deal, DealEquipment, Client, Quote, Payment, Attachment, FollowUp, Note, Activity, SavedView, Counter, CustomFieldDefinition.
- **Archivos esperados**: actualizaciones a `prisma/schema.prisma`, nueva migración.
- **Dependencias**: T2.1.
- **Criterios de aceptación**:
  - Todas las tablas existen con índices `(tenantId, …)`.
  - FKs declaradas con `onDelete` correcto.
  - `Counter @@id([tenantId, key])` y `CatalogItem @@unique([tenantId, catalogKey, key])`.
- **Tests requeridos**: integration que inserta un Deal con todas sus relaciones.
- **Notas**: §7.
- **Subtasks**:
  - [ ] Modelos según §7.1–7.12.
  - [ ] Migración aplicada.
  - [ ] Smoke test que crea pipeline + 3 stages + catalog items + deal + quote + payment + followup.

### T2.3 RLS policies y migraciones SQL
- **Objetivo**: activar RLS en cada tabla de negocio con policy `tenantId = current_setting('app.tenant_id')`.
- **Archivos esperados**: `prisma/migrations/<ts>_rls/migration.sql`.
- **Dependencias**: T2.2.
- **Criterios de aceptación**:
  - Policies activas en TODAS las tablas con `tenantId`.
  - `app_user` sin BYPASSRLS; sin `set_config` no ve nada.
  - Migración idempotente.
- **Tests requeridos**: `tests/integration/rls.test.ts` con dos tenants:
  - Tenant A crea un deal; con `set_config('app.tenant_id', tenantA)` se ve, con tenantB no.
  - Sin set_config, query devuelve 0 filas.
- **Notas**: §4.3.
- **Riesgos**: olvidar una tabla. **Mitigación**: test que verifica para cada tabla con `tenantId` que existe la policy (consulta a `pg_policies`).
- **Subtasks**:
  - [ ] SQL `ALTER TABLE … ENABLE ROW LEVEL SECURITY` para cada tabla.
  - [ ] Policy `tenant_isolation` por tabla.
  - [ ] Test que enumera tablas y verifica policy.
  - [ ] Test funcional con dos tenants.

### T2.4 Counter + ID generator de Deal
- **Objetivo**: helper `generateDealId(tenantId, ownerInitials)` con secuencia atómica por tenant.
- **Archivos esperados**: `lib/id/deal-id.ts`, `features/deals/queries.ts` (parcial).
- **Dependencias**: T2.2.
- **Criterios de aceptación**:
  - Formato `${prefix}-${counter:0000}-${initials}-${YY|YYYY}` según `TenantSettings`.
  - Atómico: dentro de transacción incrementa Counter y compone el id.
  - Tests de concurrencia: 50 inserts paralelos producen 50 ids únicos secuenciales.
- **Tests requeridos**: integration `tests/integration/deal-id.test.ts`.
- **Notas**: §7.12, §7.1 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Helper que recibe `tx` y `tenantId`.
  - [ ] Uso de `SELECT ... FOR UPDATE` o upsert atómico.
  - [ ] Test de unicidad bajo carga.

---

## Milestone M3 — Tenant / Auth / Roles

### T3.1 Auth.js v5 con email+password y OAuth Google
- **Objetivo**: signin, signup, signout, password reset funcionando.
- **Archivos esperados**: `app/(auth)/*`, `app/api/auth/[...nextauth]/route.ts`, `lib/auth/auth.ts`, `lib/auth/password.ts`.
- **Dependencias**: T2.1.
- **Criterios de aceptación**:
  - Signup crea User + envía email de verificación.
  - Signin con password verifica contra hash bcrypt.
  - Forgot/reset funcional con token expirable.
  - OAuth Google funcional en dev.
  - Sesión httpOnly + sameSite=lax.
- **Tests requeridos**: E2E Playwright signup → verify email → signin → signout.
- **Notas**: §1, §16.
- **Subtasks**:
  - [ ] Adapter Prisma para Auth.js v5.
  - [ ] Páginas `/signin`, `/signup`, `/forgot`, `/reset`.
  - [ ] Provider Google.
  - [ ] Email de verificación + reset (mock en dev, Resend en prod).
  - [ ] Rate limit en endpoints de auth.

### T3.2 Onboarding: crear tenant, elegir industria, aplicar plantilla
- **Objetivo**: usuario nuevo crea su primer Tenant; elige industria; se aplica plantilla.
- **Archivos esperados**: `app/app/(onboarding)/page.tsx`, `features/tenants/actions.ts`, `lib/industry/registry.ts`.
- **Dependencias**: T3.1, T9.1 (mínimo: existencia de plantilla aquasistemas como única opción inicial).
- **Criterios de aceptación**:
  - Usuario sin tenants es redirigido a `/app/onboarding`.
  - Crea tenant con slug único; rol OWNER asignado.
  - Selección de industria aplica plantilla (CatalogItems + Pipeline + CustomFieldDefinitions + Branding default).
  - Redirige a `/app/{tenantSlug}/pipeline`.
- **Tests requeridos**: E2E "primer login → onboarding → pipeline vacío".
- **Notas**: §7.11, §9.
- **Subtasks**:
  - [ ] Form de creación con validación de slug.
  - [ ] Server action `createTenant({name, slug, industrySlug})`.
  - [ ] `applyIndustryTemplate(tenantId, slug)` ejecuta dentro de transacción.
  - [ ] Redirect post-onboarding.

### T3.3 Tenant resolver por slug + layout autenticado
- **Objetivo**: `app/app/[tenantSlug]/layout.tsx` resuelve tenant, valida membership, expone contexto.
- **Archivos esperados**: `app/app/[tenantSlug]/layout.tsx`, `lib/tenant/resolve.ts`, `lib/tenant/context.ts`.
- **Dependencias**: T3.1, T3.2.
- **Criterios de aceptación**:
  - Si no hay sesión → redirect a `/signin`.
  - Si sesión sin membership al tenant → 404.
  - Si OK → layout renderiza header con switcher de tenant + branding.
- **Tests requeridos**: E2E "usuario sin acceso a tenant X recibe 404".
- **Notas**: §4.2.
- **Subtasks**:
  - [ ] `resolveTenant(slug, session)` en server.
  - [ ] Tenant context provider para client components.
  - [ ] Header con dropdown de tenants disponibles si > 1.

### T3.4 RBAC + helpers de policy
- **Objetivo**: helper `requireRole` y policies por feature.
- **Archivos esperados**: `lib/auth/rbac.ts`, `features/<x>/policies.ts` (stubs por feature creada en M5+).
- **Dependencias**: T3.3.
- **Criterios de aceptación**:
  - Roles `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` definidos.
  - `requireRole(session, tenantId, ['OWNER','ADMIN'])` lanza si no cumple.
  - Helpers `canCreateDeal`, `canEditDeal`, etc., a usar en UI y server.
- **Tests requeridos**: integration `rbac.test.ts` con múltiples combinaciones.
- **Notas**: §5.
- **Subtasks**:
  - [ ] Tipos y helper centralizado.
  - [ ] Tests de matriz rol×acción.

### T3.5 withTenant() helper + tests de RLS
- **Objetivo**: garantizar que toda consulta autenticada pasa por `withTenant`.
- **Archivos esperados**: `lib/db/rls.ts`, ejemplo de uso en `features/tenants/queries.ts`.
- **Dependencias**: T2.3, T3.3.
- **Criterios de aceptación**:
  - Helper abre transacción, setea `app.tenant_id` y ejecuta callback.
  - Si falla, rollback automático.
  - Linter rule (custom o convención documentada en `AGENT_RULES.md`) para detectar `prisma.deal.findMany` sin `withTenant`.
- **Tests requeridos**: integration que verifica que sin `withTenant` no se ven filas.
- **Notas**: §4.3.
- **Subtasks**:
  - [ ] Implementación.
  - [ ] Test extra que llama a 5 queries de distintas tablas y verifica aislamiento.
  - [ ] Documentar la regla en `AGENT_RULES.md`.

### T3.6 Invitar usuarios + email transaccional
- **Objetivo**: OWNER/ADMIN invita por email; recibe link con token; al aceptar, se crea Membership.
- **Archivos esperados**: `features/users/actions.ts`, `app/app/[tenantSlug]/settings/users/page.tsx`, `lib/email/resend.ts`.
- **Dependencias**: T3.4.
- **Criterios de aceptación**:
  - Invitación con token expirable.
  - Si el email ya tiene cuenta, agrega Membership directamente al aceptar.
  - Si no existe, lo redirige a signup pre-llenado.
- **Tests requeridos**: E2E "invitar → aceptar → ver tenant".
- **Notas**: §16.
- **Subtasks**:
  - [ ] Tabla `Invitation(tenantId, email, role, token, expiresAt, acceptedAt)`.
  - [ ] Email template (Resend en prod, log en dev).
  - [ ] UI de Settings → Usuarios con lista, invitar, cambiar rol, remover.

---

## Milestone M4 — White label y configuración

### T4.1 TenantBranding + provider en layout
- **Objetivo**: branding por tenant aplicado a UI.
- **Archivos esperados**: `features/branding/*`, actualización `app/app/[tenantSlug]/layout.tsx`.
- **Dependencias**: T3.3.
- **Criterios de aceptación**:
  - UI lee `TenantBranding`: logo (S3 URL), colores, productName.
  - Cambios en Settings → Apariencia se reflejan tras revalidate.
  - Logo y bgImage suben vía URL firmada (depende de M6.1; bloquear hasta entonces o mockear).
- **Tests requeridos**: E2E "cambiar color primario y verlo reflejado".
- **Notas**: §6.
- **Subtasks**:
  - [ ] CSS variables aplicadas en root.
  - [ ] Settings UI para colores y productName.
  - [ ] Upload de logo (puede ser TODO hasta M6).

### T4.2 TenantSettings (locale, currency, dealIdPrefix)
- **Objetivo**: panel de Settings → General con configuración del tenant.
- **Archivos esperados**: `app/app/[tenantSlug]/settings/general/page.tsx`, `features/tenants/settings.ts`.
- **Dependencias**: T3.3.
- **Criterios de aceptación**:
  - locale, currency, timezone, phoneFormat, whatsappCountryCode, dealIdPrefix, dealIdYearDigits editables.
  - Cambios persisten y aplican inmediatamente al `Intl.NumberFormat` y `Intl.DateTimeFormat` de la UI.
- **Tests requeridos**: integration que cambia `currency=USD` y verifica formateo.
- **Notas**: §6, §21.
- **Subtasks**:
  - [ ] Form con validación.
  - [ ] Helpers `lib/intl/*` que reciben tenant settings.

### T4.3 Catalog management UI (Settings → Catálogos)
- **Objetivo**: CRUD de `CatalogItem` agrupado por `catalogKey`.
- **Archivos esperados**: `features/catalogs/*`, `app/app/[tenantSlug]/settings/catalogs/page.tsx`.
- **Dependencias**: T3.4.
- **Criterios de aceptación**:
  - Ver, agregar, editar, soft-disable items por catálogo (`equipment`, `salesChannel`, `dealStatus`, `followupReason`).
  - Reordenar (DnD básico o número de orden).
  - Borrar bloquea si hay deals usándolo (mostrar warning, ofrecer migrar).
- **Tests requeridos**: integration "crear, listar, marcar inactivo".
- **Notas**: §7.4.
- **Subtasks**:
  - [ ] Server actions CRUD.
  - [ ] UI con tabs por catálogo.
  - [ ] Validación de borrado seguro.

### T4.4 Pipeline editor (Settings → Embudo)
- **Objetivo**: editar Pipeline + sus PipelineStage (orden, label, color, icono, locked).
- **Archivos esperados**: `features/pipeline/*`, `app/app/[tenantSlug]/settings/pipeline/page.tsx`.
- **Dependencias**: T3.4.
- **Criterios de aceptación**:
  - Lista de stages con DnD para reordenar.
  - Edición inline.
  - No se permite borrar un stage con deals; ofrecer reasignar.
  - Cambios atómicos (transacción).
- **Tests requeridos**: integration "reordenar stages no rompe deals".
- **Notas**: §7.3.
- **Subtasks**:
  - [ ] Reorder server action.
  - [ ] Form de stage.
  - [ ] Validación de delete.

### T4.5 Custom fields engine + UI básica
- **Objetivo**: crear/editar `CustomFieldDefinition` para Deal y Client.
- **Archivos esperados**: `lib/config/custom-fields.ts`, `features/custom-fields/*`, `app/app/[tenantSlug]/settings/custom-fields/page.tsx`.
- **Dependencias**: T3.4.
- **Criterios de aceptación**:
  - Tipos soportados V1: text, number, date, select, multiselect, boolean, url.
  - Form de creación define key, label, tipo, opciones, required, order.
  - Engine genera schema Zod dinámico por entidad para uso en server actions.
  - Forms de Deal y Client renderizan los custom fields automáticamente.
- **Tests requeridos**: unit del engine; integration que crea custom field, lo persiste en Deal.customData y lo lee.
- **Notas**: §7.2.
- **Riesgos**: explosión de complejidad. Limitar alcance V1.
- **Subtasks**:
  - [ ] CRUD de definitions.
  - [ ] Engine schema-builder.
  - [ ] Renderer de fields en forms.
  - [ ] Renderer de fields en vistas de detalle.

---

## Milestone M5 — Core CRM

### T5.1 Client CRUD + detect-or-create
- **Objetivo**: tabla `Client` con CRUD y lógica detect-or-create por `(name, company)`.
- **Archivos esperados**: `features/clients/{actions,queries,schemas,policies}.ts`.
- **Dependencias**: T2.2, T3.5.
- **Criterios de aceptación**:
  - `findOrCreateClient(tenantId, {name, company})` retorna existing o crea.
  - Edición persiste; borrado bloqueado si tiene deals.
  - Custom fields integrados.
- **Tests requeridos**: integration de detect-or-create con casuísticas (case-insensitive, trim).
- **Notas**: §7.6, §7.2 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Helpers de canonicalización de key.
  - [ ] Server actions create/update/delete.
  - [ ] Test con duplicate-by-different-case.

### T5.2 Deal CRUD + ClientFormModal real
- **Objetivo**: crear/editar Deal vía modal, con validaciones del demo y Client detect-or-create.
- **Archivos esperados**: `features/deals/{actions,queries,schemas,policies,components/ClientFormModal.tsx}`.
- **Dependencias**: T5.1, T2.4, T4.3, T4.4.
- **Criterios de aceptación**:
  - Modal con dos columnas según §4.1 de DEMO_INVENTORY.
  - Campos requeridos validados client + server (Zod).
  - Genera id con `generateDealId`.
  - Guarda equipos via `DealEquipment`.
  - Crea/enlaza Client.
  - Registra `Activity` "created".
- **Tests requeridos**: E2E "crear deal completo".
- **Notas**: §7.5, §4.1 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Schema Zod compartido.
  - [ ] UI modal.
  - [ ] Server action `createDeal` + `updateDeal`.
  - [ ] Test E2E.

### T5.3 Pipeline kanban con DnD accesible
- **Objetivo**: vista Embudo con kanban funcional.
- **Archivos esperados**: `app/app/[tenantSlug]/pipeline/page.tsx`, `features/pipeline/components/Kanban.tsx`, server action `moveDeal`.
- **Dependencias**: T5.2, T4.4.
- **Criterios de aceptación**:
  - Columnas por stage configurado del pipeline default.
  - DnD con `@dnd-kit/core` (keyboard sensor activo).
  - Drop ejecuta `moveDeal({dealId, toStageId})` con optimistic UI; rollback si falla.
  - Stages locked rechazan drop con feedback.
  - Registra Activity `stageChanged{from,to}` y actualiza `stageEnteredAt`.
- **Tests requeridos**: E2E "drag deal entre stages"; integration `moveDeal` con concurrencia.
- **Notas**: §11, §3.1 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Componente client-side con @dnd-kit.
  - [ ] Server action.
  - [ ] Optimistic update + rollback.
  - [ ] Keyboard navigation.

### T5.4 Filtros globales + KPIs del header
- **Objetivo**: barra de filtros + KPIs dinámicos en Pipeline.
- **Archivos esperados**: `features/pipeline/components/FilterBar.tsx`, `features/stats/queries.ts` parcial (Total Embudo, Ganado).
- **Dependencias**: T5.3.
- **Criterios de aceptación**:
  - Filtros por collaborator, channel, equipment, alerts, dateRange (presets + custom).
  - URL refleja filtros (`?owner=...&channel=...&from=...`).
  - KPIs Total Embudo y Ganado se recalculan según filtros.
  - Botón "Limpiar Filtros" reinicia.
- **Tests requeridos**: integration de queries con combos de filtros; E2E de UX.
- **Notas**: §7.9, §7.10, §8.1.
- **Subtasks**:
  - [ ] Schema URL params.
  - [ ] Server queries de KPIs.
  - [ ] UI de filtros (selects + date range).

### T5.5 DealDetail modal con tres paneles
- **Objetivo**: modal completo de detalle de Deal.
- **Archivos esperados**: `features/deals/components/DealDetailModal.tsx`.
- **Dependencias**: T5.2, T6.x (parcial), T7.1.
- **Criterios de aceptación**:
  - Tres paneles (datos / operación / auditoría) según §4.2 de DEMO_INVENTORY.
  - Inline edit de campos primarios.
  - Botones "Mover a", "Marcar como ganado", "Marcar como perdido", "Archivar".
  - Cada acción registra Activity.
- **Tests requeridos**: E2E "abrir detail → editar value → confirmar persistencia".
- **Notas**: §4.2 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Layout 3 paneles responsive.
  - [ ] Inline edit con optimistic UI.
  - [ ] Acciones de stage.
  - [ ] Lectura de Activity en panel derecho.

### T5.6 Activity log y history view
- **Objetivo**: registrar todas las mutaciones relevantes y mostrarlas.
- **Archivos esperados**: `features/activity/{actions,queries}.ts`, `features/deals/components/HistoryPanel.tsx`.
- **Dependencias**: T5.2.
- **Criterios de aceptación**:
  - Eventos: created, stageChanged, ownerChanged, valueChanged, quoteAdded, paymentAdded, archived, followUpAdded, followUpCompleted, noteAdded.
  - Cada evento captura `userId` y `payload` JSON.
  - HistoryPanel muestra timeline ordenado descendente con timestamps localizados.
- **Tests requeridos**: integration "ejecutar 5 acciones y verificar 5 entries con userId correcto".
- **Notas**: §7.8 de DEMO_INVENTORY, §7.9.
- **Subtasks**:
  - [ ] Helper `recordActivity(tx, ...)`.
  - [ ] Aplicar en cada action.
  - [ ] UI timeline.

### T5.7 ClientsPage (sidebar + ficha + KPIs)
- **Objetivo**: vista Clientes según §3.2 de DEMO_INVENTORY.
- **Archivos esperados**: `app/app/[tenantSlug]/clients/{page.tsx,[clientId]/page.tsx}`, `features/clients/components/*`.
- **Dependencias**: T5.1, T5.2.
- **Criterios de aceptación**:
  - Sidebar con búsqueda, sort A-Z/fecha, navegador alfabético, count.
  - Ficha con KPIs (Oportunidades, Activas, Ganadas, Total comprado) con selector de rango.
  - Notas globales del cliente (CRUD).
  - Historial de oportunidades.
  - Botón "Nueva oportunidad" pre-carga ClientFormModal.
- **Tests requeridos**: E2E "buscar cliente → abrir ficha → crear deal desde ahí".
- **Notas**: §3.2 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Sidebar component.
  - [ ] Ficha con KPIs.
  - [ ] Notas component.
  - [ ] Timeline de deals.

### T5.8 ArchivePage paginada
- **Objetivo**: tabla de deals archivados con paginación.
- **Archivos esperados**: `app/app/[tenantSlug]/archive/page.tsx`, `features/deals/queries.ts`.
- **Dependencias**: T5.5.
- **Criterios de aceptación**:
  - Tabla con columnas Fecha / Oportunidad / Empresa / Etapa / Asesor / Valor.
  - Paginación cursor-based, 10 por página.
  - Click abre DealDetail en modo lectura (o normal con flag).
- **Tests requeridos**: integration de paginación; E2E.
- **Notas**: §3.4 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Query con cursor.
  - [ ] UI tabla con shadcn `data-table`.
  - [ ] Page indicator.

### T5.9 Búsqueda global (Cmd-K)
- **Objetivo**: modal de búsqueda con resultados agrupados.
- **Archivos esperados**: `features/search/*`, `components/CommandMenu.tsx`.
- **Dependencias**: T5.2.
- **Criterios de aceptación**:
  - Trigger Cmd-K (Mac) / Ctrl-K (Win).
  - Búsqueda server-side con `pg_trgm`/`ILIKE` sobre name, company, phone, quote number, payment number.
  - Resultados agrupados; click navega al deal.
  - Empty state explícito ("Sin resultados").
- **Tests requeridos**: integration de búsqueda con varios términos.
- **Notas**: §3.6, §15 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Server action `search(tenantId, query)`.
  - [ ] UI con cmdk o shadcn command.
  - [ ] Trigger global.

### T5.10 Notes en Deal y Client
- **Objetivo**: CRUD de Notas, mostrarlas timestamped.
- **Archivos esperados**: `features/notes/*`.
- **Dependencias**: T5.2, T5.7.
- **Criterios de aceptación**:
  - Add desde Deal y Client.
  - Eliminar (soft-delete o hard, decisión-pendiente).
  - Plain text V1 (sin HTML).
- **Tests requeridos**: integration.
- **Notas**: §16.
- **Subtasks**:
  - [ ] Server actions.
  - [ ] UI inline en DealDetail y ficha de cliente.

### T5.11 Print Report (Imprimir)
- **Objetivo**: reporte imprimible del pipeline accesible desde el botón Printer del header.
- **Archivos esperados**: `features/pipeline/components/PrintReport.tsx` (componente print-only, hidden on screen).
- **Dependencias**: T5.3, T5.4.
- **Criterios de aceptación**:
  - Trigger: botón Printer en header llama a `window.print()` (o equivalente Next.js).
  - Componente imprimible solo visible en `@media print`.
  - Tabla con columnas: Cliente (nombre + empresa + ID), Etapa Actual (badge), Días en etapa, Días totales, Equipo, Alertas, Valor Estimado.
  - Sub-fila por deal: Asesor, Origen, Tel, Email, Cotizaciones, Pagos, Última nota.
  - Respeta filtros activos de Asesor, Canal y Equipo; excluye archivados.
  - Header: "Reporte de Oportunidades" + fecha + logo del tenant.
  - Footer: total de registros + "Reporte generado automáticamente desde {productName}."
- **Tests requeridos**: E2E "botón imprimir no lanza error; componente tiene datos".
- **Notas**: §3.8 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Componente con CSS `@media print`.
  - [ ] Lógica de filtrado (reusar filtros activos del pipeline).
  - [ ] Logo y nombre del producto desde TenantBranding.
  - [ ] E2E básico.

---

## Milestone M6 — Quotes, Payments, Attachments

### T6.1 S3 sign helper + upload directo
- **Objetivo**: cliente sube archivos a S3 vía URL firmada.
- **Archivos esperados**: `lib/storage/s3.ts`, `app/api/upload/sign/route.ts`, `features/attachments/*`.
- **Dependencias**: T3.4.
- **Criterios de aceptación**:
  - Endpoint firma URL con Content-Type y tamaño máx (configurable).
  - Cliente sube directo; recibe URL final.
  - Tabla `Attachment` registra metadata.
- **Tests requeridos**: integration con MinIO local.
- **Notas**: §16.
- **Subtasks**:
  - [ ] AWS SDK v3 cliente.
  - [ ] Endpoint sign.
  - [ ] Helper client-side.

### T6.2 Quote CRUD + isVoid + alerta "Falta Cotización"
- **Objetivo**: gestionar cotizaciones múltiples por deal.
- **Archivos esperados**: `features/quotes/*`.
- **Dependencias**: T5.5, T6.1.
- **Criterios de aceptación**:
  - Add/Edit/Mark void/Delete.
  - Alerta "Falta Cotización" en card si stage ∈ {cotizacion, negociacion, ganado} y no hay quote con `isVoid=false`.
  - Activity `quoteAdded`.
- **Tests requeridos**: integration con casos mixtos (todas void, una activa, etc.); E2E.
- **Notas**: §7.4 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Server actions.
  - [ ] UI en DealDetail.
  - [ ] Lógica de alerta.

### T6.3 Payment CRUD + alerta "Falta Pago"
- **Objetivo**: análogo a Quote para pagos.
- **Archivos esperados**: `features/payments/*`.
- **Dependencias**: T5.5, T6.1.
- **Criterios de aceptación**:
  - Add/Edit/Mark void/Delete.
  - Alerta "Falta Pago" en card si stage = ganado y no hay payment activo.
  - Activity `paymentAdded`.
- **Tests requeridos**: integration; E2E.
- **Notas**: §7.4 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Server actions.
  - [ ] UI.
  - [ ] Alerta.

---

## Milestone M7 — Follow-ups y Calendario

### T7.1 FollowUp CRUD + completar con result
- **Objetivo**: gestionar seguimientos por deal.
- **Archivos esperados**: `features/follow-ups/*`.
- **Dependencias**: T5.5, T4.3 (catálogo `followupReason`).
- **Criterios de aceptación**:
  - Add con date + reasonKey.
  - Mark completed registra `completedAt` y permite `result`.
  - Activity `followUpAdded` y `followUpCompleted`.
- **Tests requeridos**: integration.
- **Notas**: §7.6 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Server actions.
  - [ ] UI en DealDetail.

### T7.2 CalendarView mensual con color-coding
- **Objetivo**: vista Calendario.
- **Archivos esperados**: `app/app/[tenantSlug]/calendar/page.tsx`, `features/calendar/components/MonthGrid.tsx`.
- **Dependencias**: T7.1.
- **Criterios de aceptación**:
  - Grid 7×N (Lun-Dom), navegación mes, "Hoy".
  - Eventos color-coded: completed/overdue/normal/urgent.
  - Panel lateral del día seleccionado con cards de FollowUp.
  - Filtro por collaborator.
- **Tests requeridos**: integration de queries; E2E de navegación.
- **Notas**: §3.3 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Helper de matriz mensual.
  - [ ] Server query del rango.
  - [ ] UI con día seleccionado.

### T7.3 Alertas de overdue en card y panel
- **Objetivo**: indicadores visuales y panel de Alertas en Stats.
- **Archivos esperados**: actualizaciones a card de pipeline + `app/app/[tenantSlug]/stats/alerts/page.tsx`.
- **Dependencias**: T7.1.
- **Criterios de aceptación**:
  - Card de deal muestra "Seguim. Vencido" si tiene FollowUp pendiente con date < today (noon-comparison).
  - Panel Alertas lista vencidos / hoy / próximos 7 días.
- **Tests requeridos**: integration con dates específicas.
- **Notas**: §7.6 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Computo en query (sin client-side dates).
  - [ ] UI consistente con DEMO_INVENTORY §6.5.

---

## Milestone M8 — Estadísticas, KPIs, charts

### T8.1 Aggregations server-side por sub-tab
- **Objetivo**: queries SQL agregadas para los 7 sub-tabs de Stats.
- **Archivos esperados**: `features/stats/queries.ts`.
- **Dependencias**: T5.4.
- **Criterios de aceptación**:
  - Funciones para Resumen, Embudo, Equipo, Canal, Productos, Alertas según fórmulas de §8 de DEMO_INVENTORY.
  - Aceptan `dateRange` + filtros.
  - Performance: < 200ms con 10k deals (índice + agregación SQL).
- **Tests requeridos**: integration con dataset sembrado de prueba.
- **Notas**: §8 de DEMO_INVENTORY, §20.
- **Subtasks**:
  - [ ] Resumen.
  - [ ] Embudo (incluye conversion por stage).
  - [ ] Equipo.
  - [ ] Canal.
  - [ ] Productos.
  - [ ] Alertas.

### T8.2 Charts (Recharts) por sub-tab
- **Objetivo**: visualizaciones.
- **Archivos esperados**: `app/app/[tenantSlug]/stats/*`, `components/charts/*`.
- **Dependencias**: T8.1.
- **Criterios de aceptación**:
  - Pie charts (Equipo count, Canal count).
  - Bar charts (Embudo, Equipo value, Canal value, Productos).
  - Top performers list (Resumen).
  - Tooltips con currency formateado.
- **Tests requeridos**: E2E de navegación entre sub-tabs.
- **Notas**: §3.5 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Componentes chart wrappers.
  - [ ] Sub-tab pages.
  - [ ] Listado tabla con shadcn data-table.

### T8.3 Filtro de rango de fecha global del panel
- **Objetivo**: rango aplicable a todas las sub-tabs.
- **Archivos esperados**: `features/stats/components/RangePicker.tsx`.
- **Dependencias**: T8.1.
- **Criterios de aceptación**:
  - Presets (`all`, `today`, `week`, `month`, `quarter`, `year`, `custom`).
  - URL params persisten selección.
- **Tests requeridos**: E2E "cambiar rango y ver KPIs cambiar".
- **Notas**: §7.10 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Componente.
  - [ ] Sync con queries.

---

## Milestone M9 — Plantilla industria aquasistemas

### T9.1 IndustryTemplate aquasistemas (seed)
- **Objetivo**: payload completo de la plantilla.
- **Archivos esperados**: `prisma/seed/industry-aquasistemas.ts`.
- **Dependencias**: T2.2, T4.3, T4.4.
- **Criterios de aceptación**:
  - Pipeline default 6 stages: prospecto / contactado / cotizacion / negociacion / ganado(locked) / perdido(locked).
  - CatalogItems para `equipment` (Bomba, Jacuzzi, Sauna, Calentador, Filtro, Hidrojet, Servicio Técnico, Iluminación), `salesChannel` (Sala, Teléfono, WhatsApp, Facebook, Instagram), `dealStatus` (Activo, Seguimiento, Esperando, Frío, Urgente), `followupReason` (los 6).
  - TenantSettings default con `dealIdPrefix=AQX`, `locale=es-GT`, `currency=GTQ`.
  - Branding default con colores y productName placeholder.
- **Tests requeridos**: integration "aplicar plantilla a tenant nuevo y verificar todo el contenido".
- **Notas**: §9, §24, §6.1–6.3 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Construcción del payload.
  - [ ] Función `applyAquasistemasTemplate(tenantId, tx)`.
  - [ ] Test de aplicación.

### T9.2 Aplicar plantilla en onboarding
- **Objetivo**: que T3.2 invoque la plantilla al crear tenant con `industrySlug=aquasistemas`.
- **Archivos esperados**: `lib/industry/registry.ts`, ajuste de `createTenant`.
- **Dependencias**: T9.1, T3.2.
- **Criterios de aceptación**:
  - Onboarding ofrece "Aquasistemas (Guatemala)" como única opción V1.
  - Tras seleccionar y crear, el tenant tiene catálogos, pipeline, branding y settings inicializados.
- **Tests requeridos**: E2E "signup → onboarding → ver pipeline con 6 columnas".
- **Notas**: §9.
- **Subtasks**:
  - [ ] Registry indexado por slug.
  - [ ] Wire-up en createTenant.
  - [ ] UI de selección de industria.

---

## Milestone M10 — Hardening, tests, demo data

### T10.1 Test suite E2E (Playwright) cubriendo flujos clave
- **Objetivo**: cobertura E2E de los flujos críticos.
- **Archivos esperados**: `tests/e2e/*.spec.ts`.
- **Dependencias**: M5–M9.
- **Criterios de aceptación**:
  - Specs: signup, onboarding aquasistemas, crear deal, mover en kanban, agregar quote, marcar ganado, agregar payment, agregar follow-up, completar follow-up, búsqueda, branding cambio.
  - CI corre Playwright y bloquea merge si rojo.
- **Tests requeridos**: los propios E2E.
- **Notas**: §17.
- **Subtasks**:
  - [ ] Setup Playwright + fixtures.
  - [ ] Specs (uno por flujo).
  - [ ] CI workflow.

### T10.2 Accesibilidad mínima (kanban teclado, aria-labels)
- **Objetivo**: cubrir lo básico de a11y.
- **Archivos esperados**: revisiones en componentes existentes.
- **Dependencias**: M5.
- **Criterios de aceptación**:
  - Kanban funcional con teclado (`@dnd-kit` keyboard sensor activo).
  - Modales con focus trap.
  - Inputs con `<label>` o `aria-label`.
  - Color contraste AA en stage badges y status badges.
- **Tests requeridos**: axe-core en E2E.
- **Notas**: §11, §15 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Auditoría axe.
  - [ ] Fixes.

### T10.3 Performance pass (índices, paginación, queries)
- **Objetivo**: validar performance con dataset de carga.
- **Archivos esperados**: `tests/integration/perf.test.ts`, eventuales índices nuevos.
- **Dependencias**: M5–M8.
- **Criterios de aceptación**:
  - Pipeline con 1000 deals carga en < 500ms server-side.
  - Stats agregaciones < 200ms.
  - Búsqueda < 200ms con 10k filas.
- **Tests requeridos**: bench script (no en CI obligatorio).
- **Notas**: §20.
- **Subtasks**:
  - [ ] Bench dataset.
  - [ ] Análisis EXPLAIN.
  - [ ] Índices adicionales si hace falta.

### T10.4 Demo tenant aquasistemas seed `pnpm seed:demo`
- **Objetivo**: poblar tenant `demo-aqua` con datos representativos.
- **Archivos esperados**: `prisma/seed/demo-aquasistemas.ts`, script `pnpm seed:demo`.
- **Dependencias**: T9.1, M5–M7.
- **Criterios de aceptación**:
  - Crea tenant `demo-aqua`, aplica plantilla, crea 4 collaborators (Roberto/Emanuel/Jhonatan/Leticia), crea 30 deals distribuidos por stage, agrega follow-ups variados (algunos vencidos, completados, futuros), 1 quote y 1 payment para deals en cotización/ganado.
  - Idempotente (re-ejecutar limpia y vuelve a sembrar).
  - NO usa imágenes base64; assets opcionales.
- **Tests requeridos**: integration "ejecutar seed y verificar conteos".
- **Notas**: §9 de ARCHITECTURE_PLAN, §1 de DEMO_INVENTORY.
- **Subtasks**:
  - [ ] Definir dataset.
  - [ ] Script idempotente.
  - [ ] Documentar en README.

---

## Cobertura del backlog vs DEMO_INVENTORY

Cada item `V1-obligatorio` del inventario debe quedar cubierto por al menos una task. Verificación cruzada (no exhaustiva — el agente que cierre M10 debe validar la matriz completa):

| Inventario | Tasks |
|---|---|
| Vistas Embudo / Clientes / Calendario / Archivo / Estadísticas | T5.3+T5.4 / T5.7 / T7.2 / T5.8 / T8.x |
| Modales ClientForm / DealDetail / Search / Settings | T5.2 / T5.5 / T5.9 / T4.x |
| Entidades Deal/Client/Collaborator/Stage/Channel/Equipment/ClientOverride | T2.2 + T5.1/T5.2 |
| Enums stage/status/FU_REASONS | T9.1 (catálogos default) |
| Reglas (id-gen, derivación cliente, alertas, días, overdue, history) | T2.4 / T5.1 / T6.2-T6.3 / T5.4-T5.5 / T7.3 / T5.6 |
| KPIs | T8.1 / T8.2 / T5.4 |
| Multitenant + auth + roles | M3 |
| Custom fields + catálogos + branding + pipeline configurable | M4 |
| Plantilla aquasistemas | M9 |
| Print Report (§3.8 DEMO_INVENTORY) | T5.11 |

Items `V1-inferido` (toasts, "sin resultados", FilePreviewModal, ConfirmDialog, accesibilidad teclado, mobile responsive) — cubiertos transversalmente en M5/M6/M10. Si al cerrar M10 quedan sueltos, agregar tasks en este `.md`.

Items `Post-V1` y `Decisión-pendiente` viven en `DECISIONS_AND_OPEN_QUESTIONS.md` y NO se trabajan en V1 sin aprobación del owner.

---

## Notas operativas finales

- Si una task crece más de lo esperado, divide en subtasks y agrégalas aquí ANTES de marcarlas done.
- Si descubres un comportamiento del demo no documentado en `DEMO_INVENTORY.md`, agrégalo allá ANTES de implementar.
- Si una decisión grande se desvía del plan, abre ADR en `docs/adr/` y referenciala en `DECISIONS_AND_OPEN_QUESTIONS.md`.
- Mantén `customData JSONB` cubierto por validación Zod siempre. Sin Zod, la columna se vuelve un agujero.
- Toda task que toque DB pasa por `withTenant()`. Sin excepciones para "una sola query rápida".
