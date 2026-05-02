# DEMO_INVENTORY.md

Inventario exhaustivo del demo `hardcoded-demo/` (AquaCRM) — fuente de verdad funcional para implementar el CRM real en `crm-core/` sin volver a abrir el demo. Cualquier hallazgo nuevo posterior debe agregarse aquí, no recordarse en otros lados.

**Categorías** (al final de cada sección y de cada item donde aplique):

- `V1-obligatorio`: aparece en el demo → se implementa real en V1.
- `V1-inferido`: el demo lo sugiere o lo hace incompleto pero es necesario para cerrar el flujo real.
- `Post-V1`: mejora futura, fuera del alcance V1.
- `Decisión-pendiente`: requiere owner.

---

## 1. Resumen del demo

- **Producto**: AquaCRM, demo CRM para una empresa de "aquasistemas" (bombas, jacuzzis, saunas, calentadores, filtros, hidrojets) en Guatemala.
- **Stack del demo (referencial; NO portar)**: React 18 + Vite + Tailwind 3, `recharts`, `lucide-react`, `localforage` (no usado en runtime, sólo declarado), Express 5 con un único endpoint `/api/data` que serializa todo el estado a `data/app-data.json` (~5MB con base64 embebido). Persistencia secundaria a `localStorage`.
- **Topología**: SPA monolítica de un único archivo (`src/SalesFunnel.jsx`, 4813 líneas) que renderiza todas las vistas, modales y settings; estado global en hooks. No hay routing real, no hay backend de negocio, no hay auth.
- **Locale**: `es-GT`, currency `GTQ` (símbolo `Q`), formato teléfono `XXXX-XXXX`, WhatsApp `+502 XXXX-XXXX`, fechas `YYYY-MM-DD` en almacenamiento, `DD mes YYYY HH:MM` en display.

---

## 2. Mapa de pantallas (tabs raíz)

| Tab            | Label UI        | Layout                                                                     | Sub-tabs internas                                           | Categoría      |
| -------------- | --------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------- |
| `pipeline`     | Embudo          | Kanban horizontal con N columnas (una por stage) + filtros globales arriba | —                                                           | V1-obligatorio |
| `clientes`     | Clientes        | Split-view: sidebar A-Z izquierda + ficha de cliente derecha               | —                                                           | V1-obligatorio |
| `calendario`   | Calendario      | Grid mensual 7×N + panel lateral del día seleccionado                      | —                                                           | V1-obligatorio |
| `archivo`      | Archivo         | Tabla paginada (10 por página)                                             | —                                                           | V1-obligatorio |
| `estadisticas` | Estadísticas    | Panel multi-tab con KPIs y charts                                          | Resumen, Listado, Embudo, Equipo, Canal, Productos, Alertas | V1-obligatorio |
| (modal)        | Búsqueda Global | Dialog full-screen, Cmd-K                                                  | Resultados agrupados por entidad                            | V1-obligatorio |
| (panel)        | Settings        | Panel modal multi-tab                                                      | Apariencia, Usuarios, Equipos, Canales, Embudo              | V1-obligatorio |

**Top-level shell**:

- Header fijo: logo (custom o "AquaCRM" + icono Droplets) + tabs + búsqueda + botón "Add" (nueva oportunidad) + Imprimir + toggle dark/light + Settings.
- Footer: "Diseñado por Vértice y Desarrollado por Koi Software {year}".
- Toggle global "Mostrar archivados" (persistido en `sf-showArchived`).

---

## 3. Catálogo de módulos / vistas

### 3.1 Embudo (Pipeline) — `V1-obligatorio`

- Vista kanban con una columna por `stage` configurado (orden + bloqueo configurables en Settings → Embudo).
- Cada `Deal` aparece como card. Drag-and-drop entre columnas; el drop registra `stageEntryTime` y crea entrada en `history`.
- Stages `locked: true` (por default `ganado` y `perdido`) impiden mover OUT con drag, pero los marcadores manuales "Marcar como ganado / perdido" del DealDetail sí los mueven hacia ellos.
- **Filtros globales** (barra superior, sólo visibles en este tab): Asesor, Canal, Equipo, Alerta (`Falta Cotización` / `Falta Pago`), Rango de fecha (presets `today`/`week`/`month`/`quarter`/`year`/`custom` + custom from-to), botón "Limpiar Filtros".
- **KPIs alineados a la derecha de los filtros**: Total Embudo (suma de `value` de deals activos no en stages cerrados) y Ganado (suma de `value` con `stage=ganado`). Reaccionan a los filtros activos.
- **Card** muestra: avatar de asesor (color), nombre, empresa, valor formateado en GTQ, equipos (chips), días totales y días en stage, badge de status si no es `activo`, indicadores rojo/amarillo de alertas.
- **Visualización de alertas en card**: punto pulsante con animación `sfPing` cuando aplica.

### 3.2 Clientes — `V1-obligatorio`

- **Tab badge**: el tab "Clientes" en el header muestra un badge con el count de clientes únicos derivados de deals (usa `buildClients(deals).length`).
- Layout: sidebar 400px + panel derecho flex.
- **Sidebar**:
  - Búsqueda por nombre, empresa o teléfono.
  - Toggle de orden A–Z vs por fecha de última actividad.
  - Badge de cantidad filtrada.
  - Navegador alfabético A-Z (jump quick). Sólo visible en modo A-Z sin búsqueda activa.
  - Lista de clientes; cada item: avatar de iniciales (color determinístico por nombre), nombre, empresa, # de oportunidades, # activas, total ganado, próximo follow-up (fecha) si existe.
- **Panel derecho** (al seleccionar cliente):
  - Header con avatar (tamaño mayor), nombre, empresa, teléfono (texto), WhatsApp (link `wa.me`), email.
  - Botón "Editar" (form inline con fields: nombre, empresa, teléfono, WhatsApp, correo electrónico) con Save/Cancel.
  - Botón "Nueva oportunidad" (pre-llena ClientFormModal con nombre/empresa/teléfono del cliente).
  - KPIs (4 columnas): Oportunidades, Activas, Ganadas, Total comprado.
  - Filtro de rango de KPIs: "Toda la vida" / "Últimos 30 días" / "Últimos 90 días" / "Este año".
  - Selector de rango: Toda la vida / Últimos 30 días / Últimos 90 días / Este año.
  - Tarjeta "Próximo seguimiento" si existe (clic abre DealDetail).
  - Sección "Notas del cliente" — notas globales por cliente, alta/baja inline. Empty: "Sin notas globales aún." Implementadas vía `ClientOverride.notes`.
  - "Historial de oportunidades" — timeline de todos los Deals del cliente, ordenados por fecha, con stage, canal, asesor, equipos, valor.
- Empty general: "Selecciona un cliente para ver su ficha completa".

### 3.3 Calendario — `V1-obligatorio`

- Header: navegación mes (◀ / Hoy / ▶), filtro por asesor, label de mes en español.
- Grid: 7 columnas (Lun-Dom). Cada celda muestra día + count de eventos + hasta 3 mini-cards de follow-up (con truncamiento "+N más").
- Día actual highlight; selected ring-2; out-of-month dimmed.
- Color-coding de eventos por estado:
  - **Verde**: `completed: true`.
  - **Ámbar**: `date < today` y `completed: false` (vencido).
  - **Azul**: futuro normal.
  - **Rojo**: deal con `status: urgente` y follow-up pendiente.
- **Panel del día seleccionado**: lista de follow-ups con avatar de asesor, nombre del deal, badge de stage, motivo, botón "Detalles". Vencidos con pill "Vencido". Completados con opacidad reducida y greyscale.
- Empty del día: ícono `CalendarCheck` + "No hay seguimientos programados para este día."

### 3.4 Archivo — `V1-obligatorio`

- Tabla con columnas: Fecha (`created`), Oportunidad (`name`), Empresa (`company`), Etapa (badge stage), Asesor (avatar), Valor (currency GTQ).
- Paginación 10 por página, botones Anterior / Siguiente, indicador "Página X de Y".
- Click en row abre DealDetail.

### 3.5 Estadísticas — `V1-obligatorio`

Multi-tab. Filtro de rango de fechas a nivel del panel completo (mismos presets que filtros de pipeline).

#### 3.5.1 Resumen

- KPI cards: Total Embudo, Ganados, Tasa de cierre %, Ticket promedio.
- Top performers (ranking de asesores por wonValue).

#### 3.5.2 Listado

- Tabla de todos los deals con filtros aplicados.

#### 3.5.3 Embudo

- Bar chart de distribución por stage (count y/o value).
- Métricas: cantidad por stage, valor por stage, tasa de conversión por stage.

#### 3.5.4 Equipo

- Pie chart de count de deals por asesor + bar chart de valor.
- Tabla por asesor: deals, ganados, perdidos, tasa de cierre, valor total, valor ganado.

#### 3.5.5 Canal

- Pie chart por canal (count) + bar chart por canal (valor).
- Tabla por canal: deals, valor, ganados, valor ganado.

#### 3.5.6 Productos

- Por equipment type: demand count (deals no `ganado`), sold count (`ganado`), pending value, sold value.

#### 3.5.7 Alertas

- Lista de follow-ups overdue, color rojo, link al deal.

### 3.6 Búsqueda global — `V1-obligatorio`

- Trigger: input del header o (potencial) Cmd-K.
- Modal con results agrupados por: nombre, empresa, teléfono, número de cotización, número de pago.
- Cada resultado muestra deal name, empresa, teléfono, valor, asesor, stage. Click → DealDetail.
- Performance del demo: filtrado client-side sobre todo `deals[]`.

### 3.7 Settings — `V1-obligatorio`

Panel modal con 5 sub-tabs.

#### 3.7.1 Apariencia

- Toggle dark/light.
- Color picker para fondo dark, fondo light, header, KPIs.
- Upload logo (compresión a base64; en producto real → object storage).
- Upload background image (idem).

#### 3.7.2 Usuarios (Asesores / Colaboradores)

- Lista con avatar, nombre, color.
- Add: nombre, color (paleta + custom hex), foto (upload).
- Edit / Delete por item.

#### 3.7.3 Equipos (Equipment types)

- Array simple de strings.
- Add / delete. No icon assignment (los iconos están hardcodeados en `EQUIP_BASE_ICONS`).

#### 3.7.4 Canales

- Lista con id, label, color, icono (parcial — el demo declara `icon: {}` vacío en el JSON; la asignación de icono está incompleta).
- Add / edit / delete.

#### 3.7.5 Embudo (Stages)

- Lista reordenable (drag-and-drop) de stages.
- Edit: label, sublabel, color, icono (de un set fijo `STAGE_ICON_OPTIONS`), flag `locked`.
- Add / delete stage.

#### 3.7.6 Acciones globales (visibles en algún sub-tab del Settings)

- "Cargar datos de ejemplo" — siembra 30 deals demo.
- "Limpiar todos los datos" — destruye todo el state.

### 3.8 Print Report (Imprimir) — `V1-obligatorio`

**Trigger**: botón Printer en el header → `window.print()`. La página tiene un componente print-only oculto en pantalla que se muestra sólo al imprimir.

**Layout del reporte impreso**:

- Header: título "Reporte de Oportunidades" + fecha + logo (custom o "AquaCRM Manejo de agua").
- Tabla principal con columnas:
  - **Cliente** (nombre en bold + empresa + ID del deal si tiene formato AQX)
  - **Etapa Actual** (badge coloreado)
  - **Días en etapa** (tabular)
  - **Días totales** (tabular)
  - **Equipo** (chips)
  - **Alertas** ("Sin Cotiz." / "Sin Pago" / "Seguim. Vencido")
  - **Valor Estimado** (currency, right-aligned)
- Segunda fila por deal (sub-row): Asesor, Origen, Tel, Email, Cotizaciones (números), Pagos (números), Última nota (italic).
- Footer: "Total de registros mostrados: N" + "Reporte generado automáticamente desde AquaCRM."
- **Filtros aplicados**: el reporte respeta los filtros activos de Asesor, Canal y Equipo.
- **Exclusión**: deals archivados se excluyen del reporte.

---

## 4. Catálogo de modales / forms

### 4.1 ClientFormModal — `V1-obligatorio`

**Trigger**: botón "+" del header, "Nueva oportunidad" desde ficha de cliente, o crear desde algún flujo. **Layout**: dos columnas.

**Pre-carga desde ClientsPage**: cuando el usuario crea un deal desde la ficha de un cliente (`onNewDeal(client)`), el formulario se pre-llena con `name`, `company` y `phone` del cliente vía `prefillRef`. El stage inicial es `prospecto`.

**Columna izquierda**:

- `collab` — select, **requerido**, opciones: lista de Collaborators.
- `channel` — select con icono, **requerido**, opciones: lista de Channels.
- `name` — text, **requerido**.
- `company` — text, opcional.
- `phone` — text, **requerido**, formato `XXXX-XXXX`.
- `whatsapp` — text, opcional, formato `+502 XXXX-XXXX`.
- `equipment` — multiselect chips de Equipment types.
- `equipmentCustom` — text, alternativo a multiselect.
- Validación: al menos uno de `equipment[]` o `equipmentCustom` debe estar lleno.

**Columna derecha**:

- Cotizaciones — sección con upload (file → base64 comprimido) + display de cotizaciones agregadas. Cada cotización: número, fecha, foto, flag `isVoid`.
- Comprobantes de pago — idem.
- `value` — número (currency GTQ).
- `followUp` (legacy) — date picker; opcional.
- `status` — select: Activo / Seguimiento / Esperando resp. / Frío / Urgente.
- `notes` — textarea opcional.

**Botones**: Cancelar / Guardar. **Detección de duplicado**: si `${name}|${company}` lowercase ya existe, advierte y permite enlazar al cliente existente (decisión-pendiente cómo se confirma este UX en el real).

### 4.2 DealDetailModal — `V1-obligatorio`

**Trigger**: click en card de pipeline / row de archivo / item de calendario / resultado de búsqueda. **Layout**: 3 paneles.

**Panel izquierdo** (datos del deal):

- Equipment chips clickables.
- Avatar y datos del asesor.
- Valor (editable inline).
- Teléfono (`tel:`), WhatsApp (`wa.me`), email.
- Sección Cotizaciones: lista, upload, marcar `isVoid`, eliminar.
- Sección Comprobantes de pago: idem.
- Métrica `daysTotal` y fecha de creación, "Creado por" (collaborator name).

**Panel central** (operación):

- Sección Follow-ups: pendientes (con botón "Marcar completado" + campo opcional `result`) y completados (con `completedAt`). Form de alta: fecha + motivo (de `FU_REASONS`) + botón Add.
- Sección Notas/Observaciones: lista cronológica con `text + timestamp`. Add inline.

**Panel derecho** (auditoría):

- Timeline de `history`: `created`, `stageChanged`, `collabChanged`, `valueChanged`, `quoteAdded`, `paymentAdded`, `archived`, `followUpAdded`, `followUpCompleted`. Cada entrada con `timestamp` (formato `nowStamp()`), action y details.

**Acciones del modal**:

- Botón "Mover a [siguiente stage]".
- Botón "Marcar como ganado" (sólo si stage no es ya `ganado`).
- Botón "Marcar como perdido" (idem).
- Botón "Archivar".
- Cerrar.

**Inline editables**: name, company, value, phone, whatsapp, email, equipment, status.

### 4.3 GlobalSearchModal — `V1-obligatorio`

Ya descrito en 3.6. Campos: input único; resultados con preview por entidad.

### 4.4 SettingsPanel

Ya descrito en 3.7.

### 4.5 FilePreviewModal — `V1-inferido`

Modal auxiliar abierto al hacer click en una cotización/comprobante para ver la imagen ampliada. Botón cerrar; opcionalmente "Descargar".

### 4.6 ConfirmDialog — `V1-inferido`

Diálogo genérico de confirmación, usado en "Limpiar todos los datos", eliminar collaborator/canal/equipment, archivar, eliminar follow-up. Botones "Confirmar" / "Cancelar".

---

## 5. Catálogo de entidades

### 5.1 Deal (Oportunidad) — `V1-obligatorio`

| Campo                 | Tipo                                                     | Notas                                                                                                                                             |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | string                                                   | Auto-gen `{counter}-AQX-{initials}-{YY}` (ej. `0032-AQX-RO-26`). Legacy `d1..d30`. **En el real**: `tenantPrefix` reemplaza `AQX`, año 4 dígitos. |
| `created`             | string `YYYY-MM-DD`                                      | Inmutable.                                                                                                                                        |
| `createdAt`           | ISO 8601                                                 | Timestamp con ms.                                                                                                                                 |
| `stageEntryTime`      | int (ms epoch)                                           | Momento de entrada al stage actual.                                                                                                               |
| `stage`               | enum string                                              | Ver §6.1.                                                                                                                                         |
| `status`              | enum string                                              | Default `activo`. Ver §6.2.                                                                                                                       |
| `isArchived`          | boolean                                                  | Soft-archive. Excluido del kanban activo.                                                                                                         |
| `name`                | string, requerido                                        | Persona contacto.                                                                                                                                 |
| `company`             | string                                                   |                                                                                                                                                   |
| `phone`               | string                                                   | `XXXX-XXXX`.                                                                                                                                      |
| `whatsapp`            | string                                                   | `+502 XXXX-XXXX`.                                                                                                                                 |
| `email`               | string opcional                                          |                                                                                                                                                   |
| `notes`               | array `{text, timestamp}`                                | Notas timestamped.                                                                                                                                |
| `equipment`           | array string                                             | De catálogo Equipment.                                                                                                                            |
| `equipmentCustom`     | string                                                   | Texto libre alternativo.                                                                                                                          |
| `quote` (legacy)      | string                                                   | Migrado a `quotes[]`.                                                                                                                             |
| `quotes`              | array `{number, date, photoUrl, isVoid}`                 | Múltiples cotizaciones.                                                                                                                           |
| `paymentDoc` (legacy) | string                                                   | Migrado a `paymentDocs[]`.                                                                                                                        |
| `paymentDocs`         | array `{number, date, photoUrl, isVoid}`                 | Múltiples comprobantes.                                                                                                                           |
| `followUp` (legacy)   | string `YYYY-MM-DD`                                      | Migrado a `followUps[]`.                                                                                                                          |
| `followUps`           | array `{date, reason, result?, completed, completedAt?}` | Multi follow-up.                                                                                                                                  |
| `value`               | number                                                   | GTQ.                                                                                                                                              |
| `collab`              | string FK → Collaborator.id                              | Requerido.                                                                                                                                        |
| `assignedTo`          | string                                                   | Casi siempre `""`. Posible secondary owner; **decisión-pendiente** si se mantiene en el real.                                                     |
| `channel`             | string FK → Channel.id                                   | Requerido.                                                                                                                                        |
| `history`             | array `{action, timestamp, details?}`                    | Audit log.                                                                                                                                        |

**Notas**: en el demo `phone` aparece como requerido; en algunos seeds está vacío. Las validaciones del form sí lo exigen.

### 5.2 Client (Cliente) — `V1-obligatorio`

Derivado dinámicamente desde `deals[]` agrupando por `clientKey = lowercase(trim(${name}|${company}))`. **No es una tabla del demo**; en el real será una tabla persistente con relación 1-N a Deals (ver §15).

Campos derivados:

- `key`, `name`, `company`, `phone`, `whatsapp`, `email` (de un Deal representativo).
- `deals[]` (ids).
- Computeds: `totalOppValue`, `activeOpps`, `wonValue`, `wonCount`, `lostCount`, `nextFollowUp`.

**ClientOverride** — tabla del demo `sf-clientOverrides` (vacía en el JSON):

- `key`, `notes`, `phone`, `whatsapp`, `email`. Permite editar datos consolidados sin tocar deals.

### 5.3 Collaborator (Asesor) — `V1-obligatorio`

| Campo      | Tipo           | Notas                                                                                         |
| ---------- | -------------- | --------------------------------------------------------------------------------------------- |
| `id`       | string         | Defaults: `roberto`, `emanuel`, `jhonatan`, `leticia`. User-creados con prefix `u{epoch_ms}`. |
| `name`     | string         |                                                                                               |
| `avatar`   | string 2 chars | Iniciales (RO/EM/JH/LE).                                                                      |
| `color`    | hex string     | Color de marca.                                                                               |
| `photoUrl` | base64 string  | En el real: URL a object storage.                                                             |

### 5.4 PipelineStage — `V1-obligatorio`

| Campo      | Tipo    | Notas                                                                            |
| ---------- | ------- | -------------------------------------------------------------------------------- |
| `id`       | string  | `prospecto`, `contactado`, `cotizacion`, `negociacion`, `ganado`, `perdido`.     |
| `label`    | string  | "Prospecto", "Contactado", …                                                     |
| `sublabel` | string  | "Lead nuevo", "En conversación", …                                               |
| `color`    | hex     |                                                                                  |
| `iconName` | string  | De `STAGE_ICON_OPTIONS` (User, Phone, DollarSign, Flame, CheckCircle2, XCircle). |
| `locked`   | boolean | `ganado` y `perdido` por default.                                                |

### 5.5 Channel (Canal de venta) — `V1-obligatorio`

| Campo   | Tipo          | Notas                                                                                                                        |
| ------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`    | string        | `sala`, `telefono`, `whatsapp`, etc. User-creados con prefix `ch{epoch_ms}`.                                                 |
| `label` | string        | "Sala de Ventas", "Teléfono", "WhatsApp", "Instagram 2026".                                                                  |
| `color` | hex           |                                                                                                                              |
| `icon`  | objeto/string | En el JSON queda `{}` vacío (asignación incompleta del demo). En el real: `iconKey` referenciando catálogo de iconos lucide. |

Defaults: sala (#9333ea Store), telefono (#059669 Phone), whatsapp (#16a34a Smartphone). Deals referencian también `facebook` e `instagram` aunque no estén en defaults.

### 5.6 EquipmentType (Equipo) — `V1-obligatorio`

Array simple de strings. Defaults: `Bomba`, `Jacuzzi`, `Sauna`, `Calentador`, `Filtro`, `Hidrojet`, `Servicio Técnico`, `Iluminación`. Dos últimos sin uso en seeds.

Iconos hardcodeados en `EQUIP_BASE_ICONS` (Waves/Droplets/Thermometer/Zap/Wind/Activity para los 6 primeros; Star fallback para el resto). En el real: catálogo configurable con `iconKey`.

### 5.7 Settings / Branding (sin entidad propia en el demo)

Top-level keys: `sf-isDark`, `sf-showArchived`, `sf-customLogo`, `sf-customBgColorDark`, `sf-customBgColorLight`, `sf-customBgImage`, `sf-headerBgColor`, `sf-kpiBgColor`, `sf-dealCounter`. En el real → tabla `TenantBranding` + `TenantSettings`.

---

## 6. Estados, enums, máquinas de estado

### 6.1 `Deal.stage` — `V1-obligatorio`

```
prospecto → contactado → cotizacion → negociacion → ganado (locked)
   ↓             ↓             ↓             ↓
   └─────────────┴─────────────┴────→ perdido (locked)
```

- DnD entre stages no-locked permitido.
- Stages locked sólo se alcanzan vía botones explícitos de DealDetail.
- Movimiento backward permitido (revertir).
- Cada transición: registra `stageEntryTime` nuevo y `history` entry `stageChanged{from,to}`.

### 6.2 `Deal.status` — `V1-obligatorio`

Metadata de actividad, NO máquina de estado. Valores: `activo`, `seguimiento`, `esperando`, `frio`, `urgente`. Default `activo`. Sin reglas bloqueantes; sólo afecta filtros y color en calendario (urgent → rojo).

### 6.3 `Followup.reason` — `V1-obligatorio`

`FU_REASONS = [ "No responde", "Pide más información", "Necesita tiempo", "Revisar cotización", "Agendar visita", "Otro" ]`.

### 6.4 `Followup.completed` (boolean) + `result` (string)

`completed=false` por default. Al marcar completed: setear `completedAt = nowStamp()` y permitir `result` libre.

### 6.5 Colores y badges

- **Stage badges**: color del stage (configurable).
- **Status badges**: convención del demo:
  - `activo`: indicador azul.
  - `seguimiento`: naranja.
  - `esperando`: gris.
  - `frio`: azul claro.
  - `urgente`: rojo + highlight especial.
- **Alertas en card**:
  - "Falta Cotización" — punto rojo pulsante si el deal está en `cotizacion` o más adelante y no tiene `quotes` con `isVoid=false`.
  - "Falta Pago" — punto naranja/rojo si `stage=ganado` y no tiene `paymentDocs` con `isVoid=false`.
- **Follow-up vencido**: pill "Vencido" rojo en calendario y card.

---

## 7. Reglas de negocio

### 7.1 Generación de ID de Deal — `V1-obligatorio`

- Demo: `${dealCounter}-AQX-${collab.avatar}-${YY}` (e.g. `0032-AQX-RO-26`). `dealCounter` se incrementa al crear.
- **En el real**: el prefijo `AQX` se reemplaza por `tenantPrefix` configurable en `TenantSettings`. Año a 4 dígitos opcional (decisión-pendiente). El `counter` debe ser secuencial **por tenant** (no global).

### 7.2 Derivación de Client desde Deals — `V1-obligatorio`

- `clientKey = lowercase(trim(`${name}|${company}`))`.
- Todos los deals con la misma key se agrupan en un Client virtual.
- En el real: Client es tabla persistente; al crear/editar deal se busca Client existente por nombre+empresa, y si match, se enlaza por `clientId`. UX igual al demo: detect duplicate y ofrecer link/crear.

### 7.3 Migración legacy a arrays — `V1-obligatorio` (sólo en seed import)

Al cargar datos: si `followUp` (string) existe → mover a `followUps[0]` con `reason="Otro"`. Si `quote` (string) existe → `quotes[0]={number, date: deal.created, photoUrl: null, isVoid: false}`. Idem `paymentDoc` → `paymentDocs[0]`.

### 7.4 Alertas "Falta Cotización" / "Falta Pago" — `V1-obligatorio`

- "Falta Cotización": deal en cualquier stage que NO sea `prospecto` ni `perdido` (es decir: `contactado`, `cotizacion`, `negociacion`, `ganado`) sin ningún quote activo. Lógica exacta del demo: `stage !== "prospecto" && stage !== "perdido"`.
- "Falta Pago": deal en stage `ganado` sin ningún paymentDoc con `isVoid=false`.
- **Resolución de ambigüedad (2026-05-01)**: el demo incluye `contactado` en el scope de la alerta. En V1 real se respeta esta misma lógica: alerta desde `contactado` en adelante.

### 7.5 Cálculo de tiempos — `V1-obligatorio`

- `daysTotal = floor((now - parseDate(created)) / 86_400_000)`.
- `daysStage = stageEntryTime ? floor((now - stageEntryTime) / 86_400_000) : daysTotal`.

### 7.6 Overdue de follow-up — `V1-obligatorio`

Comparación `new Date(date+"T12:00:00") < todayMidnight`. La hora local mediodía evita off-by-one por TZ.

### 7.7 Compresión de imágenes — `V1-no-portar`

Demo: `compressImage(dataUrl, max=450KB)` para meterla en localStorage. En el real: NO se almacena base64 en DB; uploads van a object storage (S3-compatible). El cliente sube vía URL firmada y guarda sólo la URL.

### 7.8 History entries — `V1-obligatorio`

Eventos: `created`, `stageChanged{from,to}`, `collabChanged{from,to}`, `valueChanged{oldValue,newValue}`, `quoteAdded{number}`, `paymentAdded{number}`, `archived`, `followUpAdded{date,reason}`, `followUpCompleted{date,result}`. En el real: tabla `Activity(tenantId, dealId, type, payload, userId, ts)` o JSONB en Deal — recomendación tabla por queryability.

### 7.9 Filtros globales (Pipeline) — `V1-obligatorio`

Compuestos AND. Filtros: collaborator, channel, equipment, alertas, dateRange. Aplican a kanban + KPIs del header.

### 7.10 Rangos de fecha (presets) — `V1-obligatorio`

- `all` (sin filtro).
- `today` (created hoy).
- `week` (últimos 7 días).
- `month` (últimos 30 días).
- `quarter` (últimos 90 días).
- `year` (año calendario actual).
- `custom` con `customDateFrom` y `customDateTo` (`YYYY-MM-DD`, ambos inclusive, comparado al noon).

### 7.11 Validaciones obligatorias del ClientForm — `V1-obligatorio`

- `collab`, `channel`, `name`, `phone` requeridos.
- Al menos uno de `equipment[]` no vacío o `equipmentCustom` no vacío.
- Phone formato `XXXX-XXXX`. WhatsApp formato `+502 XXXX-XXXX`. Email formato standard si presente.
- Detección de duplicado por `clientKey`.

### 7.12 Inmutabilidad — `V1-obligatorio`

- `id`, `created`, `createdAt` son inmutables tras creación.
- `dealCounter` sólo se incrementa.

### 7.13 Soft-archive — `V1-obligatorio`

Archivo no es delete. `isArchived=true` excluye de pipeline activo y KPIs. Visible en tab Archivo y en historial del Cliente. Decisión-pendiente: si existe hard-delete (con `force=true` para owner).

---

## 8. KPIs y fórmulas

Aplican filtros de fecha y filtros globales según contexto. `count(...)` = número de deals que cumplen condición; `sum(...)` = suma de `value`.

### 8.1 Pipeline / Resumen

- **Total Embudo** = sum(deal.value WHERE !isArchived AND stage NOT IN (ganado, perdido)).
- **Ganado (revenue)** = sum(deal.value WHERE stage=ganado).
- **Perdido (revenue)** = sum(deal.value WHERE stage=perdido).
- **Tasa de cierre (%)** = won_count / max(active_count, 1) × 100, donde `active_count = count(!isArchived)` y `won_count = count(stage=ganado)`. (Definición conservadora: incluye el universo total no archivado.)
- **Ticket promedio** = total_pipeline / max(active_count_open, 1), donde `active_count_open = count(!isArchived AND stage NOT IN (ganado, perdido))`.

### 8.2 Embudo (tab)

- **Por stage**: count(deals con ese stage), sum(value), tasa de conversión = count(stage=S y eventualmente ganado) / count(stage=S) × 100. La definición exacta de "eventualmente ganado" requiere mirar history; simplificación V1: deal actualmente en `ganado` cuya history muestra haber pasado por S.

### 8.3 Equipo

- Por collaborator: dealsCount, wonCount, lostCount, closingRate = wonCount/dealsCount × 100, totalValue = sum(value), wonValue.

### 8.4 Canal

- Por channel: dealsCount, totalValue, wonCount, wonValue.

### 8.5 Productos

- Por equipment type: demandCount = count(equipment include T AND stage != ganado), soldCount = count(equipment include T AND stage = ganado), pendingValue, soldValue.

### 8.6 Cliente (ficha)

- totalOpps, activeOpps, wonCount, wonValue, totalValue, nextFollowUp = min(followUp.date WHERE !completed).

### 8.7 Alertas (tab)

- Lista de `followUps` con `completed=false` y `date <= today` o `date <= today+7`. Categorías: vencidos / hoy / próximos 7 días.

---

## 9. Concepts específicos de aquasistemas

Lo único industry-specific que el demo expone:

- **Catálogo de equipos**: Bomba, Jacuzzi, Sauna, Calentador, Filtro, Hidrojet, Servicio Técnico, Iluminación.
- **Locale/currency/phone**: es-GT, GTQ (`Q`), `+502`, `XXXX-XXXX`.
- **ID prefix `AQX`** (placeholder Aquasistemas) — se vuelve `tenantPrefix` configurable.
- **Naming Spanish-first** — toda la UI en español.

**Lo que el demo NO tiene** (post-V1 si lo pide la industria): análisis de agua (pH, dureza, cloro, presión, caudal), fichas de instalación técnica, contratos de mantenimiento recurrente, planes de servicio, garantía, calibración.

---

## 10. Persistencia del demo

Top-level keys (`sf-*`):

| Key                     | Tipo                 | Notas                    |
| ----------------------- | -------------------- | ------------------------ |
| `sf-deals`              | array Deal           | 32 items en seed.        |
| `sf-dealCounter`        | int (stringified)    | Próximo número (ej. 32). |
| `sf-collaborators`      | array Collaborator   | 7 (4 default + 3 user).  |
| `sf-stages`             | array Stage          | 6 default.               |
| `sf-equipment`          | array string         | 8 default.               |
| `sf-channels`           | array Channel        | 4 (3 default + 1 user).  |
| `sf-clientOverrides`    | array ClientOverride | 0 en seed.               |
| `sf-isDark`             | boolean              |                          |
| `sf-showArchived`       | boolean              |                          |
| `sf-customLogo`         | base64 string        |                          |
| `sf-customBgColorDark`  | hex                  |                          |
| `sf-customBgColorLight` | hex                  |                          |
| `sf-customBgImage`      | base64 string        |                          |
| `sf-headerBgColor`      | hex                  |                          |
| `sf-kpiBgColor`         | hex                  |                          |

Persistencia: POST a `/api/data` con todo el state serializado. Server escribe `data/app-data.json`. Sin auth, sin concurrencia, sin tenant. **NO se traslada al real.**

---

## 11. Glosario de strings UI (verbatim, español)

**Tabs**: Embudo, Clientes, Calendario, Archivo, Estadísticas.

**Filtros**: Todos los Asesores, Todos los Canales, Todos los Equipos, Sin Alertas, Cualquier fecha, Limpiar Filtros.

**Rangos de fecha**: Toda la vida, Últimos 30 días, Últimos 90 días, Este año, Hoy, Última semana, Último mes, Último trimestre, Rango personalizado, Desde, Hasta.

**Stages**: Prospecto / Lead nuevo, Contactado / En conversación, Cotización / Propuesta enviada, Negociación / Cerrando trato, Ganado / Venta cerrada, Perdido / No avanzó.

**Status**: Activo, Seguimiento, Esperando resp., Frío, Urgente.

**Follow-up reasons**: No responde, Pide más información, Necesita tiempo, Revisar cotización, Agendar visita, Otro.

**Botones genéricos**: Guardar, Cancelar, Editar, Eliminar, Cerrar, Imprimir, Buscar, Confirmar.

**Acciones de deal**: Nueva oportunidad, Mover a [stage], Marcar como ganado, Marcar como perdido, Archivar, Marcar completado.

**Alertas**: Falta Cotización, Falta Pago, Vencido, Seguim. Vencido.

**KPIs**: Total Embudo, Ganado, Perdido, Tasa de cierre, Ticket promedio, Oportunidades, Activas, Ganadas, Total comprado, Días en etapa, Días totales.

**Vistas/Sub-tabs**: Resumen, Listado, Embudo, Equipo, Canal, Productos, Alertas, Apariencia, Usuarios, Equipos, Canales.

**Cliente**: Notas del cliente, Próximo seguimiento, Historial de oportunidades.

**Calendario**: Hoy, No hay seguimientos programados para este día.

**Settings**: Cargar datos de ejemplo, Limpiar todos los datos, Logo personalizado, Fondo personalizado, Permisos.

**Empty states**: "Selecciona un cliente para ver su ficha completa", "Sin notas globales aún.", "Cargando datos…".

**Footer**: "Diseñado por Vértice y Desarrollado por Koi Software {year}".

**Validaciones (mensajes)**: "Debe seleccionar un equipo o ingresarlo manualmente". (Otros mensajes son inferidos; el demo es laxo en feedback de error.)

---

## 12. Estados vacíos / loading / errores

- **Loading inicial**: pantalla full con icono Droplets en gradient + "Cargando datos…" + animación pulse.
- **Empty list cliente**: ver §3.2.
- **Empty calendario día**: ver §3.3.
- **Empty notas**: "Sin notas globales aún." en clientes; en deal: sin texto, sólo el form.
- **Empty búsqueda**: lista vacía sin mensaje (gap del demo — `V1-inferido` agregar "Sin resultados").
- **Errores**: el demo silencia errores de red (try/catch con console.warn). No hay toasts. **`V1-inferido`**: sistema de toasts (sonner) para feedback.

---

## 13. Iconografía (lucide-react)

| Icono                                             | Uso                                                      |
| ------------------------------------------------- | -------------------------------------------------------- |
| `LayoutDashboard`                                 | Tab Embudo                                               |
| `Users`                                           | Tab Clientes                                             |
| `Calendar`, `CalendarCheck`                       | Tab Calendario, follow-ups                               |
| `Archive`                                         | Tab Archivo                                              |
| `BarChart2`                                       | Tab Estadísticas                                         |
| `Plus`                                            | Add buttons                                              |
| `Search`                                          | Search input                                             |
| `Droplets`                                        | Logo default                                             |
| `Settings`                                        | Botón settings                                           |
| `Printer`                                         | Botón imprimir                                           |
| `Sun` / `Moon`                                    | Toggle theme                                             |
| `ChevronLeft/Right/Down`                          | Navegación                                               |
| `User`                                            | Filtro asesor / stage prospecto                          |
| `Smartphone`                                      | Filtro canal / canal whatsapp                            |
| `Package`                                         | Filtro equipo                                            |
| `AlertTriangle`                                   | Filtro alertas                                           |
| `Clock`                                           | Tiempo                                                   |
| `Phone`                                           | Phone field / canal teléfono / stage contactado          |
| `MessageSquare`                                   | WhatsApp field                                           |
| `Mail`                                            | Email field                                              |
| `Building2`                                       | Empresa                                                  |
| `Edit3`, `Save`, `X`                              | Edit / save / close                                      |
| `Hash`                                            | Quote reference                                          |
| `StickyNote`                                      | Notas                                                    |
| `History`                                         | History timeline                                         |
| `Star`                                            | Equipment custom fallback                                |
| `RotateCcw`                                       | Limpiar filtros                                          |
| `DollarSign`                                      | Stage cotización                                         |
| `Flame`                                           | Stage negociación                                        |
| `CheckCircle2`                                    | Stage ganado                                             |
| `XCircle`                                         | Stage perdido                                            |
| `Store`                                           | Canal sala                                               |
| `Waves`, `Thermometer`, `Zap`, `Wind`, `Activity` | Equipment icons (Bomba/Sauna/Calentador/Filtro/Hidrojet) |

---

## 14. Animaciones / interacciones

- **Drag-and-drop** kanban (deals entre stages) y settings (reorder de stages). En el real: `@dnd-kit/core` (NO portar el demo).
- **Compresión de imágenes** en upload — sólo demo workaround. NO portar.
- **Animación `sfPing`** definida en `index.css` para indicadores de alerta. En el real: replicar con Tailwind `animate-ping` o keyframes propios.
- **Debounce de save** 500ms en `persistence.js`. NO portar (server actions invalidan on-success).
- **`beforeunload`/`sendBeacon`** para flush. NO portar.

---

## 15. Gaps del demo (deben diseñarse de cero)

| Gap                                      | Impacto                                   | Categoría                                    |
| ---------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| No hay autenticación                     | Cualquier usuario ve todo.                | V1-obligatorio (Auth.js)                     |
| No hay multitenancy                      | Un único negocio.                         | V1-obligatorio (Tenant)                      |
| No hay roles/permisos                    | Sin RBAC.                                 | V1-obligatorio (RBAC)                        |
| Persistencia file-based sin concurrencia | Race conditions.                          | V1-obligatorio (Postgres + RLS)              |
| Imágenes en base64 en JSON 5MB           | Inviable a escala.                        | V1-obligatorio (Object storage)              |
| Búsqueda client-side full                | No escala.                                | V1-obligatorio (índices BD + search server)  |
| Search modal feedback                    | Sin "sin resultados".                     | V1-inferido                                  |
| Notificaciones                           | No hay. Follow-up overdue no avisa.       | V1-inferido (in-app) / Post-V1 (email)       |
| Sin auditoría usuario                    | History no atribuye al usuario que actuó. | V1-obligatorio (Activity con userId)         |
| Sin CSV/Excel import-export              | El primer cliente lo pide.                | Decisión-pendiente                           |
| Sin i18n                                 | Hardcoded es-GT.                          | Decisión-pendiente (i18n V1 vs Post-V1)      |
| Sin MFA / password reset                 | Auth básica.                              | V1-inferido (Auth.js soporta)                |
| Sin email transaccional                  | Onboarding/invitación rotas.              | V1-obligatorio (proveedor TBD)               |
| Mobile responsive                        | Demo funciona pero no está optimizado.    | V1-inferido                                  |
| Accesibilidad teclado                    | DnD no accesible.                         | V1-inferido (`@dnd-kit` con keyboard sensor) |
| Validaciones server-side                 | Demo sólo client.                         | V1-obligatorio (Zod)                         |
| Detección duplicados de cliente          | Demo lo intenta pero el flujo es tosco.   | V1-obligatorio (UX explícito)                |
| Soft-delete vs hard-delete               | Sólo archive.                             | Decisión-pendiente                           |
| Multi-pipeline por tenant                | Demo: 1 pipeline.                         | Decisión-pendiente                           |
| Recargas concurrentes (multi-usuario)    | Demo: state local.                        | V1-obligatorio (RSC + revalidate)            |
| Custom fields                            | Demo: estructura fija.                    | V1-obligatorio (engine de custom fields)     |
| Branding por tenant                      | Demo: global.                             | V1-obligatorio (TenantBranding)              |

---

## 16. Mapeo demo → producto real (resumen)

| Concepto demo                 | Concepto real                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `sf-deals`                    | tabla `Deal` con `tenantId`                                                     |
| `sf-collaborators`            | tabla `User` + `Membership(role)`                                               |
| `sf-stages`                   | tabla `PipelineStage` ligada a `Pipeline` (un pipeline por tenant en V1)        |
| `sf-channels`, `sf-equipment` | tabla `CatalogItem(tenantId, catalogKey, label, color, iconKey, metadata)`      |
| `sf-clientOverrides`          | tabla `Client` (deja de ser override; es entidad propia con `customData JSONB`) |
| `sf-customLogo` etc.          | tabla `TenantBranding`                                                          |
| Base64 photos                 | URL a object storage                                                            |
| `data/app-data.json`          | Postgres + RLS                                                                  |
| `dealCounter`                 | secuencia/`Counter` por tenant                                                  |
| `AQX` prefijo                 | `tenantPrefix` en `TenantSettings`                                              |
| Estructura fija de Deal       | Deal core + `customData JSONB` + `CustomFieldDefinition`                        |
| `history` array embebido      | tabla `Activity(tenantId, dealId, userId, type, payload, ts)`                   |

---

## 17. Categorización resumida

**V1-obligatorio** (debe estar en V1 según el demo): todas las vistas raíz, los 4 modales principales, las 7 entidades, los 3 enums, todas las reglas de §7 excepto compresión de imágenes, los KPIs de §8, todas las gaps marcadas como obligatorias en §15.

**V1-inferido**: FilePreviewModal, ConfirmDialog, sistema de toasts, "sin resultados" en search, accesibilidad teclado mínima, mobile responsive, detección duplicados explícita.

**Post-V1**: análisis técnico de agua (pH, dureza), contratos de mantenimiento, multi-pipeline, integración Google Calendar, configurador visual de forms y vistas, formularios públicos para captura de leads, automatizaciones/reglas configurables.

**Decisión-pendiente**: política de hard-delete, importar/exportar CSV/Excel, i18n V1 o Post-V1, MFA V1 o Post-V1, hosting/storage/email concretos, alcance de auditoría, multi-pipeline V1, retención de datos, formato exacto de IDs `tenantPrefix-counter-initials-YY` (4 dígitos en counter + año 4 dígitos vs 2).

---

## 18. Notas finales

- Este inventario es la **única fuente de verdad** para implementar V1 sin releer el demo. Si un agente descubre algo nuevo, debe agregarlo aquí antes de continuar.
- Cualquier relectura inevitable de `hardcoded-demo/` debe quedar registrada en `DECISIONS_AND_OPEN_QUESTIONS.md` con: archivo, motivo, hallazgo nuevo.
- Los detalles de implementación en código NO deben portarse: este inventario describe **qué hace** el demo, no **cómo lo implementa**.
