# AGENT_RULES.md

Reglas operativas para cualquier agente de código que trabaje dentro de `crm-core/`. Este archivo complementa `../AGENTS.md` (reglas a nivel repo) con instrucciones específicas de cómo ejecutar tasks dentro del producto real. Cuando un agente abre una sesión nueva, lee este archivo después de los otros docs de `crm-core/` y antes de tocar cualquier línea de código.

---

## 1. Lectura inicial obligatoria

Antes de cualquier acción de implementación, lee en este orden:

1. `crm-core/DEMO_INVENTORY.md` — qué hace el demo (fuente de requisitos).
2. `crm-core/ARCHITECTURE_PLAN.md` — cómo está diseñado el producto real.
3. `crm-core/IMPLEMENTATION_BACKLOG.md` — qué task vas a ejecutar y sus criterios (V1).
4. `crm-core/V2_BACKLOG.md` — solo si trabajas en post-V1 (correcciones y features V2).
5. `crm-core/AGENT_RULES.md` — este archivo.
6. `crm-core/DECISIONS_AND_OPEN_QUESTIONS.md` — decisiones tomadas, pendientes y riesgos.

Si vas a trabajar una task acotada, lee solo las secciones relevantes (índice + sección detallada de la task + tabla §24 de `ARCHITECTURE_PLAN` si tocas core vs plantilla). No leas los 5 archivos completos cada vez.

---

## 2. Límites del repo

- **No tocar `hardcoded-demo/`**: ni editar, ni borrar, ni reformatear, ni reorganizar. Es referencia histórica, nada más.
- **No copiar código de `hardcoded-demo/`**: ni componentes, ni hooks, ni estilos, ni utilidades, ni JSON. La V1 se construye desde cero contra `DEMO_INVENTORY.md`.
- **No releer `hardcoded-demo/` por costumbre**: el inventario ya capturó todo. Si necesitas releerlo, debe ser por una duda crítica imposible de resolver con `DEMO_INVENTORY.md`. En ese caso, anota la relectura en la tabla §5 de `DECISIONS_AND_OPEN_QUESTIONS.md` (fecha, agente, archivo, motivo, hallazgo) y, si descubres algo nuevo, agrégalo primero a `DEMO_INVENTORY.md` antes de implementar.
- **Todo trabajo real vive en `crm-core/`**: código, tests, migraciones, seeds, schemas, ADRs, scripts.

---

## 3. Ejecución de tasks

- Toma cada task desde `IMPLEMENTATION_BACKLOG.md`. No improvises tasks fuera del backlog.
- Antes de iniciar: confirma que entiendes objetivo, dependencias, criterios de aceptación y tests requeridos. Si una dependencia no está done, no avances.
- Si descubres subtasks nuevas durante la implementación, **agrégalas al `.md` antes de resolverlas**. Nunca marques done una task con subtasks ocultas.
- Si una task crece más de lo esperado, divídela en subtasks dentro del backlog antes de seguir.
- Si una task requiere desviarse del plan arquitectural, **detente**, abre un ADR en `crm-core/docs/adr/`, referénciala en `DECISIONS_AND_OPEN_QUESTIONS.md`, y pide aprobación antes de seguir.
- Si algo no funciona, no improvises una solución temporal que ensucie el código. Tómate el tiempo necesario para implementar la solución correcta siguiendo el plan arquitectural.
- Si estás estancado o no entiendes algo, pide ayuda o clarification en lugar de hacer conjeturas. Es mejor preguntar que implementar algo incorrecto.
- SIEMPRE marca como done cuando termines cada task y cada subtask con "[x]" en los archivos correspondientes. Esto para que futuros agentes sepan que ya esta implementado

---

## 4. Definición de "done"

Una task solo se marca como done cuando **todo** lo siguiente es cierto:

- [ ] Funciona en la app real (`crm-core/`), no solo "compila".
- [ ] La persistencia es real (Postgres), no in-memory ni JSON file.
- [ ] El multitenancy está respetado: tablas con `tenantId`, queries vía `withTenant()`, RLS activa, UI scoped al tenant actual.
- [ ] RBAC: cada acción verifica el rol del usuario contra la policy correspondiente.
- [ ] Validaciones presentes en cliente (Zod + RHF) **y** en servidor (Zod en server actions / endpoints).
- [ ] Errores principales manejados (sin `try {} catch {}` vacíos).
- [ ] Tests del módulo escritos o actualizados; tests relevantes pasan en CI local.
- [ ] No hay datos hardcodeados sirviendo como fuente real (sí pueden vivir en seeds marcados como demo).
- [ ] Documentación o backlog actualizados si la implementación reveló cambios.

"Pendiente de probar", "creo que funciona", "compila pero no lo corrí" **no son done**.

---

## 5. Multitenancy y anti-leakage de industria

- **Toda tabla de negocio lleva `tenantId`** y todas sus queries pasan por `withTenant()`. Sin excepciones "para una sola query rápida".
- **RLS en Postgres es la red de seguridad**, no la primera línea. La app filtra por `tenantId` siempre; RLS es defensa en profundidad.
- **El core no menciona aquasistemas**. Las palabras `aquasistemas`, `AQX`, `Bomba`, `Jacuzzi`, `Filtro`, etc., **solo pueden aparecer** en:
  - `crm-core/prisma/seed/industry-aquasistemas.ts`
  - `crm-core/prisma/seed/demo-aquasistemas.ts`
  - Tests que validen la plantilla aquasistemas.
- Si te encuentras escribiendo un `if (industry === 'aquasistemas')` en `app/`, `features/`, `components/` o `lib/`, **es bug**. Convierte el caso en configuración, custom field, o regla de catálogo.
- Ver §24 de `ARCHITECTURE_PLAN.md` para la tabla completa core / plantilla / tenant.
- **`withTenant()` es obligatorio**: cualquier query a tablas de negocio (Deal, Client, Pipeline, CatalogItem, etc.) desde server actions o API routes DEBE pasar por `withTenant(tenantId, tx => ...)` de `lib/db/rls.ts`. No existe excepción para "una query rápida". Si no tienes el tenantId disponible en ese punto, es señal de que falta resolver el tenant antes.

---

## 6. Custom data integrity

- `customData JSONB` **siempre** se valida contra el `CustomFieldDefinition` correspondiente vía Zod, tanto al escribir como al leer en boundaries (server actions, endpoints).
- Sin Zod, la columna se vuelve un agujero de datos. Esta regla no se relaja por urgencia.
- Migrar definiciones de campos custom requiere migración explícita (rename, soft-deprecate, backfill); no eliminar definiciones que tengan datos sin estrategia documentada.

---

## 7. Decisiones grandes y ADRs

- Las decisiones arquitecturales ya tomadas para V1 viven en `DECISIONS_AND_OPEN_QUESTIONS.md` (no requieren ADR retroactivo).
- **Cualquier desviación o nueva decisión grande** durante implementación abre un ADR en `crm-core/docs/adr/NNNN-titulo.md` siguiendo la plantilla de `ARCHITECTURE_PLAN.md` §23, y se referencia desde `DECISIONS_AND_OPEN_QUESTIONS.md`.
- Decisiones triviales de implementación (qué nombrar un helper, dónde poner un util) no necesitan ADR; sí necesitan consistencia con lo ya existente.

---

## 8. Preservación de tokens

- **No releer `hardcoded-demo/` por costumbre.** El inventario es la fuente de verdad.
- **Búsquedas dirigidas** por nombre de módulo, entidad, task o archivo en lugar de leer carpetas completas.
- **Lee archivos grandes por secciones** (offset/limit) cuando sea suficiente.
- **Resume hallazgos** en el documento correspondiente (`DEMO_INVENTORY.md`, `IMPLEMENTATION_BACKLOG.md`, `DECISIONS_AND_OPEN_QUESTIONS.md`) para que el siguiente agente no repita el análisis.
- **Evita duplicar contenido** entre los 5 docs: enlaza o referencia secciones en lugar de copiar.
- **Antes de abrir muchos archivos**, define qué pregunta intentas responder y qué archivo es más probable que la responda.
- **Notas breves y accionables**, no narrativa larga. Bullets > párrafos.
- **No sleep loops, no retry sin diagnóstico**: si algo falla, lee el error.
- **Cualquier relectura inevitable de `hardcoded-demo/` se registra** en la tabla §5 de `DECISIONS_AND_OPEN_QUESTIONS.md`.

---

## 9. Marcado de progreso en `IMPLEMENTATION_BACKLOG.md`

- Cuando completes una **subtask**, marca su checkbox `- [ ]` → `- [x]` en el lugar exacto donde aparece.
- Cuando completes **todas** las subtasks de una task, marca también la task específica como done.
- Cuando una task quede done, **marca también la entrada correspondiente en el "Índice general"** al inicio del backlog. Doble marcado, no opcional.
- Si una task queda parcial: déjala sin marcar y agrega una nota breve al lado con el estado real (qué sí, qué no, por qué).
- **Nunca marques done basado en intención**: el checkbox refleja realidad verificada, no expectativa.

---

## 10. Pre-flight de cada cambio

Antes de cerrar una sesión de trabajo:

1. ¿La task que tomaste cumple los 9 criterios de §4?
2. ¿Marcaste subtask + task + índice general?
3. ¿Agregaste subtasks descubiertas antes de cerrarlas?
4. ¿Actualizaste `DECISIONS_AND_OPEN_QUESTIONS.md` si tomaste una decisión grande?
5. ¿Tests pasan localmente?
6. ¿Documentaste relectura del demo si hubo?

Si alguna respuesta es "no", la task no está done. No la marques.
