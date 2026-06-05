# V2_BACKLOG.md

Backlog de **segunda iteración** para `crm-core/`. Aquí viven correcciones descubiertas en V1, deuda técnica aceptada, y funcionalidades nuevas que **no bloquean** el cierre de V1.

## Relación con otros documentos

| Documento | Rol |
|-----------|-----|
| `IMPLEMENTATION_BACKLOG.md` | V1 — scope cerrado (M1–M10) |
| `V2_BACKLOG.md` (este archivo) | Post-V1 — correcciones + features incrementales |
| `DECISIONS_AND_OPEN_QUESTIONS.md` | Decisiones tomadas y DP-* que migran aquí al resolverse como “Post-V1” |
| `ARCHITECTURE_PLAN.md` | Arquitectura base; cambios grandes de V2 requieren nota o ADR |

## Regla de oro (igual que V1)

Nada se marca como done hasta que funcione al 100% según criterios de aceptación, con tests verdes y verificación funcional real.

---

## Índice general

### Correcciones V1 → V2 (bugs y deuda descubierta en uso real)

- [ ] [V2-C01 Avatares: imagen sube pero no se visualiza](#v2-c01-avatares-imagen-sube-pero-no-se-visualiza)
- [ ] [V2-C02 Avatares: fallback cuando la URL falla](#v2-c02-avatares-fallback-cuando-la-url-falla)
- [ ] [V2-C03 Avatares: limpiar objeto anterior en R2 al reemplazar foto](#v2-c03-avatares-limpiar-objeto-anterior-en-r2-al-reemplazar-foto)
- [ ] [V2-C04 UI: contraste en botones ghost/secundarios sobre fondos claros](#v2-c04-ui-contraste-en-botones-ghostsecundarios-sobre-fondos-claros)
- [ ] [V2-C05 Storage: eliminar endpoint huérfano `/api/upload/avatar/sign`](#v2-c05-storage-eliminar-endpoint-huérfano-apiuploadavatarsign)
- [ ] [V2-C06 Storage: documentar y validar CORS de R2 para adjuntos en producción](#v2-c06-storage-documentar-y-validar-cors-de-r2-para-adjuntos-en-producción)

### Infraestructura y storage

- [ ] [V2-I01 Unificar estrategia de uploads (avatares vs adjuntos)](#v2-i01-unificar-estrategia-de-uploads-avatares-vs-adjuntos)
- [ ] [V2-I02 Proxy de media autenticado (alternativa a bucket público)](#v2-i02-proxy-de-media-autenticado-alternativa-a-bucket-público)
- [ ] [V2-I03 Reconciliación de storage (cron + botón recalcular)](#v2-i03-reconciliación-de-storage-cron--botón-recalcular)

### Usuarios y permisos

- [ ] [V2-U01 Edición de perfil propio fuera de Settings → Usuarios](#v2-u01-edición-de-perfil-propio-fuera-de-settings--usuarios)
- [ ] [V2-U02 Avatar visible en header, pipeline y calendario](#v2-u02-avatar-visible-en-header-pipeline-y-calendario)
- [ ] [V2-U03 Cancelar invitaciones pendientes](#v2-u03-cancelar-invitaciones-pendientes)

### Funcionalidades diferidas desde V1 (DP-* y gaps del demo)

- [ ] [V2-F01 Import/export CSV y Excel](#v2-f01-importexport-csv-y-excel) ← DP-02
- [ ] [V2-F02 i18n multi-idioma](#v2-f02-i18n-multi-idioma) ← DP-03
- [ ] [V2-F03 MFA (autenticación de dos factores)](#v2-f03-mfa-autenticación-de-dos-factores) ← DP-04
- [ ] [V2-F04 Multi-pipeline por tenant](#v2-f04-multi-pipeline-por-tenant) ← DP-08
- [ ] [V2-F05 Audit log global por tabla](#v2-f05-audit-log-global-por-tabla) ← DP-09
- [ ] [V2-F06 Subdominios por tenant](#v2-f06-subdominios-por-tenant) ← DP-12
- [ ] [V2-F07 Custom domain por tenant](#v2-f07-custom-domain-por-tenant)
- [ ] [V2-F08 Notificaciones in-app + preferencias de email](#v2-f08-notificaciones-in-app--preferencias-de-email)
- [ ] [V2-F09 SSO empresarial (SAML / SCIM)](#v2-f09-sso-empresarial-saml--scim)

---

## Plantilla por task

> **Objetivo**: una frase.
> **Prioridad**: P0 (bloqueante UX) / P1 (importante) / P2 (nice-to-have).
> **Archivos esperados**: rutas relativas a `crm-core/`.
> **Dependencias**: tasks V1 o V2 previas.
> **Criterios de aceptación**: lista verificable.
> **Tests requeridos**: unit / integration / E2E.
> **Notas / contexto**: por qué quedó para V2.
> **Subtasks**: con checkboxes.

---

## Correcciones V1 → V2

### V2-C01 Avatares: imagen sube pero no se visualiza

- **Objetivo**: que la foto de perfil subida se vea correctamente en el modal, la lista de miembros y cualquier otro lugar que use `User.image`.
- **Prioridad**: P0
- **Archivos esperados**: `app/api/upload/avatar/route.ts`, `lib/storage/s3.ts`, `features/users/components/EditMemberModal.tsx`, `features/users/components/users-settings.tsx`, posiblemente nuevo `app/api/media/[...key]/route.ts`.
- **Dependencias**: V1 edición de miembros (implementada parcialmente).
- **Criterios de aceptación**:
  - Subir JPG/PNG/WebP ≤ 2 MB → preview inmediato en modal sin icono roto.
  - Tras guardar y recargar, la foto persiste en lista de miembros.
  - La URL almacenada en `User.image` responde HTTP 200 desde el navegador.
  - Funciona en dev (Docker + R2) y en producción (Vercel + R2).
- **Tests requeridos**: integration test de upload + GET público (o proxy); E2E opcional en Settings → Usuarios.
- **Notas / contexto**:
  - **Síntoma actual (2026-06-01)**: el upload server-side a R2 responde 200 y guarda `User.image`, pero `<img src={url}>` muestra imagen rota. Indica desalineación entre dónde se escribe el objeto y cómo se sirve públicamente.
  - **Causas probables**:
    1. Bucket R2 sin acceso público de lectura en el dominio `S3_PUBLIC_URL` (r2.dev o custom domain).
    2. `S3_PUBLIC_URL` no coincide con la ruta real del objeto (`{tenantId}/avatars/{userId}/{uuid}.ext`).
    3. `S3_ENDPOINT` incluye path de bucket (`…/aqua-crm`) — verificar que `PutObject` y la URL pública apuntan al mismo bucket/key.
  - **Opciones de fix** (elegir una en implementación):
    - **A)** Configurar dominio público R2 + verificar env vars (más simple si el bucket puede ser público).
    - **B)** Proxy de lectura en Next.js (`GET /api/media/...`) que hace `GetObject` server-side — no depende de bucket público (ver V2-I02).
- **Subtasks**:
  - [ ] Reproducir: subir foto, inspeccionar `User.image` en DB, abrir URL en pestaña nueva y registrar status HTTP.
  - [ ] Verificar configuración R2: Public Access / r2.dev / custom domain vs `S3_PUBLIC_URL`.
  - [ ] Implementar fix elegido (A o B).
  - [ ] Verificar en modal + lista + refresh de página.

### V2-C02 Avatares: fallback cuando la URL falla

- **Objetivo**: nunca mostrar icono de imagen rota; volver a iniciales con color si la URL falla.
- **Prioridad**: P1
- **Archivos esperados**: componente compartido `components/ui/user-avatar.tsx` (nuevo), usado en `EditMemberModal`, `users-settings`, y resto de UI.
- **Dependencias**: ninguna (mejora defensiva; recomendable junto con V2-C01).
- **Criterios de aceptación**:
  - `onError` en `<img>` oculta la imagen y muestra iniciales.
  - Comportamiento consistente en modal y lista.
  - Sin texto `alt` desbordado fuera del círculo (bug visual actual).
- **Tests requeridos**: unit test del componente (render + onError).
- **Subtasks**:
  - [ ] Crear `UserAvatar` con props `{ userId, name, email, imageUrl, size }`.
  - [ ] Reemplazar `<img>` inline en settings de usuarios.
  - [ ] Migrar otros usos de avatar iniciales donde aplique.

### V2-C03 Avatares: limpiar objeto anterior en R2 al reemplazar foto

- **Objetivo**: evitar acumulación de avatares huérfanos en R2 al cambiar o quitar foto.
- **Prioridad**: P2
- **Archivos esperados**: `features/users/actions.ts`, `lib/storage/s3.ts`.
- **Dependencias**: V2-C01.
- **Criterios de aceptación**:
  - Al subir nueva foto, se elimina el objeto R2 anterior si la URL previa era del mismo tenant/user.
  - Al quitar foto, se borra el objeto y `User.image` queda `null`.
  - No borrar URLs externas (OAuth Google, etc.) — solo keys bajo `{tenantId}/avatars/`.
- **Tests requeridos**: integration test con mock de `deleteObject`.

### V2-C04 UI: contraste en botones ghost/secundarios sobre fondos claros

- **Objetivo**: garantizar legibilidad de acciones secundarias (“Quitar foto”, “Cancelar”, links ghost) en modales y cards con fondo claro/branding claro.
- **Prioridad**: P1
- **Archivos esperados**: `components/ui/button.tsx`, `app/globals.css`, posible revisión de variantes shadcn.
- **Dependencias**: fix de `--primary-foreground` por tenant (ya aplicado en V1 para botones `default`).
- **Criterios de aceptación**:
  - Botones ghost y outline tienen contraste WCAG AA mínimo sobre fondo de modal/card.
  - “Quitar foto” legible sin zoom.
  - No regresión en dark mode.
- **Tests requeridos**: revisión visual manual; opcional test de snapshot o lint de clases.
- **Notas**: el fix V1 de `--color-primary` hex→HSL resolvió botones `default`; ghost sigue usando `text-muted-foreground` que puede ser demasiado claro en algunos fondos.

### V2-C05 Storage: eliminar endpoint huérfano `/api/upload/avatar/sign`

- **Objetivo**: limpiar código muerto tras migrar avatares a upload server-side.
- **Prioridad**: P2
- **Archivos esperados**: eliminar `app/api/upload/avatar/sign/route.ts`.
- **Dependencias**: V2-C01 verificado.
- **Criterios de aceptación**: ninguna referencia al endpoint en código ni tests.

### V2-C06 Storage: documentar y validar CORS de R2 para adjuntos en producción

- **Objetivo**: asegurar que adjuntos de deals (flujo presigned URL) funcionen en producción.
- **Prioridad**: P1
- **Archivos esperados**: `README.md` o `docs/ops/r2-cors.md`, checklist de deploy.
- **Dependencias**: T6.1 (V1).
- **Criterios de aceptación**:
  - Documentación con policy CORS de ejemplo para R2 (origins de prod + preview Vercel, métodos `PUT`, headers `Content-Type`).
  - Verificación manual o E2E: subir adjunto en deal en entorno staging/prod.
- **Notas**: avatares **no** usan CORS (proxy server-side). Adjuntos **sí** requieren CORS en el bucket R2.

---

## Infraestructura y storage

### V2-I01 Unificar estrategia de uploads (avatares vs adjuntos)

- **Objetivo**: documentar decisión arquitectónica y, si conviene, converger patrones.
- **Prioridad**: P2
- **Estado actual en V1**:

  | Tipo | Flujo | CORS R2 | Cuota storage |
  |------|-------|---------|---------------|
  | Avatares | Browser → `POST /api/upload/avatar` → R2 server-side | No | No aplica |
  | Adjuntos deals | Browser → sign → PUT directo R2 → confirmUpload | Sí | Sí (`storageUsedBytes`) |

- **Criterios de aceptación**:
  - ADR o entrada en `DECISIONS_AND_OPEN_QUESTIONS.md` con decisión explícita.
  - Si se unifica: justificar trade-offs (límites Vercel 4.5 MB, timeouts, memoria).
- **Notas**: el proxy server-side para avatares **no es temporal** — es patrón válido para archivos pequeños. Adjuntos grandes deben seguir direct-to-R2.

### V2-I02 Proxy de media autenticado (alternativa a bucket público)

- **Objetivo**: servir archivos desde R2 vía API Next.js sin exponer bucket público.
- **Prioridad**: P1 (desbloquea V2-C01 opción B)
- **Archivos esperados**: `app/api/media/[...key]/route.ts`, `lib/storage/s3.ts` (`getObject`).
- **Criterios de aceptación**:
  - GET autenticado devuelve imagen con cache headers.
  - Multitenancy: solo miembros del tenant pueden leer `{tenantId}/avatars/*` y `{tenantId}/deals/*`.
  - `User.image` puede almacenar path relativo o URL del proxy.
- **Tests requeridos**: integration (403 cross-tenant, 200 same-tenant).

### V2-I03 Reconciliación de storage (cron + botón recalcular)

- **Objetivo**: corregir drift de `storageUsedBytes` vs objetos reales en R2.
- **Prioridad**: P2
- **Referencia**: spec M6 — diferido explícitamente a post-V1.
- **Criterios de aceptación**:
  - Cron nocturno o manual en Settings → General.
  - `ListObjectsV2` por prefix `{tenantId}/` → recalcula bytes.
- **Dependencias**: T6.1.

---

## Usuarios y permisos

### V2-U01 Edición de perfil propio fuera de Settings → Usuarios

- **Objetivo**: menú de usuario en header con “Mi perfil” (nombre, foto, contraseña).
- **Prioridad**: P2
- **Notas**: V1 permite editar propio perfil solo entrando a Settings → Usuarios como owner/admin editando su fila.

### V2-U02 Avatar visible en header, pipeline y calendario

- **Objetivo**: mostrar foto real del owner/asignado donde hoy solo hay iniciales de color.
- **Prioridad**: P2
- **Dependencias**: V2-C01.

### V2-U03 Cancelar invitaciones pendientes

- **Objetivo**: botón “Cancelar” en invitaciones pendientes de Settings → Usuarios.
- **Prioridad**: P2

---

## Funcionalidades diferidas desde V1

Items movidos desde `DECISIONS_AND_OPEN_QUESTIONS.md` §2 (DP-*) y preguntas del owner §3.

### V2-F01 Import/export CSV y Excel

- **Referencia**: DP-02
- **Prioridad**: P2

### V2-F02 i18n multi-idioma

- **Referencia**: DP-03 — V1 solo `es-GT`
- **Prioridad**: P2

### V2-F03 MFA (autenticación de dos factores)

- **Referencia**: DP-04
- **Prioridad**: P2

### V2-F04 Multi-pipeline por tenant

- **Referencia**: DP-08 — V1 = un pipeline por tenant
- **Prioridad**: P1

### V2-F05 Audit log global por tabla

- **Referencia**: DP-09 — V1 solo Activity por Deal
- **Prioridad**: P2

### V2-F06 Subdominios por tenant

- **Referencia**: DP-12 — V1 usa path `/[tenantSlug]`
- **Prioridad**: P2

### V2-F07 Custom domain por tenant

- **Referencia**: pregunta owner §3 #7
- **Prioridad**: P2

### V2-F08 Notificaciones in-app + preferencias de email

- **Referencia**: pregunta owner §3 #8
- **Prioridad**: P1

### V2-F09 SSO empresarial (SAML / SCIM)

- **Referencia**: pregunta owner §3 #5
- **Prioridad**: P2

---

## Log de descubrimientos V1 → V2

| Fecha | Hallazgo | Task V2 |
|-------|----------|---------|
| 2026-06-01 | Avatares: upload OK pero `<img>` rota — URL pública R2 no resuelve | V2-C01, V2-C02 |
| 2026-06-01 | Botón `default` ilegible: hex en `--color-primary` vs `hsl()` Tailwind | Corregido en V1 (`lib/branding/css-vars.ts`) |
| 2026-06-01 | Botones ghost (“Quitar foto”) bajo contraste en modales | V2-C04 |
| 2026-06-01 | Dos flujos de upload coexisten; CORS solo necesario para adjuntos | V2-I01, V2-C06 |
| 2026-06-01 | `/api/upload/avatar/sign` huérfano tras migración a proxy | V2-C05 |

---

## Convención de mantenimiento

- Nueva corrección descubierta en producción → agregar en **Correcciones V1 → V2** con prioridad P0/P1/P2.
- Nueva feature acordada con owner → agregar en sección correspondiente o crear milestone V2-M*.
- Al completar una task: marcar checkbox aquí y, si resuelve una DP-*, actualizar `DECISIONS_AND_OPEN_QUESTIONS.md`.
- Prioridad sugerida para arrancar V2: **V2-C01 → V2-C02 → V2-C06 → V2-I02** (storage/avatars), luego features según input del owner.
