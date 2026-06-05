# PARITY AUDIT — demo (`hardcoded-demo`) → producción (`crm-core`)

Auditoría visual/funcional pantalla por pantalla, hecha **corriendo ambas apps** (CRM en `localhost:3000`, demo en `localhost:5173`) con datos reales (seed `demo-aqua`). Source of truth del estado de paridad — se actualiza conforme se cierran brechas.

Leyenda: ✅ idéntico/equivalente · ⚠️ funciona pero difiere visualmente · ❌ falta · 🔵 demo-ism que NO debe portarse a PROD.

Método: capturas en `/tmp/shots` (CRM) y `/tmp/demoshots` (demo), 1512×950. Comparado contra `DEMO_INVENTORY.md`.

---

## 0. Header / Nav / Footer / Tema

| Ítem | Estado | Detalle |
|---|---|---|
| Enlaces nav `Embudo·Calendario·Estadísticas` | ✅ | existían |
| Enlaces nav `Clientes` (+badge) y `Archivo` | ✅ **(arreglado)** | el demo navega los 5; faltaban Clientes+Archivo. Añadidos con iconos y badge de conteo en `components/app/tenant-header.tsx` + `countClients()` en `features/clients/queries.ts` + `layout.tsx`. |
| Iconos en items de nav | ✅ **(arreglado)** | demo usa LayoutDashboard/Users/Calendar/Archive/BarChart2; añadidos. |
| Footer de crédito | ✅ | "Diseñado por Vértice y Desarrollado por Koi Software 2026" (`layout.tsx:35`). |
| Búsqueda global | ⚠️ | demo: input "Buscar todo…" siempre visible en header. CRM: botón "Buscar ⌘K" → CommandMenu. Funcional, distinto visual. |
| Botón "+ Nueva Oportunidad" en header | ⚠️ | demo lo tiene en el header; CRM lo tiene dentro de la página de Embudo. |
| Toggle rápido de tema (sol/luna) en header | ❌ | demo tiene toggle claro/oscuro en el header. CRM solo lo cambia desde Settings→Apariencia. |
| Botón imprimir en header | ⚠️ | demo: icono print en header. CRM: imprimir está dentro del Embudo. |
| Logo de empresa en header | ⚠️ | demo muestra el logotipo subido; CRM muestra `productName`/nombre como texto (branding del tenant). Verificar render de logo. |

## 1. Embudo / Pipeline (Kanban)

| Ítem | Estado | Detalle |
|---|---|---|
| 6 columnas (Prospecto…Perdido), color por etapa, conteo+valor | ✅ | equivalente. |
| Tarjetas: avatar, nombre, empresa, valor, badges, equipo, alertas pulsantes | ✅ | DealCard fiel (incluye animación `sfPing`). |
| Filtros (asesor/canal/equipo/alertas/fecha) | ✅ | FilterBar presente. |
| KPIs cabecera (Total embudo / Ganado) | ✅ | KpiBar. |
| Drag & drop entre etapas | ✅ | @dnd-kit. Verificar persistencia en flujo manual. |
| Colapsar columna (modo compacto) | ⚠️ | confirmar paridad de interacción. |

## 2. Modal detalle de oportunidad (DealDetailModal) — pantalla más rica

| Ítem | Estado | Detalle |
|---|---|---|
| Layout 3 columnas | ✅ | contacto+cotiz/pagos / acciones+seguimientos+notas / historial. |
| Badge ID de oportunidad | ⚠️ | formato `AQX-0030-ET-26` (AQX primero). Demo: `0032-AQX-RO-26` (contador primero). Ver DP-10. |
| Cotizaciones / comprobantes (agregar) | ✅ | secciones presentes. |
| Enlace WhatsApp (wa.me) | ❌ | demo muestra tel **y** WhatsApp con enlace. CRM muestra solo teléfono. |
| Chip de estado (Activo/Seguimiento/Frío/Urgente…) | ❌ | demo lo muestra; CRM no en el detalle. |
| Anular cotización/pago (strikethrough) | ❌ | demo permite anular con tachado; verificar en CRM. |
| Seguimientos completados (sección + tachado) | ⚠️ | demo separa pendientes/completados con resultado inline. CRM muestra pendientes. |
| Checkbox "Agregar a Google Calendar" | 🔵/❌ | demo abre evento GCal pre-llenado. Post-V1 (sync GCal diferido). Mantener fuera de V1. |
| Edición inline (click-to-edit nombre/valor/empresa) | ⚠️ | demo edita inline; confirmar en CRM. |
| Acciones de etapa | ⚠️ | demo: "Etapa siguiente" (color) / "Ganar" / "Perder". CRM: "Mover a…" + "Marcar como ganado" + "Archivar". |
| Historial permanente (timeline con puntos) | ✅ | presente ("Historial"). |

## 3. Modal crear/editar (ClientFormModal)

| Ítem | Estado | Detalle |
|---|---|---|
| Form 2 columnas, validación, cotiz/pagos inline, notas | ✅ | 905 líneas; pendiente verificación visual fina contra demo. |

## 4. Clientes

| Ítem | Estado | Detalle |
|---|---|---|
| Lista + buscador + orden A-Z/Reciente | ✅ | funcional. |
| Placeholder buscador | ⚠️ | demo "Buscar por nombre, empresa o teléfono…" vs CRM "Buscar clientes…". |
| Etiqueta de orden | ⚠️ | demo "Fecha" vs CRM "Reciente". |
| Conteo "N clientes" sobre la lista | ❌ | demo lo muestra; CRM no. |
| Stats por cliente en cada fila ("N oportunidades · N activas · Ganado $$") | ❌ | demo las muestra; CRM solo nombre+empresa. |
| Índice alfabético | ⚠️ | demo: barra vertical A-Z a la derecha. CRM: fila horizontal arriba + headers de letra (UX distinta). |
| Ficha de cliente (KPIs, filtro rango, notas, historial) | ✅ | ClientProfile presente; verificar paridad fina. |

## 5. Calendario

| Ítem | Estado | Detalle |
|---|---|---|
| Grid mensual, eventos por día, panel lateral del día | ✅ | funcional con datos reales. |
| Título "Calendario de Seguimientos" | ❌ | falta el heading. |
| Indicador de "hoy" | ⚠️ | demo: círculo azul en el número. CRM: borde de celda. |
| Días de relleno mes anterior/siguiente (grid 6 filas) | ⚠️ | demo completa la rejilla; CRM corta en fin de mes. |
| Posición del filtro de asesor | ⚠️ | demo: arriba-izq junto al título. CRM: arriba-der. |

## 6. Archivo

| Ítem | Estado | Detalle |
|---|---|---|
| Tabla de oportunidades archivadas | ✅ | ArchiveTable presente (verificación fina pendiente). |

## 7. Estadísticas (recharts)

| Ítem | Estado | Detalle |
|---|---|---|
| Sub-tabs: resumen, embudo, canal, equipo, productos, listado, alertas | ✅ | todas implementadas con charts. Verificación visual fina pendiente vs demo. |

## 8. Settings (Configuración)

| Ítem | Estado | Detalle |
|---|---|---|
| Pestañas Apariencia/Usuarios/Equipos/Embudo | ✅ | **calco muy fiel** del panel del demo. |
| Apariencia: modo pantalla, fondo claro/oscuro, imagen fondo, logo, mostrar archivadas | ✅ | todas presentes. |
| Estructura panel deslizante vs página | ⚠️ (decisión) | demo: Sheet deslizante sobre el embudo. CRM: página centrada con tabs. Default PROD: mantener página (mejor white-label). Confirmar con owner. |
| "Cargar datos de prueba" / "Borrar todo" | 🔵 | demo-ism (localStorage). Correctamente omitido en PROD (datos vienen de DB/seed). |

---

## Brechas cerradas en esta sesión
- **Nav header**: añadidos `Clientes` (con badge de conteo) y `Archivo`, con iconos, en el orden del demo (`tenant-header.tsx`, `layout.tsx`, `countClients()`).
- **Calendario**: añadido título "Calendario de Seguimientos" y barra reordenada como el demo (título+Hoy+filtro izq, mes+flechas der) (`CalendarClient.tsx`).
- **Clientes**: placeholder "Buscar por nombre, empresa o teléfono…", contador "N clientes", etiqueta de orden "Fecha", y línea "N oportunidad(es)" por fila (`ClientSidebar.tsx`).

## Hallazgos adicionales (calidad/PROD, no estrictamente paridad visual)
- **Fuga de industria (AGENT_RULES §5)**: `lib/settings/constants.ts` (`EQUIPMENT_ICONS`) hardcodea etiquetas de aquasistemas (Bomba/Jacuzzi/Sauna/Calentador/Filtro/Hidrojet) → icono. Debería resolverse vía `CatalogItem.iconKey` con un registro de iconos genérico. Preexistente; no tocado (refactor con riesgo de romper iconos en toda la app). Pendiente.
- **Lint preexistente arreglado**: 3 rutas `app/api/upload/*` violaban `consistent-type-imports` (rompían `pnpm lint`). Corregido.
- **Config Prettier desalineada con el repo**: `.prettierrc` define `semi: true` pero TODO el repo está escrito sin `;` → `prettier --check .` falla en ~221 archivos. Mis archivos se dejaron en el estilo dominante (sin `;`) para no introducir inconsistencia. Decisión de repo: alinear `.prettierrc` (`semi:false`) o reformatear todo — fuera del alcance de esta sesión.
- **Caché `.next` obsoleta**: un dev server viejo servía un chunk de zod inexistente; se resolvió limpiando `.next` y reiniciando.

## Verificación de esta sesión
- `pnpm type-check` ✅ · `pnpm lint` ✅ · `pnpm test` (unit) 46/46 ✅ · `pnpm test:integration` 152/152 ✅ (Postgres real).
- App corriendo en `localhost:3000` con seed `demo-aqua` (30 deals); cambios verificados con capturas.

## Backlog de paridad restante (prioridad sugerida)
1. **Alta visibilidad / bajo riesgo:** título "Calendario de Seguimientos"; conteo "N clientes" + stats por fila en Clientes; placeholder/etiquetas de Clientes.
2. **Media:** indicador "hoy" tipo círculo y grid 6-filas en calendario; chip de estado + enlace WhatsApp en detalle; sección de seguimientos completados.
3. **Header avanzado:** input de búsqueda siempre visible, toggle de tema rápido, botón Nueva Oportunidad e imprimir en header (re-layout del header).
4. **Decisión owner:** settings panel deslizante vs página; formato exacto de ID (DP-10).
5. **Fuera de V1:** checkbox Google Calendar (sync diferido a post-V1).
