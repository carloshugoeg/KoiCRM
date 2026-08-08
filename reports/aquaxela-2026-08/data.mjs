// Snapshot de datos extraidos de Supabase (proyecto koi-crm-prod)
// Tenant: AquaXela (cmq12wvdz0000nm0yuaoz2w7e)
// Corte: 2026-08-08. Ventana de actividad: 2026-06-08 -> 2026-08-07.
// Todas las cifras provienen de consultas SQL directas; ver README.md para el detalle.

export const META = {
  tenant: 'AquaXela',
  slug: 'aquaxela',
  proyecto: 'koi-crm-prod',
  tenantCreado: '2026-06-05',
  desde: '2026-06-08',
  hasta: '2026-08-07',
  corte: '2026-08-08',
  diasCalendario: 61,
  diasConActividad: 43,
  moneda: 'Q',
};

export const TOTALES = {
  negocios: 290,
  clientes: 273,
  cotizaciones: 169,
  pagos: 151,
  adjuntos: 330,
  adjuntosMB: 37.8,
  seguimientos: 86,
  notas: 39,
  acciones: 1108,
  usuariosConMembresia: 10,
  usuariosConActividad: 7,
  valorTotal: 1373312,
  valorGanado: 669812,
  valorAbierto: 657480,
  ganados: 139,
  perdidos: 4,
  abiertos: 147,
};

export const ACCIONES_POR_TIPO = [
  { key: 'created', label: 'Negocio creado', n: 294, usuarios: 7 },
  { key: 'stageChanged', label: 'Cambio de etapa', n: 271, usuarios: 7 },
  { key: 'quoteAdded', label: 'Cotización adjuntada', n: 171, usuarios: 7 },
  { key: 'paymentAdded', label: 'Pago / factura', n: 152, usuarios: 5 },
  { key: 'followUpAdded', label: 'Seguimiento agendado', n: 88, usuarios: 6 },
  { key: 'noteAdded', label: 'Nota', n: 40, usuarios: 5 },
  { key: 'valueChanged', label: 'Cambio de valor', n: 37, usuarios: 5 },
  { key: 'followUpCompleted', label: 'Seguimiento cerrado', n: 35, usuarios: 2 },
  { key: 'ownerChanged', label: 'Reasignación', n: 16, usuarios: 4 },
  { key: 'deleted', label: 'Eliminación', n: 4, usuarios: 1 },
];

export const OPERADORES = [
  {
    nombre: 'Roberto Yax', corto: 'R. Yax', rol: 'MEMBER',
    acciones: 526, diasActivos: 24, primerDia: '2026-06-13', ultimoDia: '2026-08-07',
    deals: 104, ganados: 70, perdidos: 2, tasaGanado: 67.3,
    valorTotal: 879933.5, valorGanado: 551338.5, valorAbierto: 297095,
    ticketProm: 8460.9, ticketGanado: 7876.26, sinValor: 7,
    conCotizacion: 83, conPago: 77, conSeguimiento: 67, conNota: 13, conAdjunto: 91,
    abiertos: 32, frios30d: 7, valorFrio: 40430,
    mix: { created: 108, stageChanged: 114, quoteAdded: 86, paymentAdded: 81, followUpAdded: 70, followUpCompleted: 27, noteAdded: 15, valueChanged: 13, ownerChanged: 12 },
  },
  {
    nombre: 'Julio Armas', corto: 'J. Armas', rol: 'MEMBER',
    acciones: 324, diasActivos: 16, primerDia: '2026-07-13', ultimoDia: '2026-08-07',
    deals: 131, ganados: 31, perdidos: 1, tasaGanado: 23.7,
    valorTotal: 220683.5, valorGanado: 43043.5, valorAbierto: 163520,
    ticketProm: 1684.61, ticketGanado: 1388.5, sinValor: 80,
    conCotizacion: 48, conPago: 31, conSeguimiento: 9, conNota: 15, conAdjunto: 48,
    abiertos: 99, frios30d: 0, valorFrio: 0,
    mix: { created: 131, stageChanged: 60, quoteAdded: 49, paymentAdded: 31, valueChanged: 17, noteAdded: 15, followUpAdded: 13, followUpCompleted: 8 },
  },
  {
    nombre: 'Leticia Sinay', corto: 'L. Sinay', rol: 'MEMBER',
    acciones: 177, diasActivos: 24, primerDia: '2026-06-13', ultimoDia: '2026-08-06',
    deals: 42, ganados: 37, perdidos: 1, tasaGanado: 88.1,
    valorTotal: 78295, valorGanado: 62645, valorAbierto: 15250,
    ticketProm: 1864.17, ticketGanado: 1693.11, sinValor: 0,
    conCotizacion: 24, conPago: 37, conSeguimiento: 1, conNota: 4, conAdjunto: 42,
    abiertos: 4, frios30d: 0, valorFrio: 0,
    mix: { created: 43, stageChanged: 60, quoteAdded: 29, paymentAdded: 37, noteAdded: 5, ownerChanged: 1, followUpAdded: 1, valueChanged: 1 },
  },
  {
    nombre: 'Koi CRM Admin', corto: 'Admin', rol: 'OWNER',
    acciones: 43, diasActivos: 5, primerDia: '2026-06-08', ultimoDia: '2026-07-21',
    deals: 3, ganados: 0, perdidos: 0, tasaGanado: 0,
    valorTotal: 10650, valorGanado: 0, valorAbierto: 10650,
    ticketProm: 3550, ticketGanado: 0, sinValor: 0,
    conCotizacion: 3, conPago: 3, conSeguimiento: 2, conNota: 0, conAdjunto: 3,
    abiertos: 3, frios30d: 0, valorFrio: 0,
    mix: { stageChanged: 25, valueChanged: 5, deleted: 4, created: 3, ownerChanged: 2, quoteAdded: 1, paymentAdded: 1, followUpAdded: 1, noteAdded: 1 },
  },
  {
    nombre: 'Paola Chaj', corto: 'P. Chaj', rol: 'MEMBER',
    acciones: 19, diasActivos: 2, primerDia: '2026-07-21', ultimoDia: '2026-07-28',
    deals: 0, ganados: 0, perdidos: 0, tasaGanado: null,
    valorTotal: 0, valorGanado: 0, valorAbierto: 0,
    ticketProm: 0, ticketGanado: 0, sinValor: 0,
    conCotizacion: 0, conPago: 0, conSeguimiento: 0, conNota: 0, conAdjunto: 0,
    abiertos: 0, frios30d: 0, valorFrio: 0,
    mix: { created: 6, noteAdded: 4, stageChanged: 3, quoteAdded: 3, paymentAdded: 2, followUpAdded: 1 },
  },
  {
    nombre: 'Carlos Hugo Escobar', corto: 'C. Escobar', rol: 'ADMIN',
    acciones: 11, diasActivos: 2, primerDia: '2026-06-09', ultimoDia: '2026-06-13',
    deals: 0, ganados: 0, perdidos: 0, tasaGanado: null,
    valorTotal: 0, valorGanado: 0, valorAbierto: 0,
    ticketProm: 0, ticketGanado: 0, sinValor: 0,
    conCotizacion: 0, conPago: 0, conSeguimiento: 0, conNota: 0, conAdjunto: 0,
    abiertos: 0, frios30d: 0, valorFrio: 0,
    mix: { stageChanged: 7, ownerChanged: 1, valueChanged: 1, quoteAdded: 1, created: 1 },
  },
  {
    nombre: 'Jimena Alvarez', corto: 'J. Alvarez', rol: 'MEMBER',
    acciones: 8, diasActivos: 1, primerDia: '2026-06-13', ultimoDia: '2026-06-13',
    deals: 2, ganados: 0, perdidos: 0, tasaGanado: 0,
    valorTotal: 48000, valorGanado: 0, valorAbierto: 48000,
    ticketProm: 24000, ticketGanado: 0, sinValor: 0,
    conCotizacion: 2, conPago: 0, conSeguimiento: 2, conNota: 0, conAdjunto: 2,
    abiertos: 2, frios30d: 2, valorFrio: 48000,
    mix: { quoteAdded: 2, stageChanged: 2, created: 2, followUpAdded: 2 },
  },
];

// Con membresia activa pero sin una sola accion registrada en la ventana.
export const OPERADORES_INACTIVOS = [
  { nombre: 'Jonathan Perez', rol: 'MEMBER', deals: 6, ganados: 1, valorAbierto: 70465, nota: 'Tiene 6 negocios asignados por otros, cero acciones propias' },
  { nombre: 'Emanuel Fuentes', rol: 'ADMIN', deals: 2, ganados: 0, valorAbierto: 52500, nota: 'Rol ADMIN sin uso; 1 negocio frío de Q38,000' },
  { nombre: 'Nancy Perez', rol: 'SUPERVISOR', deals: 0, ganados: 0, valorAbierto: 0, nota: 'Rol SUPERVISOR nunca ejercido; sin visibilidad de equipo' },
];

export const SEMANAS = [
  { semana: '2026-06-08', label: '08 jun', acciones: 63, usuarios: 5, creados: 8, etapas: 37, cotiz: 4, pagos: 2, parcial: false },
  { semana: '2026-06-15', label: '15 jun', acciones: 56, usuarios: 3, creados: 14, etapas: 19, cotiz: 4, pagos: 9, parcial: false },
  { semana: '2026-06-22', label: '22 jun', acciones: 66, usuarios: 2, creados: 16, etapas: 17, cotiz: 8, pagos: 12, parcial: false },
  { semana: '2026-06-29', label: '29 jun', acciones: 45, usuarios: 2, creados: 10, etapas: 12, cotiz: 8, pagos: 9, parcial: false },
  { semana: '2026-07-06', label: '06 jul', acciones: 68, usuarios: 2, creados: 15, etapas: 17, cotiz: 12, pagos: 15, parcial: false },
  { semana: '2026-07-13', label: '13 jul', acciones: 158, usuarios: 3, creados: 32, etapas: 33, cotiz: 30, pagos: 23, parcial: false },
  { semana: '2026-07-20', label: '20 jul', acciones: 255, usuarios: 5, creados: 50, etapas: 61, cotiz: 47, pagos: 33, parcial: false },
  { semana: '2026-07-27', label: '27 jul', acciones: 265, usuarios: 4, creados: 109, etapas: 49, cotiz: 37, pagos: 28, parcial: false },
  { semana: '2026-08-03', label: '03 ago', acciones: 132, usuarios: 3, creados: 40, etapas: 26, cotiz: 21, pagos: 21, parcial: true },
];

export const SEMANAS_POR_OPERADOR = {
  'Roberto Yax': { '2026-06-08': 2, '2026-06-15': 26, '2026-06-22': 43, '2026-06-29': 29, '2026-07-06': 44, '2026-07-13': 108, '2026-07-20': 148, '2026-07-27': 83, '2026-08-03': 43 },
  'Julio Armas': { '2026-07-13': 45, '2026-07-20': 56, '2026-07-27': 147, '2026-08-03': 76 },
  'Leticia Sinay': { '2026-06-08': 5, '2026-06-15': 26, '2026-06-22': 23, '2026-06-29': 16, '2026-07-06': 24, '2026-07-13': 5, '2026-07-20': 36, '2026-07-27': 29, '2026-08-03': 13 },
  'Otros': { '2026-06-08': 56, '2026-06-15': 4, '2026-07-20': 15, '2026-07-27': 6 },
};

export const DIARIO = [
  ['2026-06-08', 20, 1], ['2026-06-09', 23, 2], ['2026-06-10', 4, 1], ['2026-06-13', 16, 4],
  ['2026-06-15', 21, 2], ['2026-06-16', 6, 1], ['2026-06-17', 6, 1], ['2026-06-18', 12, 3],
  ['2026-06-19', 11, 2], ['2026-06-22', 23, 2], ['2026-06-23', 16, 1], ['2026-06-24', 6, 1],
  ['2026-06-25', 21, 2], ['2026-06-30', 29, 1], ['2026-07-03', 8, 1], ['2026-07-04', 8, 1],
  ['2026-07-06', 8, 1], ['2026-07-07', 4, 1], ['2026-07-08', 8, 1], ['2026-07-09', 8, 1],
  ['2026-07-11', 40, 1], ['2026-07-13', 53, 3], ['2026-07-14', 7, 1], ['2026-07-15', 22, 2],
  ['2026-07-16', 26, 2], ['2026-07-17', 50, 2], ['2026-07-21', 92, 4], ['2026-07-22', 80, 3],
  ['2026-07-23', 37, 2], ['2026-07-24', 37, 3], ['2026-07-25', 9, 1], ['2026-07-27', 87, 3],
  ['2026-07-28', 23, 3], ['2026-07-29', 7, 1], ['2026-07-30', 123, 3], ['2026-07-31', 4, 1],
  ['2026-08-01', 21, 1], ['2026-08-03', 23, 2], ['2026-08-04', 37, 1], ['2026-08-05', 27, 1],
  ['2026-08-06', 11, 2], ['2026-08-07', 34, 2],
];

export const HORAS = [
  [8, 43], [9, 95], [10, 120], [11, 187], [12, 215], [13, 24], [14, 84],
  [15, 104], [16, 171], [17, 57], [18, 5], [19, 1], [20, 0], [21, 0], [22, 2],
];

export const ETAPAS = [
  { key: 'prospecto', label: 'Prospecto', deals: 93, valor: 76235, diasProm: 9.3 },
  { key: 'contactado', label: 'Contactado', deals: 7, valor: 25870, diasProm: 32.9 },
  { key: 'cotizacion', label: 'Cotización', deals: 37, valor: 397780, diasProm: 17.0 },
  { key: 'negociacion', label: 'En negociación', deals: 10, valor: 157595, diasProm: 28.0 },
  { key: 'ganado', label: 'Ganado', deals: 139, valor: 669812, diasProm: 22.1 },
  { key: 'perdido', label: 'Perdido', deals: 4, valor: 46020, diasProm: 12.2 },
];

export const CANALES = [
  { key: 'sala', label: 'Sala de ventas', deals: 160, valor: 890392, ganados: 112, pct: 70.0 },
  { key: 'whatsapp', label: 'WhatsApp', deals: 97, valor: 382190, ganados: 17, pct: 17.5 },
  { key: 'telefono', label: 'Teléfono', deals: 18, valor: 87985, ganados: 9, pct: 50.0 },
  { key: 'visita', label: 'Visita a cliente', deals: 15, valor: 12745, ganados: 1, pct: 6.7 },
];

export const TIEMPO_CIERRE = [
  { label: 'Menos de 5 min', sub: 'venta de mostrador', deals: 118 },
  { label: '5 a 60 min', sub: '', deals: 4 },
  { label: 'Mismo día (1–24 h)', sub: '', deals: 2 },
  { label: '1 a 7 días', sub: '', deals: 11 },
  { label: 'Más de 7 días', sub: 'venta consultiva', deals: 4 },
];

export const EQUIPOS = [
  { label: 'Bombas', n: 197, deals: 189 },
  { label: 'Otros', n: 88, deals: 88 },
  { label: 'Filtros', n: 19, deals: 18 },
  { label: 'Equipos de Piscina', n: 4, deals: 4 },
  { label: 'Saunas y Jacuzzis', n: 2, deals: 2 },
  { label: 'Filtros y Trat. de Agua', n: 1, deals: 1 },
  { label: 'Sistemas de Bombeo', n: 1, deals: 1 },
];

export const ANTIGUEDAD_ABIERTOS = [
  { label: '0–7 días', deals: 20, valor: 91785, estado: 'good' },
  { label: '8–14 días', deals: 101, valor: 345670, estado: 'good' },
  { label: '15–29 días', deals: 16, valor: 93595, estado: 'warning' },
  { label: '30+ días (frío)', deals: 10, valor: 126430, estado: 'critical' },
];

export const SEGUIMIENTOS = {
  total: 86, completados: 34, vencidosSinCerrar: 50, futuros: 2,
  sinNota: 79, desfasePromDias: 0.3,
};

export const CALIDAD = [
  { campo: 'Teléfono de contacto', faltantes: 0, total: 290, critico: false },
  { campo: 'Cliente vinculado', faltantes: 0, total: 290, critico: false },
  { campo: 'Canal de origen', faltantes: 0, total: 290, critico: false },
  { campo: 'Valor del negocio', faltantes: 87, total: 290, critico: true },
  { campo: 'Empresa', faltantes: 252, total: 290, critico: false },
  { campo: 'Correo electrónico', faltantes: 290, total: 290, critico: true },
];

export const CIERRES_MES = [
  { mes: 'Junio', cierres: 28, valor: 209925, parcial: false, dias: 22 },
  { mes: 'Julio', cierres: 87, valor: 376286, parcial: false, dias: 23 },
  { mes: 'Agosto', cierres: 26, valor: 87226, parcial: true, dias: 5 },
];

export const DOCUMENTOS = {
  dealsConCotizacion: 165,
  dealsConPago: 149,
  dealsConAmbos: 123,
  cotizAnuladas: 2,
  pagosAnulados: 1,
  adjuntos: 330,
  adjuntosMB: 37.8,
};

export const CARTERA = {
  clientesTotal: 273,
  clientesConDeal: 270,
  recurrentes: 19,
  nombresDuplicados: 1,
  telefonosDuplicados: 19,
  valorTotal: 1373312,
  top10pctValor: 731362.5,
  medianaValor: 3750,
  promedioValor: 6765.08,
  maxValor: 92970,
};
