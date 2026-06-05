# FEATURES.md — Inventario completo de KoiCRM

Documento maestro de **todas las features** del CRM real en `crm-core/`. Consolida lo definido en `DEMO_INVENTORY.md`, `ARCHITECTURE_PLAN.md`, `IMPLEMENTATION_BACKLOG.md`, `V2_BACKLOG.md` y lo verificado en el código.

**Última actualización:** 2026-06-01  
**Alcance V1:** M1–M10 marcados como completados en el backlog  
**Producto:** CRM white-label, multitenant, modular, adaptable por industria (plantilla inicial: aquasistemas)

---

## Tabla de contenidos

1. [Visión del producto](#1-visión-del-producto)
2. [Plataforma y foundation](#2-plataforma-y-foundation)
3. [Autenticación e identidad](#3-autenticación-e-identidad)
4. [Multitenancy y aislamiento](#4-multitenancy-y-aislamiento)
5. [Shell de aplicación y navegación](#5-shell-de-aplicación-y-navegación)
6. [Módulos principales (vistas)](#6-módulos-principales-vistas)
7. [Modales y formularios](#7-modales-y-formularios)
8. [Entidades de datos](#8-entidades-de-datos)
9. [Configuración (Settings)](#9-configuración-settings)
10. [Reglas de negocio](#10-reglas-de-negocio)
11. [KPIs, métricas y alertas](#11-kpis-métricas-y-alertas)
12. [Almacenamiento, adjuntos y documentos](#12-almacenamiento-adjuntos-y-documentos)
13. [Motor de campos personalizados](#13-motor-de-campos-personalizados)
14. [Plantillas de industria](#14-plantillas-de-industria)
15. [Internacionalización y formato](#15-internacionalización-y-formato)
16. [Seguridad y autorización](#16-seguridad-y-autorización)
17. [Observabilidad, errores y UX transversal](#17-observabilidad-errores-y-ux-transversal)
18. [Seeds, demo y developer experience](#18-seeds-demo-y-developer-experience)
19. [Testing y calidad](#19-testing-y-calidad)
20. [Features post-V1 (V2 y roadmap)](#20-features-post-v1-v2-y-roadmap)
21. [Matriz de rutas y archivos clave](#21-matriz-de-rutas-y-archivos-clave)

---

## 1. Visión del producto

KoiCRM es un CRM **SaaS multitenant** donde cada organización (tenant) opera con:

- Su propia **marca** (logo, colores, nombre de producto)
- Su propio **pipeline de ventas** configurable
- Sus propios **catálogos** (equipos, canales, estados, motivos de seguimiento)
- Sus propios **campos personalizados** sobre Deal y Client
- Sus propios **usuarios y roles**
- Datos **100% aislados** por tenant (Postgres + RLS)

El core es **agnóstico de industria**. Lo específico de aquasistemas (catálogo Bomba/Jacuzzi, prefijo AQX, locale es-GT) vive en **plantillas de industria** y seeds, no en el código del producto.

---

## 2. Plataforma y foundation

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Next.js 14 App Router | Frontend + backend unificado con RSC y Server Actions | ✅ |
| TypeScript strict | Tipado estricto en todo el repo | ✅ |
| pnpm | Gestor de paquetes | ✅ |
| Tailwind CSS 3 | Estilos utility-first | ✅ |
| shadcn/ui (Radix) | Componentes accesibles (button, dialog, select, tabs, toast, etc.) | ✅ |
| React Hook Form + Zod | Formularios con validación compartida cliente/servidor | ✅ |
| Recharts | Gráficos en Estadísticas | ✅ |
| @dnd-kit/core | Drag-and-drop accesible (kanban, reorder de stages) | ✅ |
| sonner | Toasts de feedback | ✅ |
| date-fns + Intl | Fechas y moneda por tenant | ✅ |
| Prisma 6 + PostgreSQL 15 | ORM + base de datos relacional | ✅ |
| Docker Compose | Postgres local con `app_user` (sin BYPASSRLS) y `admin_user` | ✅ |
| ESLint + Prettier + Husky | Lint, format, pre-commit | ✅ |
| GitHub Actions CI | Lint, type-check, tests en PR | ✅ |
| Estructura `features/*` | Dominios verticales autónomos (actions, queries, schemas, policies, components) | ✅ |
| Server Actions | Mutaciones intra-app con Zod + RBAC + `withTenant()` | ✅ |
| Route Handlers | Auth, upload sign, health, invite accept, verify email | ✅ |
| pino | Logger JSON con correlación por requestId | ✅ |

---

## 3. Autenticación e identidad

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Sign up (email + password) | Registro con hash bcrypt | ✅ |
| Sign in (email + password) | Login con sesión httpOnly | ✅ |
| Sign out | Cierre de sesión | ✅ |
| Verificación de email | Token de verificación con página `/signup/verify` | ✅ |
| Forgot password | Solicitud de reset por email | ✅ |
| Reset password | Cambio de contraseña con token expirable | ✅ |
| OAuth Google | Botones en signin/signup; provider + onboarding para usuarios nuevos | ✅ |
| Auth.js v5 (NextAuth) | Adapter Prisma, sesiones sameSite=lax | ✅ |
| Rate limiting en auth | Protección en login/signup/forgot/reset | ✅ |
| Email transaccional | Resend en prod, log en dev | ✅ |
| MFA | Hooks preparados; UI diferida a V2 | ❌ Post-V1 |
| SSO empresarial (SAML/SCIM) | — | ❌ Post-V1 |

### Onboarding

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Primer tenant | Usuario sin memberships → redirect a `/app/onboarding` | ✅ |
| Crear tenant | Nombre + slug único + selección de industria | ✅ |
| Rol OWNER automático | Creador del tenant recibe rol OWNER | ✅ |
| Aplicar plantilla de industria | Pipeline, catálogos, branding y settings inicializados | ✅ |
| Redirect post-onboarding | A `/app/{slug}/pipeline` | ✅ |

### Gestión de usuarios del tenant

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Enlace de unión | Token reutilizable, rol editable, 90 días / revocable | ✅ |
| Invitar por email (legado) | `Invitation` + redirect a join accept | ⚠️ legado |
| Aceptar invitación | Crea Membership o redirige a signup | ✅ |
| Listar miembros | Settings → Usuarios | ✅ |
| Cambiar rol | OWNER, ADMIN, MEMBER, VIEWER | ✅ |
| Remover miembro | Con validación de permisos | ✅ |
| Editar miembro | Nombre, color de avatar, foto | ✅ (avatares con bug visual → V2-C01) |
| Cancelar invitación pendiente | — | ❌ V2-U03 |
| Edición de perfil propio | Fuera de Settings → Usuarios | ❌ V2-U01 |

---

## 4. Multitenancy y aislamiento

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Modelo Tenant | Org con slug, name, industrySlug | ✅ |
| Membership | User ↔ Tenant con rol | ✅ |
| Routing por slug | `/app/[tenantSlug]/*` | ✅ |
| Tenant resolver | Layout valida sesión + membership | ✅ |
| Tenant context | Provider para client components | ✅ |
| Switcher de tenant | Header si el usuario tiene >1 tenant | ✅ |
| `tenantId` en tablas de negocio | FK + índices compuestos | ✅ |
| Row Level Security (RLS) | Policy `tenant_isolation` por tabla | ✅ |
| `withTenant()` helper | Setea `app.tenant_id` en transacción | ✅ |
| Tests de aislamiento RLS | Dos tenants no ven datos del otro | ✅ |
| Subdominios por tenant | `acme.koicrm.com` | ❌ Post-V1 |
| Custom domain por tenant | — | ❌ Post-V1 |
| Operaciones cross-tenant (superuser) | Solo código admin, no UI | ✅ (diseño) |

---

## 5. Shell de aplicación y navegación

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Header fijo con branding | Logo/nombre del producto, colores del tenant | ✅ |
| Tabs principales | Embudo, Calendario, Estadísticas (header actual) | ✅ |
| Tab Clientes | Ruta `/clients` implementada; no en header principal | ⚠️ Ruta sin link en nav |
| Tab Archivo | Ruta `/archive` implementada; no en header principal | ⚠️ Ruta sin link en nav |
| Botón Settings | Link a `/settings/appearance` | ✅ |
| Botón Buscar (⌘K / Ctrl+K) | Abre CommandMenu global | ✅ |
| Botón Salir | Sign out | ✅ |
| Botón Imprimir | En vista Pipeline → reporte print-only | ✅ |
| Botón Nueva oportunidad (+) | En Pipeline → ClientFormModal | ✅ |
| Toggle dark/light | Via branding / tema del sistema | ✅ |
| Toggle "Mostrar archivados" | Persistido en demo; no verificado en V1 real | ⚠️ Gap vs demo |
| Footer de créditos | "Diseñado por Vértice…" del demo | ❌ No portado |
| Deep links | `?deal=`, `?client=` desde búsqueda | ✅ |

---

## 6. Módulos principales (vistas)

### 6.1 Embudo (Pipeline)

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Vista kanban | Una columna por `PipelineStage` | ✅ |
| Deal cards | Avatar asesor, nombre, empresa, valor, equipos, días, alertas | ✅ |
| Drag-and-drop entre stages | Optimistic UI + rollback en error | ✅ |
| DnD accesible por teclado | @dnd-kit keyboard sensor | ✅ |
| Stages locked | `ganado` y `perdido` rechazan drop; botones explícitos sí mueven | ✅ |
| Movimiento backward | Permitido (revertir stage) | ✅ |
| Filtros globales | Asesor, canal, equipo, alerta, rango de fecha | ✅ |
| Presets de fecha | today, week, month, quarter, year, custom | ✅ |
| Filtros en URL | Query params persisten al refrescar | ✅ |
| Limpiar filtros | Reset a defaults | ✅ |
| KPIs en header del pipeline | Total Embudo + Ganado (reactivos a filtros) | ✅ |
| Alertas visuales en card | Falta Cotización, Falta Pago, Seguim. Vencido, ping animado | ✅ |
| Status badge en card | activo, seguimiento, esperando, frío, urgente | ✅ |
| Excluir archivados del kanban | Deals con `isArchived=true` no aparecen | ✅ |

### 6.2 Clientes

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Layout split-view | Sidebar + ficha derecha | ✅ |
| Sidebar: búsqueda | Por nombre, empresa, teléfono | ✅ |
| Sidebar: orden | A–Z vs última actividad | ✅ |
| Sidebar: navegador alfabético | Jump A–Z (modo A–Z sin búsqueda) | ✅ |
| Sidebar: count filtrado | Badge de cantidad | ✅ |
| Sidebar: items | Avatar, nombre, empresa, # oportunidades, activas, ganado, próximo follow-up | ✅ |
| Ficha: header | Avatar, nombre, empresa, tel, WhatsApp (wa.me), email | ✅ |
| Ficha: editar inline | Campos de contacto con Save/Cancel | ✅ |
| Ficha: Nueva oportunidad | Pre-llena ClientFormModal | ✅ |
| Ficha: KPIs | Oportunidades, Activas, Ganadas, Total comprado | ✅ |
| Ficha: selector de rango KPIs | Toda la vida / 30d / 90d / Este año | ✅ |
| Ficha: Próximo seguimiento | Card clickeable → DealDetail | ✅ |
| Ficha: Notas del cliente | CRUD de notas globales | ✅ |
| Ficha: Historial de oportunidades | Timeline de deals del cliente | ✅ |
| Empty state | "Selecciona un cliente…" | ✅ |
| Detect-or-create al crear deal | Por `(name, company)` canónico | ✅ |
| Tab badge count en header | Count de clientes en nav (demo) | ❌ No en header V1 |

### 6.3 Calendario

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Grid mensual 7×N | Lun–Dom | ✅ |
| Navegación mes | ◀ / Hoy / ▶ | ✅ |
| Label de mes en español | — | ✅ |
| Filtro por asesor | — | ✅ |
| Mini-cards en celda | Hasta 3 + "+N más" | ✅ |
| Highlight día actual | — | ✅ |
| Color-coding de eventos | Verde completado, ámbar vencido, azul futuro, rojo urgente | ✅ |
| Panel del día seleccionado | Lista de follow-ups con detalles | ✅ |
| Pill "Vencido" | En follow-ups overdue | ✅ |
| Click → DealDetail | — | ✅ |
| Empty state del día | "No hay seguimientos programados…" | ✅ |

### 6.4 Archivo

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Tabla de deals archivados | Fecha, Oportunidad, Empresa, Etapa, Asesor, Valor | ✅ |
| Paginación cursor-based | 10 por página | ✅ |
| Click en fila → DealDetail | — | ✅ |
| Indicador de página | "Página X de Y" | ✅ |

### 6.5 Estadísticas

Panel multi-tab con filtro de rango de fecha global.

| Sub-tab | Features | Estado V1 |
| ------- | -------- | --------- |
| **Resumen** | KPI cards (Total Embudo, Ganados, Tasa cierre, Ticket promedio), Top performers | ✅ |
| **Listado** | Tabla de todos los deals con filtros | ✅ |
| **Embudo** | Bar chart por stage, count/value, tasa conversión | ✅ |
| **Equipo** | Pie chart count, bar chart value, tabla por asesor | ✅ |
| **Canal** | Pie chart count, bar chart value, tabla por canal | ✅ |
| **Productos** | Demand/sold count y value por equipment type | ✅ |
| **Alertas** | Follow-ups overdue con link al deal | ✅ |
| RangePicker global | Presets all/today/week/month/quarter/year/custom en URL | ✅ |
| Agregaciones server-side | SQL, no client-side | ✅ |
| Tooltips con currency formateado | Via `IntlSettings` del tenant | ✅ |

### 6.6 Búsqueda global

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Trigger ⌘K / Ctrl+K | Atajo global | ✅ |
| Trigger botón header | — | ✅ |
| Evento `koi:open-command-menu` | API programática | ✅ |
| Búsqueda server-side | ILIKE sobre name, company, phone, quote#, payment# | ✅ |
| Resultados agrupados | Deals y clientes con preview | ✅ |
| Badge de match via | Cotización, Pago, Teléfono, Empresa, ID | ✅ |
| Deep link a deal/client | — | ✅ |
| Empty state "Sin resultados" | — | ✅ |

### 6.7 Reporte imprimible (Print Report)

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Trigger `window.print()` | Botón Printer en Pipeline | ✅ |
| CSS `@media print` | Componente oculto en pantalla | ✅ |
| Tabla principal | Cliente, Etapa, Días en etapa, Días totales, Equipo, Alertas, Valor | ✅ |
| Sub-fila por deal | Asesor, Origen, Tel, Email, Cotizaciones, Pagos, Última nota | ✅ |
| Respeta filtros activos | Asesor, Canal, Equipo | ✅ |
| Excluye archivados | — | ✅ |
| Header con logo y fecha | Desde TenantBranding | ✅ |
| Footer con total y productName | — | ✅ |

---

## 7. Modales y formularios

### 7.1 ClientFormModal (Nueva oportunidad)

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Layout dos columnas | Según demo §4.1 | ✅ |
| Campos: asesor, canal, nombre, empresa, tel, WhatsApp | Validados | ✅ |
| Multiselect equipos + texto custom | Al menos uno requerido | ✅ |
| Cotizaciones en alta | Upload + número + fecha | ✅ |
| Comprobantes de pago en alta | Idem | ✅ |
| Valor, status, notas, follow-up legacy | — | ✅ |
| Validación Zod client + server | — | ✅ |
| Generación de Deal ID | Counter atómico por tenant | ✅ |
| Detect-or-create Client | — | ✅ |
| Activity `created` | — | ✅ |
| Pre-fill desde ficha cliente | name, company, phone | ✅ |
| Detección de duplicado | Advertencia por clientKey | ✅ |

### 7.2 DealDetailModal

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Tres paneles | Datos / Operación / Auditoría | ✅ |
| Panel izquierdo | Equipos, asesor, valor editable, contacto, cotizaciones, pagos, métricas tiempo | ✅ |
| Panel central | Follow-ups (pendientes/completados), notas | ✅ |
| Panel derecho | Timeline de Activity | ✅ |
| Inline edit | name, company, value, phone, whatsapp, email, equipment, status | ✅ |
| Mover a siguiente stage | Botón dinámico | ✅ |
| Marcar como ganado / perdido | — | ✅ |
| Archivar deal | Soft-archive | ✅ |
| Secciones Quote y Payment | CRUD integrado | ✅ |
| ConfirmDialog en acciones destructivas | AlertDialog shadcn | ✅ |

### 7.3 CommandMenu (GlobalSearch)

Ver §6.6.

### 7.4 FilePreviewModal

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Vista ampliada de cotización/comprobante | Click en imagen adjunta | ⚠️ Depende de URL pública S3 |
| Descargar archivo | — | ⚠️ Parcial |

### 7.5 ConfirmDialog genérico

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Diálogo de confirmación reutilizable | Archivar, eliminar, etc. | ✅ (AlertDialog) |

---

## 8. Entidades de datos

Todas con `tenantId` excepto identidad global (`User`, `Account`, etc.).

| Entidad | Propósito | Relaciones clave |
| ------- | --------- | ---------------- |
| **Tenant** | Organización | branding, settings, memberships |
| **User** | Persona con cuenta | memberships, deals owned |
| **Membership** | User ↔ Tenant + Role | — |
| **Invitation** | Invitación pendiente | tenant, email, role, token |
| **TenantBranding** | White label visual | logo, colores, productName |
| **TenantSettings** | Locale, currency, dealIdPrefix, timezone, phoneFormat | — |
| **IndustryTemplate** | Payload de plantilla por industria | slug, version, payload JSON |
| **Pipeline** | Flujo de ventas | stages, deals |
| **PipelineStage** | Etapa del embudo | order, key, label, color, iconKey, locked |
| **CatalogItem** | Catálogo genérico | equipment, salesChannel, dealStatus, followupReason |
| **Client** | Persona+empresa única | deals, notes |
| **Deal** | Oportunidad de venta | client, stage, owner, equipment, quotes, payments, followUps, notes, activities |
| **DealEquipment** | M-N deal ↔ equipment | equipmentKey, customLabel |
| **Quote** | Cotización | number, date, fileUrl, isVoid |
| **Payment** | Comprobante de pago | number, date, fileUrl, isVoid |
| **Attachment** | Metadata de archivo subido | url, mimeType, size |
| **FollowUp** | Seguimiento programado | date, reasonKey, result, completed, completedAt |
| **Note** | Nota timestamped | dealId y/o clientId |
| **Activity** | Audit log | type, payload JSON, userId |
| **SavedView** | Vista guardada (filtros/columnas) | entity, config JSON — schema listo |
| **Counter** | Secuencia atómica | deal id por tenant |
| **CustomFieldDefinition** | Schema dinámico | entity, key, type, options |
| **RateLimitEntry** | Rate limiting auth | — |

### Enums / catálogos configurables

| Concepto | Valores default (plantilla aquasistemas) |
| -------- | ---------------------------------------- |
| **Stages** | prospecto → contactado → cotizacion → negociacion → ganado (locked) / perdido (locked) |
| **Deal status** | activo, seguimiento, esperando, frio, urgente |
| **Follow-up reasons** | No responde, Pide más información, Necesita tiempo, Revisar cotización, Agendar visita, Otro |
| **Equipment** | Bomba, Jacuzzi, Sauna, Calentador, Filtro, Hidrojet, Servicio Técnico, Iluminación |
| **Sales channels** | Sala, Teléfono, WhatsApp, Facebook, Instagram |

---

## 9. Configuración (Settings)

Rutas bajo `/app/[tenantSlug]/settings/`.

| Sección | Features | Estado V1 |
| ------- | -------- | --------- |
| **Apariencia** | Dark/light, colores (fondo, header, KPIs), logo upload, bg image, productName | ✅ |
| **General** | locale, currency, timezone, phoneFormat, whatsappCountryCode, dealIdPrefix, dealIdYearDigits | ✅ |
| **Embudo** | CRUD stages, reorder DnD, edit label/sublabel/color/icon/locked, delete con reasignación | ✅ |
| **Catálogos** | Tabs por catalogKey: equipment, salesChannel, dealStatus, followupReason; CRUD, reorder, soft-disable | ✅ |
| **Usuarios** | Lista miembros, invitar, cambiar rol, remover, editar (nombre, color, foto) | ✅ |
| **Campos personalizados** | CRUD definitions para Deal/Client; tipos text/number/date/select/multiselect/boolean/url | ✅ (ruta existe; no en nav lateral Settings) |

---

## 10. Reglas de negocio

| Regla | Descripción | Estado V1 |
| ----- | ----------- | --------- |
| Generación Deal ID | `{prefix}-{counter:0000}-{initials}-{YY\|YYYY}` atómico por tenant | ✅ |
| Client key canónico | `lowercase(trim(name\|company))` | ✅ |
| Soft-archive | `isArchived=true` excluye pipeline/KPIs; visible en Archivo | ✅ |
| Stage transition | Actualiza `stageEnteredAt` + Activity `stageChanged` | ✅ |
| Stages locked | Solo vía botones explícitos | ✅ |
| Alerta "Falta Cotización" | Stage ≥ contactado (≠ prospecto/perdido) sin quote activo | ✅ |
| Alerta "Falta Pago" | Stage = ganado sin payment activo | ✅ |
| Follow-up overdue | Comparación date vs today al mediodía (TZ-safe) | ✅ |
| daysTotal / daysStage | Calculados desde created y stageEnteredAt | ✅ |
| History / Activity | created, stageChanged, ownerChanged, valueChanged, quoteAdded, paymentAdded, archived, followUpAdded, followUpCompleted, noteAdded | ✅ |
| Validaciones ClientForm | collab, channel, name, phone, equipment requeridos; formatos tel/WhatsApp | ✅ |
| Inmutabilidad | id, createdAt del deal no cambian | ✅ |
| Borrado Client | Bloqueado si tiene deals | ✅ |
| Borrado CatalogItem | Bloqueado o warning si en uso | ✅ |
| Borrado PipelineStage | Bloqueado si tiene deals; ofrecer reasignar | ✅ |
| Filtros compuestos AND | Pipeline y stats | ✅ |

---

## 11. KPIs, métricas y alertas

| KPI / Métrica | Fórmula (resumen) | Dónde aparece |
| ------------- | ----------------- | ------------- |
| Total Embudo | sum(value) deals activos no en ganado/perdido | Pipeline, Stats Resumen |
| Ganado (revenue) | sum(value) stage=ganado | Pipeline, Stats |
| Tasa de cierre | won / active × 100 | Stats Resumen |
| Ticket promedio | pipeline / open_count | Stats Resumen |
| Por stage | count, value, conversión | Stats Embudo |
| Por asesor | deals, won, lost, rate, values | Stats Equipo |
| Por canal | deals, value, won | Stats Canal |
| Por producto | demand, sold, pending/sold value | Stats Productos |
| Cliente KPIs | opps, activas, ganadas, total comprado | Ficha Cliente |
| Follow-ups vencidos | completed=false, date < today | Calendario, Cards, Stats Alertas |
| Top performers | Ranking por wonValue | Stats Resumen |

---

## 12. Almacenamiento, adjuntos y documentos

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| S3-compatible (R2 default) | Object storage | ✅ |
| Presigned URL upload | `/api/upload/sign` para adjuntos de deals | ✅ |
| Upload server-side avatares | `/api/upload/avatar` | ✅ (visualización rota → V2-C01) |
| Tabla Attachment | Metadata de archivos | ✅ |
| Quote con fileUrl | Imagen/PDF de cotización | ✅ |
| Payment con fileUrl | Comprobante de pago | ✅ |
| isVoid en Quote/Payment | Anular sin borrar | ✅ |
| Sin base64 en DB | Solo URLs | ✅ |
| Límite de tamaño configurable | En sign endpoint | ✅ |
| CORS R2 producción | Validación pendiente | ⚠️ V2-C06 |
| Proxy de media autenticado | Alternativa a bucket público | ❌ V2-I02 |
| Reconciliación storage | Cron + botón recalcular | ❌ V2-I03 |

---

## 13. Motor de campos personalizados

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| CustomFieldDefinition CRUD | Por entidad Deal/Client | ✅ |
| Tipos V1 | text, number, date, select, multiselect, boolean, url | ✅ |
| Persistencia en `customData JSONB` | Validado con Zod dinámico | ✅ |
| Schema builder | `lib/config/custom-fields.ts` | ✅ |
| Renderer en forms | Deal y Client forms | ✅ |
| Renderer en vistas detalle | — | ✅ |
| Custom fields en Quote/Payment | Schema preparado; UI limitada | ⚠️ Parcial |

---

## 14. Plantillas de industria

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| IndustryTemplate en DB | Payload versionado | ✅ |
| Registry `lib/industry/registry.ts` | Indexado por slug | ✅ |
| Plantilla aquasistemas | 6 stages, catálogos, AQX, es-GT, GTQ | ✅ |
| Aplicación en onboarding | Transacción atómica | ✅ |
| Anti-leakage | Términos de industria solo en seeds/tests | ✅ (regla) |
| Segunda industria | — | ❌ Post-V1 |
| Custom fields de industria (pH, dureza…) | — | ❌ Post-V1 |

---

## 15. Internacionalización y formato

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| Locale por tenant | `TenantSettings.locale` (default es-GT) | ✅ |
| Currency por tenant | `TenantSettings.currency` (default GTQ) | ✅ |
| Timezone por tenant | America/Guatemala default | ✅ |
| Formato teléfono | phoneFormat configurable | ✅ |
| WhatsApp country code | +502 default | ✅ |
| `formatCurrency()` / `formatDate()` | Helpers en `lib/intl/format.ts` | ✅ |
| UI strings en español | Hardcoded es-GT V1 | ✅ |
| Multi-idioma (i18n) | next-intl preparado conceptualmente | ❌ V2-F02 |

---

## 16. Seguridad y autorización

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| RBAC | OWNER, ADMIN, MEMBER, VIEWER | ✅ |
| `requireRole()` helper | Server-side | ✅ |
| Policies por feature | canCreate, canEdit, canDelete, canView | ✅ |
| RLS Postgres | Segunda línea de defensa | ✅ |
| Validación Zod server-side | Todas las actions | ✅ |
| CSRF | Origin check nativo Server Actions | ✅ |
| Rate limit auth | RateLimitEntry | ✅ |
| Password hashing | bcrypt | ✅ |
| Tokens expirables | Reset, verify, invite | ✅ |
| Headers de seguridad | CSP, X-Frame-Options en next.config | ✅ |
| Sanitización notas | Plain text V1 | ✅ |
| Health endpoint | `/api/health` | ✅ |

### Matriz RBAC (resumen)

| Acción | OWNER | ADMIN | MEMBER | VIEWER |
| ------ | ----- | ----- | ------ | ------ |
| Settings / branding | ✅ | ✅ | ❌ | ❌ |
| Generar enlace de unión | ✅ | ✅ | ❌ | ❌ |
| CRUD deals/clients | ✅ | ✅ | ✅ | ❌ |
| Ver todo el tenant | ✅ | ✅ | ✅ | ✅ |
| Eliminar tenant | ✅ | ❌ | ❌ | ❌ |

---

## 17. Observabilidad, errores y UX transversal

| Feature | Descripción | Estado V1 |
| ------- | ----------- | --------- |
| ActionResult discriminated union | `{ ok, data \| error, code }` | ✅ |
| Toasts sonner | Éxito y error user-friendly | ✅ |
| loading.tsx / error.tsx | Por route segment | ✅ |
| global-error.tsx | Error boundary raíz | ✅ |
| Revalidación RSC | `revalidatePath` post-mutación | ✅ |
| URL como estado | Filtros, paginación, stats range | ✅ |
| Focus trap en modales | Radix Dialog | ✅ |
| aria-labels en inputs | Accesibilidad mínima | ✅ |
| Contraste WCAG en badges | Revisado en M10 | ✅ |
| Sentry | Opcional V1 | ❌ Opcional |
| Notificaciones in-app | — | ❌ V2-F08 |
| Email alerts (follow-up overdue) | — | ❌ Post-V1 |

---

## 18. Seeds, demo y developer experience

| Feature | Descripción | Comando |
| ------- | ----------- | ------- |
| Migraciones Prisma | Versionadas + RLS SQL | `pnpm db:migrate` |
| Seed core | IndustryTemplate aquasistemas | En migrate/seed |
| Seed test tenant | Tenant `test` + admin | `pnpm seed:test` |
| Seed demo aquasistemas | 30 deals, 4 colaboradores, follow-ups variados | `pnpm seed:demo` |
| Docker Postgres | app_user + admin_user | `pnpm db:up` |
| DB reset | Volumen limpio | `pnpm db:reset` |
| README + CONTRIBUTING | Quickstart y reglas de agentes | — |
| `.env.example` | Variables documentadas | — |
| Dev token endpoint | Solo dev | `/api/auth/dev-token` |

---

## 19. Testing y calidad

| Nivel | Herramienta | Cobertura V1 |
| ----- | ----------- | ------------ |
| Unit | Vitest | Schemas, helpers, custom-fields engine |
| Integration | Vitest + Postgres Docker | RLS, deal-id, counter, search, clients, activity, perf |
| E2E | Playwright | auth, deals, kanban, quotes/payments, follow-ups, calendar, archive, stats, search, branding, settings, print, security, form validation, state machine, filters/KPI |
| CI | GitHub Actions | Lint + type-check + tests |
| axe-core | E2E a11y | Kanban, modales |
| Performance bench | integration perf.test.ts | Pipeline 1k deals, stats, search 10k |

---

## 20. Features post-V1 (V2 y roadmap)

Documentadas en `V2_BACKLOG.md` y `DECISIONS_AND_OPEN_QUESTIONS.md`.

### Correcciones V1 → V2

- Avatares: imagen sube pero no se visualiza (V2-C01)
- Fallback avatar con iniciales (V2-C02)
- Limpiar objeto R2 anterior al reemplazar foto (V2-C03)
- Contraste botones ghost (V2-C04)
- Endpoint huérfano `/api/upload/avatar/sign` (V2-C05)
- CORS R2 producción (V2-C06)

### Funcionalidades diferidas

| Feature | Referencia |
| ------- | ---------- |
| Import/export CSV y Excel | V2-F01, DP-02 |
| i18n multi-idioma | V2-F02, DP-03 |
| MFA | V2-F03, DP-04 |
| Multi-pipeline por tenant | V2-F04, DP-08 |
| Audit log global por tabla | V2-F05, DP-09 |
| Subdominios por tenant | V2-F06, DP-12 |
| Custom domain por tenant | V2-F07 |
| Notificaciones in-app + email prefs | V2-F08 |
| SSO empresarial (SAML/SCIM) | V2-F09 |
| OAuth Google completo | T3.1 subtask |
| SavedView UI | Schema existe, UI no |
| Análisis técnico agua (pH, dureza…) | Industria post-V1 |
| Contratos de mantenimiento recurrente | Post-V1 |
| Google Calendar sync | Post-V1 |
| Formularios públicos captura leads | Post-V1 |
| Automatizaciones/reglas configurables | Post-V1 |
| API REST pública v1 | Post-V1 |
| Billing / planes | Post-V1 |

---

## 21. Matriz de rutas y archivos clave

### Rutas de aplicación autenticada

| Ruta | Módulo | Feature principal |
| ---- | ------ | ----------------- |
| `/app/onboarding` | Tenants | Crear primer tenant |
| `/app/[slug]/pipeline` | Pipeline | Kanban + filtros + KPIs + print |
| `/app/[slug]/clients` | Clients | Lista + sidebar |
| `/app/[slug]/clients/[id]` | Clients | Ficha detalle |
| `/app/[slug]/calendar` | Calendar | Vista mensual |
| `/app/[slug]/archive` | Deals | Deals archivados |
| `/app/[slug]/stats/resumen` | Stats | KPIs + top performers |
| `/app/[slug]/stats/listado` | Stats | Tabla deals |
| `/app/[slug]/stats/embudo` | Stats | Chart embudo |
| `/app/[slug]/stats/equipo` | Stats | Chart equipo |
| `/app/[slug]/stats/canal` | Stats | Chart canal |
| `/app/[slug]/stats/productos` | Stats | Chart productos |
| `/app/[slug]/stats/alerts` | Stats | Follow-ups overdue |
| `/app/[slug]/settings/appearance` | Branding | White label |
| `/app/[slug]/settings/general` | Tenants | Locale, currency, IDs |
| `/app/[slug]/settings/pipeline` | Pipeline | Editor stages |
| `/app/[slug]/settings/catalogs` | Catalogs | CRUD catálogos |
| `/app/[slug]/settings/users` | Users | Miembros e invitaciones |
| `/app/[slug]/settings/custom-fields` | Custom fields | Definiciones |

### Rutas auth

| Ruta | Feature |
| ---- | ------- |
| `/signin` | Login |
| `/signup` | Registro |
| `/signup/verify` | Verificar email |
| `/forgot` | Olvidé contraseña |
| `/reset` | Reset contraseña |

### Features por carpeta (`features/`)

| Carpeta | Responsabilidad |
| ------- | --------------- |
| `deals/` | CRUD deals, ClientFormModal, DealDetailModal, ArchiveTable |
| `clients/` | CRUD clients, sidebar, profile, KPIs |
| `pipeline/` | Kanban, filtros, KPIs, moveDeal, PrintReport, settings |
| `follow-ups/` | CRUD seguimientos |
| `calendar/` | MonthGrid, DayPanel, queries |
| `quotes/` | CRUD cotizaciones |
| `payments/` | CRUD pagos |
| `attachments/` | Upload helper |
| `notes/` | Notas deal/client |
| `activity/` | Audit log |
| `search/` | Búsqueda global |
| `stats/` | Agregaciones y charts |
| `branding/` | TenantBranding actions/UI |
| `catalogs/` | CatalogItem CRUD |
| `custom-fields/` | Engine + settings UI |
| `users/` | Invitaciones, miembros |
| `tenants/` | Onboarding, settings general |

---

## Leyenda de estados

| Símbolo | Significado |
| ------- | ----------- |
| ✅ | Implementado y en backlog V1 como done |
| ⚠️ | Implementado parcialmente o con gap conocido |
| ❌ | No implementado; planificado post-V1 o pendiente |

---

## Documentos relacionados

- [DEMO_INVENTORY.md](./DEMO_INVENTORY.md) — Inventario funcional del demo de referencia
- [ARCHITECTURE_PLAN.md](./ARCHITECTURE_PLAN.md) — Stack, modelo de datos, multitenancy
- [IMPLEMENTATION_BACKLOG.md](./IMPLEMENTATION_BACKLOG.md) — Tasks M1–M10 con criterios de aceptación
- [V2_BACKLOG.md](./V2_BACKLOG.md) — Correcciones y features post-V1
- [DECISIONS_AND_OPEN_QUESTIONS.md](./DECISIONS_AND_OPEN_QUESTIONS.md) — Decisiones y DP-* pendientes
- [AGENT_RULES.md](./AGENT_RULES.md) — Reglas operativas para agentes
