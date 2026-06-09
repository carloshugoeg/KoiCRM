# DECISIONS_AND_OPEN_QUESTIONS.md

Registro vivo de decisiones tomadas para V1, decisiones pendientes que necesitan input del owner, preguntas abiertas, riesgos principales, y log de relecturas inevitables de `hardcoded-demo/`.

Este archivo es **fuente de verdad operativa**: cuando una "Decisión pendiente" se resuelva, se mueve a "Decisiones tomadas" con fecha y, si aplica, referencia al ADR que la formaliza (`crm-core/docs/adr/NNNN-*.md`).

---

## 1. Decisiones tomadas en V1

Estas decisiones ya están consolidadas en `ARCHITECTURE_PLAN.md` y no requieren ADR retroactivo. Cualquier desviación futura sí requiere ADR.

| #   | Tema                       | Decisión                                                                                                            | Fuente                                                           | Consecuencia                                                                                       |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| D1  | Stack frontend+backend     | **Next.js 14 (App Router) + TypeScript strict**                                                                     | `ARCHITECTURE_PLAN.md` §1                                        | RSC + Server Actions; un solo build; sin Express.                                                  |
| D2  | DB + ORM                   | **PostgreSQL 15+ con RLS, Prisma como ORM**                                                                         | §1, §3, §5                                                       | Migraciones versionadas; RLS como defensa en profundidad por tenant.                               |
| D3  | Auth                       | **Auth.js v5 (NextAuth) con email+password + OAuth Google**                                                         | §1, §4                                                           | Cookies httpOnly, RBAC propio. Clerk queda documentado como swap-in. Google opcional vía `GOOGLE_*`; mismo email con password y Google muestra `OAuthAccountNotLinked` (login con contraseña). |
| D4  | Object storage             | **S3-compatible (Cloudflare R2 default)**                                                                           | §1                                                               | Uploads firmados; reemplaza base64 en DB del demo.                                                 |
| D5  | Email transaccional        | **Resend default**, Postmark/SES alternativos                                                                       | §1                                                               | Para invitaciones, password reset, alertas.                                                        |
| D6  | UI primitives              | **Tailwind 3 + shadcn/ui (Radix)**                                                                                  | §1                                                               | Componentes accesibles; cero copia de código del demo.                                             |
| D7  | Charts                     | **Recharts**                                                                                                        | §1                                                               | Mismo motor que demo; solo API pública.                                                            |
| D8  | Forms + validación         | **React Hook Form + Zod** (schemas compartidos cliente/servidor)                                                    | §1                                                               | Single source of truth para validaciones.                                                          |
| D9  | DnD kanban                 | **@dnd-kit/core** (no react-beautiful-dnd)                                                                          | §1                                                               | Accesible, soporte teclado.                                                                        |
| D10 | Tests                      | **Vitest** unit, **Postgres real en Docker** integration, **Playwright** E2E                                        | §1                                                               | RLS solo se valida con Postgres real, no mock.                                                     |
| D11 | Multitenancy: identidad    | **Org → Tenant → Memberships → Users**, slug routing `/[tenantSlug]`                                                | §3                                                               | Un usuario puede pertenecer a múltiples tenants; tenant resolver en layout.                        |
| D12 | Multitenancy: aislamiento  | **`tenantId` en toda tabla de negocio + RLS por tenant + helper `withTenant()`**                                    | §3, §5                                                           | App filtra siempre; RLS atrapa fugas. Sin excepciones.                                             |
| D13 | Modelo de datos extensible | **Core fuerte (Deal, Client, etc.) + `customData JSONB` validado por `CustomFieldDefinition` con Zod**              | §6                                                               | Balance entre integridad e industria-agnostico. JSONB sin Zod = bug.                               |
| D14 | Pipeline configurable      | **Tabla `Stage` por tenant con orden y semántica** (default 6 stages aquasistemas, editables por tenant)            | §7                                                               | Multi-pipeline marcado como Decision-pendiente (DP-08).                                            |
| D15 | Catálogos por tenant       | **`CatalogItem` con tipo (equipment, channel, status, fu-reason, etc.)** y seed de plantilla por industria          | §8                                                               | Catálogos editables sin fork del producto.                                                         |
| D16 | Branding white label       | **`TenantBranding` (logo, colores, favicon)** aplicado vía CSS variables en layout autenticado                      | §17                                                              | Cambio inmediato sin deploy.                                                                       |
| D17 | Locale + currency          | **`TenantSettings.locale` + `TenantSettings.currency`**; default `es-GT` + `GTQ`                                    | §18                                                              | `Intl.NumberFormat` y `date-fns`; sin hardcode.                                                    |
| D18 | ID generator de Deal       | **Counter atómico por tenant + formato `tenantPrefix-counter-initials-YY`**; default `dealIdPrefix=AQX`             | §6, §10                                                          | Counter en tabla con `SELECT … FOR UPDATE` o secuencia Postgres. Formato exacto pendiente (DP-10). |
| D19 | Plantilla aquasistemas     | **Seed `prisma/seed/industry-aquasistemas.ts`** con stages, catálogos, dealIdPrefix=AQX, locale es-GT, currency GTQ | §24                                                              | Aquasistemas es plantilla de industria, no código del core.                                        |
| D20 | Anti-leakage de industria  | Las palabras `aquasistemas/AQX/Bomba/Jacuzzi` solo pueden aparecer en seeds e tests                                 | §24                                                              | Si aparecen en core, es bug.                                                                       |
| D21 | Activity log               | Tabla `Activity(tenantId, dealId, userId, type, payload, ts)` reemplaza el array `history` embebido del demo        | `DEMO_INVENTORY.md` §16                                          | Paginable, indexable.                                                                              |
| D22 | Logger                     | **pino con correlación por requestId**                                                                              | §1                                                               | JSON logs, ligero.                                                                                 |
| D23 | Estrategia de demo data    | Seeds separados, marcados como demo, **reemplazables**; nunca como fuente real del sistema                          | `prompt1.md` Restricción 8                                       | `prisma/seed/demo-aquasistemas.ts`.                                                                |
| D24 | Definición de done         | Multitenancy + RLS + tests + persistencia real + validación Zod + sin datos hardcodeados como fuente                | `IMPLEMENTATION_BACKLOG.md` "Regla de oro" + `AGENT_RULES.md` §4 | "Compila" no es done.                                                                              |
| D25 | Acceso al embudo           | **`Membership.status` (ACTIVE/INACTIVE) + `Tenant.subscriptionValidated`**; gate en layout y `/app/access` con invitación y contacto de renovación | Solicitud producto 2026-06-03                                    | Nuevos tenants arrancan sin validar; miembros bloqueados si el owner no tiene licencia validada. Activar: `UPDATE "Tenant" SET "subscriptionValidated" = true WHERE slug = '…'`. |
| D26 | Unión al equipo            | **`JoinLink`** reutilizable con `role` editable; aceptación en `/api/join/accept` sin email fijo; invitación por email (`Invitation`) legada | Solicitud producto 2026-06-03                                    | UI en Ajustes → Colaboradores: generar/copiar/revocar enlaces; actualizar permiso del enlace afecta solo nuevos ingresos. |
| D27 | PIN por propiedad del lead | **`TenantSettings.pinEnabled`**: PIN solo al tocar leads de otro asesor; leads propios sin PIN. **Session PIN lock** (barra superior): PIN en todos los cambios del usuario mientras esté activo. | Solicitud producto 2026-06-09                                    | `resolveActionActor` recibe `dealId` o `targetOwnerId`; `isPinRequiredForDealAction` centraliza la regla. |

---

## 2. Decisiones pendientes (requieren input del owner)

Estas viven en `DEMO_INVENTORY.md §17` como "Decisión-pendiente". Resolverlas antes de cerrar V1.

| #     | Tema                                    | Opciones                                                                   | Default tentativo si no hay decisión                                              | Bloquea task                                                                      |
| ----- | --------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| DP-01 | **Política de delete**                  | Hard-delete                                                                | Soft-delete (`archivedAt`)                                                        | Soft-delete por defecto, hard-delete solo para owner del tenant con confirmación. | T5.8 (Archive), borrado de Client/Deal. |
| DP-02 | **Importar/exportar CSV/Excel**         | V1 / Post-V1                                                               | Post-V1 (no aparece explícito en demo).                                           | M5/M9.                                                                            |
| DP-03 | **i18n**                                | V1 / Post-V1                                                               | Post-V1; V1 solo `es-GT` (igual que demo).                                        | M4 (TenantSettings).                                                              |
| DP-04 | **MFA**                                 | V1 / Post-V1                                                               | Post-V1; V1 expone hooks pero no UI.                                              | T3.1.                                                                             |
| DP-05 | **Hosting de la app**                   | Vercel / Fly / propio (Docker en VPS) / otro                               | Vercel para V1 (deploy más rápido).                                               | M1, infra.                                                                        |
| DP-06 | **Postgres provider**                   | Supabase / Neon / RDS / Railway / propio                                   | Neon para V1 (RLS soportado, branching útil para staging).                        | M1, T1.4.                                                                         |
| DP-07 | **Storage / email providers concretos** | R2 vs S3, Resend vs Postmark vs SES                                        | R2 + Resend (default del plan).                                                   | T6.1, T3.6.                                                                       |
| DP-08 | **Multi-pipeline**                      | V1 / Post-V1                                                               | Post-V1; V1 = un pipeline por tenant.                                             | T4.4.                                                                             |
| DP-09 | **Auditoría**                           | Solo Activity por Deal / Audit log global por tabla                        | Solo Activity por Deal en V1; audit global Post-V1.                               | T5.6.                                                                             |
| DP-10 | **Formato exacto de IDs Deal** ⚠️ corregido | (A) calcar demo `0032-AQX-RO-26` = **counter-prefijo-iniciales-YY** / (B) actual impl `AQX-0032-RO-26` = prefijo-counter-iniciales-YY | **A** si el objetivo es calco exacto (el demo, `SalesFunnel.jsx:3847`, pone el counter PRIMERO). El generador actual (`lib/id/deal-id.ts`) usa B. **Marcado para confirmación del owner** (sesión paridad 2026-06-01). | T2.4. |
| DP-11 | **Retención de datos / GDPR-like**      | Sin política V1 / política básica V1                                       | Política básica: export por tenant + delete por tenant; retención formal Post-V1. | M3, M4.                                                                           |
| DP-12 | **Subdomains por tenant**               | Slug en path `/[tenantSlug]` / subdomain `tenant.app.com`                  | Path en V1 (DNS más simple); subdomain Post-V1.                                   | T3.3.                                                                             |

**Convención**: cuando se resuelva una DP-N, mover a §1 con número D-N+, fecha de resolución y, si la decisión fue grande, referencia al ADR.

---

## 3. Preguntas para el owner

No son decisiones aún; son inputs que el owner debe proveer para destrabar diseño.

1. **Industrias post-V1 prioritarias**: ¿qué industria es la siguiente? (Define qué tan generalizable debe ser el catálogo de plantillas en V1.)
2. **Reuso de IDs tras hard-delete**: si DP-01 se resuelve a hard-delete, ¿el `dealCounter` reusa IDs liberados o sigue monotónico? (Default: monotónico.)
3. **Subdominios y DNS**: si DP-12 se resuelve a subdomain, ¿quién administra el dominio raíz y certificados wildcard?
4. **Residencia de datos**: ¿hay requisito de hosting en LATAM / región específica para clientes aquasistemas u otros? (Afecta DP-05/DP-06.)
5. **SSO empresarial**: ¿algún cliente piloto requiere SAML/SCIM en V1, o queda Post-V1?
6. **Política de invitaciones**: ¿tenant owner puede invitar ilimitado o hay cuota por plan?
7. **Branding**: ¿se permite custom domain por tenant en V1 o solo logo+colores+favicon?
8. **Notificaciones por email vs in-app**: el demo no muestra notificaciones; ¿qué eventos disparan email vs sólo activity log?
9. **Time zone**: ¿es por tenant o por usuario? El demo asume `America/Guatemala`.
10. **Onboarding**: ¿quién paga por el dominio del primer tenant en signup? ¿hay free trial?

### 3.1 Confirmaciones pendientes — sesión paridad demo→PROD (2026-06-01)

Defaults aplicados (sensatos) que el owner debe confirmar. Detalle de paridad visual en `PARITY_AUDIT.md`.

| Tema | Default aplicado en esta sesión | Confirmar |
| --- | --- | --- |
| **Delete (DP-01)** | Soft-delete / archivado; sin hard-delete en UI. | ¿OK o se requiere hard-delete para el owner? |
| **Formato ID Deal (DP-10)** | Se mantiene `AQX-0032-RO-26` (impl actual). El demo usa `0032-AQX-RO-26`. **No cambiado** por implicar generador+seed+test y consistencia de IDs existentes. | ¿Calcar el orden del demo (counter primero) o conservar el actual? |
| **Settings: panel vs página** | Se conserva la **página** con tabs (mejor para white-label/PROD); el demo usa panel deslizante (Sheet). Contenido equivalente. | ¿Aceptable como página o se quiere el Sheet deslizante? |
| **Header avanzado** | Diferido: input de búsqueda siempre visible, toggle rápido de tema, y botones "Nueva Oportunidad"/imprimir en el header (en CRM viven dentro de cada vista). | ¿Prioridad para igualar el header del demo? |
| **Checkbox Google Calendar en seguimiento** | Fuera de V1 (sync GCal diferido a post-V1). | ¿Confirmar que queda post-V1? |
| **Línea de stats por cliente** | Parcial: se muestra "N oportunidades". Falta "N activas · Ganado $$" (requiere agregados por cliente con costo de performance). | ¿Incluir agregados completos por fila? |

---

## 4. Riesgos principales

| #   | Riesgo                                                                                                | Impacto                               | Mitigación                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **RLS mal configurada** → fuga de datos entre tenants.                                                | Crítico (privacidad, compliance).     | Tests de integración con dos tenants en Postgres real (T3.5); revisión obligatoria en code review de cualquier policy.          |
| R2  | **`customData JSONB` sin validación Zod** → corrupción de datos.                                      | Alto (datos rotos, queries fallidas). | Regla en `AGENT_RULES.md` §6; helper de boundaries que rechaza writes sin Zod.                                                  |
| R3  | **ID-generator race condition** → IDs duplicados.                                                     | Alto (constraint violation, UX rota). | Counter atómico con `SELECT … FOR UPDATE` o secuencia Postgres dedicada por tenant; test de concurrencia.                       |
| R4  | **Branding via CSS variables en SSR** → flash de estilo no aplicado (FOUC).                           | Medio (UX).                           | Resolver branding en RSC layout antes de render; inyectar `<style>` server-side.                                                |
| R5  | **Activity log sin paginación** → consultas lentas en deals con muchos eventos.                       | Medio (performance).                  | Índice en `(tenantId, dealId, ts DESC)` + paginación cursor-based en UI.                                                        |
| R6  | **Leak de "aquasistemas" en core** → fork por industria, no white label real.                         | Alto (rompe el modelo de negocio).    | Lint rule + grep en CI; regla en `AGENT_RULES.md` §5.                                                                           |
| R7  | **Migraciones de `CustomFieldDefinition` sin estrategia** → datos huérfanos al eliminar definiciones. | Medio.                                | Soft-deprecate de definiciones con datos; migración explícita documentada por cambio.                                           |
| R8  | **Auth.js v5 cambios breaking** → bloqueo durante upgrade.                                            | Bajo-Medio.                           | Pin de versión + plan de upgrade documentado; abstracción mínima del adapter.                                                   |
| R9  | **RLS policies y `withTenant()` divergen** → query bypass de aislamiento.                             | Crítico.                              | `withTenant()` es la ÚNICA forma de abrir conexión transaccional; lint rule contra `prisma.$queryRaw` directo fuera de helpers. **Mitigado (2026-06-02):** `getCatalogItems` / `getCatalogItemUsageCount` en `features/catalogs/queries.ts` usan `withTenant()`; lecturas sin contexto devolvían 0 filas y el alta de Equipos parecía fallar en silencio. |
| R10 | **Demo data filtrada a producción** → tenants reales con seeds aquasistemas mezclados.                | Alto.                                 | Seeds demo solo en entorno dev/staging; flag `DATABASE_URL` separada; CI bloquea seed demo en producción.                       |

---

## 5. Log de relecturas inevitables de `hardcoded-demo/`

Cualquier agente que necesite releer `hardcoded-demo/` después del scan inicial debe registrar la relectura aquí. Si descubre algo nuevo, agregarlo primero a `DEMO_INVENTORY.md` antes de implementar.

| Fecha (YYYY-MM-DD) | Agente / Sesión              | Archivo releído                                       | Motivo                                                                                                                  | Hallazgo nuevo registrado en                                                                                                                                                                                                                          |
| ------------------ | ---------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-01         | Agente de verificación Task1 | `hardcoded-demo/src/SalesFunnel.jsx` líneas 2499–4813 | Verificar cobertura del scan inicial (StatsPanel, ArchivePage, ClientsPage, CalendarView, main component, print layout) | Tres gaps nuevos integrados en `DEMO_INVENTORY.md`: (1) Print Report feature con layout completo; (2) Scope real de alerta "Falta Cotización" incluye stage `contactado` (no solo `cotizacion`+); (3) Pre-carga de ClientFormModal desde ClientsPage. |
| 2026-06-01         | Sesión usuarios/avatares     | —                                                     | Bug avatares: upload OK, imagen rota en UI                                                                              | `V2_BACKLOG.md` V2-C01, V2-C02; log § final                                                                                                                                                                                                          |

**Política**:

- No releer por costumbre.
- Si la duda se puede resolver con búsqueda dirigida en `DEMO_INVENTORY.md`, no es necesario abrir el demo.
- Si abres el demo, lee solo el archivo y sección relevante.
- Si el hallazgo cambia comportamiento esperado, actualiza `DEMO_INVENTORY.md` y, si aplica, abre/actualiza tasks en `IMPLEMENTATION_BACKLOG.md` antes de implementar.

---

## 6. Convención de mantenimiento

- **Resolver una DP**: mover el row de §2 a §1 con nuevo número (D-N+), fecha (`YYYY-MM-DD`), y referencia al ADR si la decisión fue grande.
- **Nueva decisión grande durante implementación**: ADR en `crm-core/docs/adr/NNNN-titulo.md` + entrada en §1 referenciando el ADR.
- **Nuevo riesgo descubierto**: agregar a §4 con mitigación propuesta antes de cerrar la task que lo expuso.
- **Pregunta del owner respondida**: borrar de §3 (o moverla a §1/§2 si se convirtió en decisión).
- Mantener este archivo bajo 300 líneas. Si crece más, dividir en docs por dominio (auth, multitenancy, data model) y dejar este como índice.
