# Contributing to koi-crm

## Lectura obligatoria antes de tocar código

Lee estos documentos en orden antes de cualquier implementación:

1. [DEMO_INVENTORY.md](./DEMO_INVENTORY.md) — qué hace la demo (fuente de requisitos)
2. [ARCHITECTURE_PLAN.md](./ARCHITECTURE_PLAN.md) — cómo está diseñado el producto real
3. [IMPLEMENTATION_BACKLOG.md](./IMPLEMENTATION_BACKLOG.md) — task que vas a ejecutar
4. [AGENT_RULES.md](./AGENT_RULES.md) — reglas operativas
5. [DECISIONS_AND_OPEN_QUESTIONS.md](./DECISIONS_AND_OPEN_QUESTIONS.md) — decisiones y riesgos

## Flujo de PR

1. Crea una rama desde `main`: `git checkout -b feat/<task-id>-descripcion`
2. Implementa la task siguiendo los criterios de aceptación del backlog
3. Verifica localmente antes de abrir el PR:
   - `pnpm type-check` → cero errores
   - `pnpm lint:check` → cero warnings
   - `pnpm test` → todos verdes
4. Abre el PR con título `feat: T<X.Y> <descripcion>` y descripción del cambio
5. El PR requiere al menos un review antes de mergear a `main`

## Definition of Done

Una task está done **solo si**:

- Todos sus criterios de aceptación del backlog están cumplidos
- Los tests especificados pasan (verdes, no skipped)
- `tsc --noEmit` pasa con zero errores
- `pnpm lint:check` pasa sin warnings nuevos
- Los checkboxes del backlog están tildados (índice + sección detallada)
- Si la task tocó DB: migración en `prisma/migrations/`, RLS probada contra Postgres real

## Reglas de repo

- **No tocar `hardcoded-demo/`** — es referencia histórica únicamente
- **No copiar código de `hardcoded-demo/`** — construir desde cero contra `DEMO_INVENTORY.md`
- **Todo el código real vive en `crm-core/`**
- Multitenancy obligatorio: toda tabla de negocio tiene `tenantId` + RLS activo
- `app_user` nunca tiene BYPASSRLS; `admin_user` solo para migrations/seeds
- No usar `"aquasistemas"` en core — solo en seeds y tests como identificador de tenant demo

Ver [AGENT_RULES.md](./AGENT_RULES.md) para las reglas completas.
