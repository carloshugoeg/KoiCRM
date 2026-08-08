// Genera reporte.html a partir de data.mjs. Luego se imprime a PDF con Chromium.
//   node build.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as D from './data.mjs';
import {
  C, hBar, vBar, stacked100, lineArea, funnel, legend, heatTable, tintBlue,
  fmtInt, fmtQ, fmtQk, fmtPct, esc,
} from './charts.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'reporte.html');
const { META, TOTALES: T, OPERADORES: OPS, OPERADORES_INACTIVOS: OFF } = D;

// Ancho util de la caja de contenido (Letter - margenes) y de media columna.
const W = 684;
const W2 = 330;

const activos = OPS.filter((o) => o.acciones > 0);
const conDeals = OPS.filter((o) => o.deals > 0);
const top3 = activos.slice(0, 3);
const accTop3 = top3.reduce((a, o) => a + o.acciones, 0);
const pctTop3 = (accTop3 / T.acciones) * 100;
const huerfano = 70465 + 52500;

/* ============================================================ componentes */
const page = (n, title, body) => `
<section class="page" data-page="${n}">
  <header class="ph"><span>Reporte de uso · AquaXela</span><span>${esc(META.desde)} → ${esc(META.hasta)}</span></header>
  ${title ? `<h2 class="h2">${title}</h2>` : ''}
  ${body}
  <footer class="pf"><span>Koi CRM · Reporte estadístico de uso — AquaXela</span><span>${n}</span></footer>
</section>`;

const block = (title, sub, inner) => `
<div class="block">
  ${title ? `<h3 class="h3">${esc(title)}</h3>` : ''}
  ${sub ? `<p class="sub">${sub}</p>` : ''}
  ${inner}
</div>`;

const tile = (value, label, sub = '') => `
<div class="tile"><div class="tv">${value}</div><div class="tl">${esc(label)}</div>${sub ? `<div class="ts">${sub}</div>` : ''}</div>`;

const finding = (n, title, body, tone = '') => `
<div class="find ${tone}"><div class="fn">${n}</div><div><h4>${title}</h4><p>${body}</p></div></div>`;

const callout = (title, body, tone = 'info') => `<div class="callout ${tone}"><strong>${title}</strong> ${body}</div>`;

/* =============================================================== PORTADA */
const cover = `
<section class="page cover">
  <div class="cv-top">
    <div class="brandmark">KOI<span>CRM</span></div>
    <div class="cv-meta">Proyecto <b>${esc(META.proyecto)}</b> · tenant <b>${esc(META.slug)}</b></div>
  </div>
  <div class="cv-mid">
    <p class="cv-kick">Reporte estadístico de uso</p>
    <h1 class="cv-h1">AquaXela</h1>
    <p class="cv-sub">Dos meses de operación real en Koi CRM: qué se usó, quién lo usó,<br>qué resultados produjo y qué decisiones habilita.</p>
    <div class="cv-line"></div>
    <div class="cv-facts">
      <div><b>Ventana analizada</b><span>8 jun – 7 ago 2026 · ${META.diasCalendario} días</span></div>
      <div><b>Fecha de corte</b><span>${esc(META.corte)}</span></div>
      <div><b>Fuente</b><span>Base de producción, sin muestreo</span></div>
      <div><b>Alcance</b><span>${fmtInt(T.acciones)} acciones · ${fmtInt(T.negocios)} negocios</span></div>
    </div>
  </div>
  <div class="cv-strip">
    ${[[fmtInt(T.negocios), 'negocios'], [fmtQk(T.valorTotal), 'valor registrado'], [`${T.usuariosConActividad}/${T.usuariosConMembresia}`, 'usuarios activos'], [fmtPct((T.ganados / T.negocios) * 100, 1), 'tasa de cierre']]
    .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}
  </div>
</section>`;

/* ====================================================== 1 · RESUMEN */
const tiposIzq = D.ACCIONES_POR_TIPO.slice(0, 5);
const tiposDer = D.ACCIONES_POR_TIPO.slice(5);
const maxTipo = D.ACCIONES_POR_TIPO[0].n;

const p1 = page(1, 'Resumen ejecutivo', `
<p class="lead">En ${META.diasCalendario} días AquaXela registró <b>${fmtInt(T.acciones)} acciones</b> sobre <b>${fmtInt(T.negocios)} negocios</b> y <b>${fmtInt(T.clientes)} clientes</b>, con <b>${fmtQ(T.valorTotal)}</b> de valor comercial capturado. La app dejó de ser un piloto: hoy es el registro operativo de la sala de ventas. Pero el uso está concentrado en tres personas, y el seguimiento —lo que convierte un prospecto en venta— todavía no se adoptó.</p>

<div class="tiles t5">
  ${tile(fmtInt(T.acciones), 'acciones registradas', `${(T.acciones / META.diasConActividad).toFixed(0)} por día activo`)}
  ${tile(fmtInt(T.negocios), 'negocios creados', `${fmtInt(T.ganados)} ganados · ${fmtInt(T.abiertos)} abiertos`)}
  ${tile(fmtQ(T.valorGanado), 'valor ganado', `${fmtQ(T.valorAbierto)} aún en pipeline`)}
  ${tile(fmtPct((T.ganados / T.negocios) * 100, 1), 'tasa de cierre', `${fmtInt(T.perdidos)} perdidos declarados`)}
  ${tile(`${T.usuariosConActividad}`, 'operadores activos', `de ${T.usuariosConMembresia} con acceso`)}
</div>

<h3 class="h3">Los seis hallazgos que importan</h3>
<div class="finds">
  ${finding(1, 'La adopción es real y va en subida', `La actividad pasó de <b>~60 acciones por semana</b> en junio a <b>255–265</b> en las semanas del 20 y 27 de julio: un crecimiento de <b>4×</b>. No es un pico aislado, es una curva sostenida de ocho semanas.`, 'ok')}
  ${finding(2, 'Tres personas sostienen todo el sistema', `${top3.map((o) => esc(o.nombre)).join(', ')} concentran <b>${fmtInt(accTop3)} de ${fmtInt(T.acciones)} acciones (${fmtPct(pctTop3, 0)})</b>. Los otros siete usuarios con acceso suman ${fmtInt(T.acciones - accTop3)}. Si uno de los tres falta una semana, el dato se apaga.`, 'warn')}
  ${finding(3, 'Se usa como bitácora de venta, no como embudo', `<b>118 de los 139 negocios ganados (85%)</b> se cerraron en <b>menos de 5 minutos</b> desde que se crearon. Eso no es un ciclo de venta: es alguien registrando una venta de mostrador que ya ocurrió.`, 'warn')}
  ${finding(4, 'WhatsApp es el agujero de conversión', `<b>97 negocios (33% del volumen) y ${fmtQ(382190)}</b> entran por WhatsApp, pero sólo cierran <b>17.5%</b>. Sala de ventas cierra <b>70%</b>. Es la brecha más grande y la más accionable del reporte.`, 'bad')}
  ${finding(5, 'El seguimiento es la disciplina que falta', `De ${D.SEGUIMIENTOS.total} seguimientos agendados, <b>${D.SEGUIMIENTOS.vencidosSinCerrar} están vencidos sin cerrar (${fmtPct((D.SEGUIMIENTOS.vencidosSinCerrar / D.SEGUIMIENTOS.total) * 100, 0)})</b> y <b>${fmtPct((D.SEGUIMIENTOS.sinNota / D.SEGUIMIENTOS.total) * 100, 0)}</b> no tiene ni una nota. Un solo operador genera 8 de cada 10.`, 'bad')}
  ${finding(6, 'El valor comercial se captura a medias', `<b>87 negocios (30%)</b> se registraron con valor 0 — 80 de ellos de un mismo operador. El pipeline abierto real es mayor que los ${fmtQ(T.valorAbierto)} que hoy muestra el sistema.`, 'warn')}
</div>

<h3 class="h3 mt">Qué se registra: las ${fmtInt(T.acciones)} acciones por tipo</h3>
<div class="cols2 tight">
  ${hBar({ rows: tiposIzq.map((t) => ({ label: t.label, value: t.n })), width: W2, labelW: 132, valueW: 40, barH: 11, gap: 7, max: maxTipo })}
  ${hBar({ rows: tiposDer.map((t) => ({ label: t.label, value: t.n })), width: W2, labelW: 132, valueW: 40, barH: 11, gap: 7, max: maxTipo, color: C.seq[5] })}
</div>
`);

/* ====================================================== 2 · ADOPCIÓN */
const semLabels = D.SEMANAS.map((s) => s.label);
const p2 = page(2, 'Adopción: la app entró en la rutina', `
<p class="lead">La pregunta de fondo de cualquier CRM recién implantado es si la gente lo abre sin que se lo pidan. Aquí la respuesta es sí, con una inflexión clara a mediados de julio.</p>

${block('Actividad semanal registrada', 'Cada punto es una semana completa. La última cubre sólo 5 días (3–7 ago), por eso baja.',
  lineArea({
    labels: semLabels,
    series: [{ key: 'acc', color: C.s1, area: true, values: D.SEMANAS.map((s) => s.acciones) }],
    markLast: [{ si: 0, i: 0, dy: -13 }, { si: 0, i: 6, dy: -13 }, { si: 0, i: 7, dy: -13 }, { si: 0, i: 8, dy: -13 }],
    partialFrom: 8, width: W, height: 196,
  }) + callout('Lectura.', 'El salto del 13 de julio coincide exactamente con la entrada de Julio Armas al sistema. Un solo operador nuevo, bien onboardeado, duplicó el volumen registrado de toda la operación.'))}

<div class="cols2">
  ${block('Operadores activos por semana', 'Personas distintas con al menos una acción.',
    vBar({
      rows: D.SEMANAS.map((s) => ({ label: s.label, value: s.usuarios, color: s.parcial ? C.s3 : C.s1 })),
      width: W2, height: 152, yTicks: 5, valueSize: 9, labelEvery: 2,
    }))}
  ${block('Hora del día (GMT-6)', 'Total de acciones por hora.',
    vBar({
      rows: D.HORAS.map(([h, n]) => ({ label: h % 2 === 0 ? `${h}h` : '', value: n, color: n >= 150 ? C.s2 : C.s1 })),
      width: W2, height: 152, yTicks: 4, showValues: false,
    }))}
</div>
<p class="micro"><b>Doble pico de jornada:</b> las horas 11–13 concentran el 36% de toda la actividad y 16–17 otro 21%. La caída de las 13 h es el almuerzo. Fuera de 8–18 h casi no hay uso: es una herramienta de escritorio en horario de tienda, no de campo.</p>

${block('Ritmo diario', `${D.DIARIO.length} días con actividad de ${META.diasCalendario} de calendario. Los huecos son fines de semana y feriados.`,
  vBar({
    rows: D.DIARIO.map(([d, n], i) => ({ label: i % 5 === 0 ? d.slice(5).replace('-', '/') : '', value: n, color: n >= 80 ? C.s2 : C.s1 })),
    width: W, height: 138, yTicks: 3, showValues: false,
  }) + `<p class="micro"><b>Pico absoluto:</b> 30 de julio, 123 acciones con 3 operadores en simultáneo. <b>Cero uso en fin de semana</b> durante las nueve semanas analizadas.</p>`)}
`);

/* ================================================== 3 · USO POR OPERADOR */
const mixSeries = [
  { key: 'alta', label: 'Alta de negocio', color: C.s1 },
  { key: 'etapa', label: 'Movimiento de etapa', color: C.s2 },
  { key: 'cotiz', label: 'Cotización', color: C.s3 },
  { key: 'pago', label: 'Pago / factura', color: C.s4 },
  { key: 'seg', label: 'Seguimiento y notas', color: C.s5 },
];
const mixRow = (o) => ({
  label: o.corto,
  values: {
    alta: o.mix.created || 0,
    etapa: (o.mix.stageChanged || 0) + (o.mix.valueChanged || 0) + (o.mix.ownerChanged || 0),
    cotiz: o.mix.quoteAdded || 0,
    pago: o.mix.paymentAdded || 0,
    seg: (o.mix.followUpAdded || 0) + (o.mix.followUpCompleted || 0) + (o.mix.noteAdded || 0),
  },
});

const p3 = page(3, 'Uso por operador', `
<p class="lead">Quién usa la app, cuánto y para qué. La distinción importa: no es lo mismo un operador que sólo da de alta negocios que uno que recorre todo el proceso.</p>

${block('Volumen de acciones', 'Total de eventos registrados en la ventana.',
  hBar({
    rows: activos.map((o, i) => ({
      label: o.corto, sub: o.rol.toLowerCase(), value: o.acciones,
      note: `${fmtPct((o.acciones / T.acciones) * 100, 1)} del total`,
      color: i < 3 ? C.s1 : C.seq[3], bold: i < 3,
    })),
    width: W, labelW: 118, valueW: 106, barH: 15, gap: 14,
  }))}

${block('Composición del uso', 'Qué proporción de las acciones de cada persona corresponde a cada tipo de tarea. Barras normalizadas al 100%.',
  legend(mixSeries) + stacked100({ rows: activos.slice(0, 5).map(mixRow), series: mixSeries, width: W, labelW: 92, barH: 20, gap: 10 })
  + `<p class="micro"><b>Tres perfiles distintos.</b> <b>Roberto Yax</b> es el único que ejerce el proceso completo: 21% de sus acciones son seguimiento y notas. <b>Julio Armas</b> es un capturador: 40% de lo que hace es dar de alta negocios y apenas 11% es seguimiento. <b>Leticia Sinay</b> es cierre puro: mueve etapas y sube pagos, y casi nunca agenda un seguimiento (1 en 42 negocios).</p>`)}

${block('Perfil de cada operador', '',
  heatTable({
    head: ['Operador', 'Rol', 'Acciones', 'Días activos', 'Acc./día', 'Primer uso', 'Último uso'],
    rows: activos.map((o) => ({
      cells: [
        { v: o.nombre },
        { v: o.rol },
        { v: fmtInt(o.acciones), pct: (o.acciones / activos[0].acciones) * 100 },
        { v: fmtInt(o.diasActivos), pct: (o.diasActivos / 24) * 100 },
        { v: (o.acciones / o.diasActivos).toFixed(1) },
        { v: o.primerDia.slice(5) },
        { v: o.ultimoDia.slice(5) },
      ],
    })),
    tint: tintBlue,
    leftCols: [1],
  })
  + `<p class="micro">La constancia importa tanto como el volumen: <b>Roberto Yax y Leticia Sinay abrieron la app 24 días distintos</b> cada uno, pero Roberto hace tres veces más por día. <b>Julio Armas llegó el 13 de julio</b> y en 16 días ya es el segundo usuario del sistema. Los cuatro restantes entraron cinco días o menos: no llegaron a incorporarlo a su rutina.</p>`)}
`);

/* ============================================== 4 · RESULTADOS POR OPERADOR */
const p4 = page(4, 'Resultados por operador', `
<p class="lead">Actividad no es resultado. Este es el cruce entre cuánto trabaja cada quien dentro de la app y qué produce esa actividad.</p>

<div class="cols2">
  ${block('Negocios ganados', 'Cerrados en la ventana.',
    hBar({
      rows: conDeals.filter((o) => o.ganados > 0).map((o) => ({ label: o.corto, value: o.ganados, note: `de ${o.deals}` })),
      width: W2, labelW: 82, valueW: 68, barH: 15, gap: 15, color: C.s3,
    }))}
  ${block('Tasa de cierre', 'Ganados sobre negocios asignados.',
    hBar({
      rows: conDeals.filter((o) => o.deals >= 5).map((o) => ({
        label: o.corto, value: o.tasaGanado,
        color: o.tasaGanado >= 60 ? C.s3 : o.tasaGanado >= 30 ? C.s4 : C.s2,
      })),
      width: W2, labelW: 82, valueW: 60, barH: 15, gap: 15, max: 100, fmt: (v) => fmtPct(v, 1),
    }))}
</div>

${block('Valor comercial: ganado frente a lo que sigue abierto', 'Suma del campo valor de cada negocio, por dueño.',
  hBar({
    rows: conDeals.map((o) => ({
      label: o.corto, value: o.valorGanado,
      sub: o.valorAbierto > 0 ? `abierto ${fmtQk(o.valorAbierto)}` : '',
      color: C.s3,
    })),
    width: W, labelW: 118, valueW: 96, barH: 15, gap: 17, fmt: fmtQ,
    footer: 'Barra = valor ganado. El monto que sigue abierto se anota bajo cada nombre.',
  })
  + `<p class="micro"><b>Roberto Yax genera el 82% del valor ganado</b> (${fmtQ(551338.5)} de ${fmtQ(T.valorGanado)}) con un ticket promedio de ${fmtQ(7876)}: cuatro veces el de sus compañeros. No vende más veces que Leticia en proporción, vende <i>más grande</i>. Julio Armas produce el mayor volumen de negocios (131) y el menor valor por negocio — y 80 de sus 131 están registrados con valor 0, así que su cifra real es desconocida.</p>`)}

${block('Higiene del proceso por operador', 'Porcentaje de los negocios de cada quien que tienen el artefacto correspondiente. Celda más oscura = mejor cobertura.',
  heatTable({
    head: ['Operador', 'Negocios', 'Con cotización', 'Con pago', 'Con seguimiento', 'Con nota', 'Con adjunto'],
    rows: conDeals.map((o) => {
      const p = (x) => (o.deals ? (x / o.deals) * 100 : 0);
      return {
        cells: [
          { v: o.nombre },
          { v: fmtInt(o.deals) },
          { v: fmtPct(p(o.conCotizacion)), pct: p(o.conCotizacion) },
          { v: fmtPct(p(o.conPago)), pct: p(o.conPago) },
          { v: fmtPct(p(o.conSeguimiento)), pct: p(o.conSeguimiento) },
          { v: fmtPct(p(o.conNota)), pct: p(o.conNota) },
          { v: fmtPct(p(o.conAdjunto)), pct: p(o.conAdjunto) },
        ],
      };
    }),
    tint: tintBlue,
  })
  + `<p class="micro">La columna <b>Con seguimiento</b> es la que separa al equipo: Roberto la usa en 64% de sus negocios y cierra 67%. Leticia la usa en 2% y cierra 88%, porque sus ventas son de mostrador y no necesitan seguimiento. Julio la usa en 7% con 76% de sus negocios aún abiertos: <b>ahí hay pipeline sin gestionar.</b></p>`)}

${callout('Tres accesos sin estrenar.', `<b>${OFF.map((o) => esc(o.nombre)).join(', ')}</b> tienen membresía activa y <b>cero acciones</b> en dos meses. Entre Jonathan y Emanuel hay <b>${fmtQ(huerfano)}</b> en negocios asignados que nadie está trabajando. El rol <b>SUPERVISOR</b> de Nancy Pérez nunca se ejerció: hoy nadie mira el tablero de equipo.`, 'bad')}
`);

/* ================================================ 5 · EMBUDO Y CANALES */
const stageColors = [C.seq[3], C.seq[4], C.seq[6], C.seq[7], C.good, C.critical];
const p5 = page(5, 'Embudo, canales y velocidad', `
<p class="lead">Cómo se mueve el negocio dentro de la app y por dónde entra.</p>

${block('Estado del embudo al corte', `Los ${fmtInt(T.negocios)} negocios distribuidos por etapa. "Días" es el tiempo promedio que llevan parados ahí.`,
  funnel({
    stages: D.ETAPAS.map((e, i) => ({
      label: e.label, deals: e.deals, valor: e.valor, color: stageColors[i],
      sub: e.key === 'ganado' || e.key === 'perdido' ? 'etapa terminal' : `${e.diasProm} días promedio`,
      right: fmtPct((e.deals / T.negocios) * 100, 1) + ' del total',
    })),
    width: W, rowH: 30, gap: 5,
  })
  + callout('Alerta de embudo.', `<b>Contactado</b> (7 negocios) lleva <b>32.9 días</b> parado en promedio y <b>En negociación</b> (10 negocios, ${fmtQ(157595)}) lleva <b>28 días</b>. Son las dos etapas donde el negocio se muere en silencio.`, 'bad'))}

<div class="cols2">
  ${block('Canal de origen', 'Negocios por canal de entrada.',
    hBar({
      rows: D.CANALES.map((c) => ({ label: c.label, value: c.deals, note: fmtQk(c.valor) })),
      width: W2, labelW: 96, valueW: 76, barH: 14, gap: 14, color: C.s1,
    }))}
  ${block('Tasa de cierre por canal', 'Ganados sobre entrados.',
    hBar({
      rows: D.CANALES.map((c) => ({
        label: c.label, value: c.pct,
        color: c.pct >= 60 ? C.s3 : c.pct >= 30 ? C.s4 : C.critical,
      })),
      width: W2, labelW: 96, valueW: 56, barH: 14, gap: 14, max: 100, fmt: (v) => fmtPct(v, 1),
    }))}
</div>

${callout('El hallazgo comercial del reporte.', `WhatsApp trae <b>97 negocios y ${fmtQ(382190)}</b> —un tercio del volumen— y convierte a <b>17.5%</b>; sala de ventas convierte a <b>70%</b>. Si WhatsApp llegara siquiera a la mitad de la tasa de sala serían <b>~17 cierres adicionales</b> sobre la cartera actual. La diferencia no es el producto: el cliente de sala ya está frente al vendedor, y el de WhatsApp necesita un seguimiento que hoy casi no se agenda.`, 'bad')}

${block('Tiempo entre crear el negocio y cerrarlo', `Sobre los ${fmtInt(T.ganados)} negocios ganados.`,
  hBar({
    rows: D.TIEMPO_CIERRE.map((t) => ({
      label: t.label, sub: t.sub, value: t.deals,
      note: fmtPct((t.deals / T.ganados) * 100, 1),
      color: t.label === 'Menos de 5 min' ? C.s2 : C.s1,
    })),
    width: W, labelW: 148, valueW: 92, barH: 15, gap: 14,
  })
  + `<p class="micro">Esto redefine qué es hoy Koi CRM para AquaXela: <b>en 85% de los casos es un libro de ventas digital</b>, no un gestor de oportunidades. Es un uso legítimo y valioso —da trazabilidad, documentos y comisiones auditables— pero significa que <b>toda la capacidad de embudo del producto sirve sólo al 15% restante</b>, que es justamente el negocio de mayor ticket.</p>`)}
`);

/* ============================================== 6 · CALIDAD DEL DATO */
const p6 = page(6, 'Calidad del dato y trazabilidad', `
<p class="lead">La data sólo sirve para decidir si es confiable. Estas son las grietas del registro y lo que, pese a ellas, ya se puede explotar.</p>

<div class="cols2">
  ${block('Campos vacíos sobre 290 negocios', 'Porcentaje sin dato.',
    hBar({
      rows: D.CALIDAD.map((c) => ({
        label: c.campo, value: (c.faltantes / c.total) * 100,
        note: `${fmtInt(c.faltantes)} neg.`,
        color: c.faltantes === 0 ? C.s3 : c.critico ? C.critical : C.s4,
      })),
      width: W2, labelW: 108, valueW: 72, barH: 14, gap: 13, max: 100, fmt: (v) => fmtPct(v),
    }))}
  ${block('Antigüedad del pipeline abierto', `${fmtInt(T.abiertos)} negocios sin cerrar, por días sin ninguna acción.`,
    hBar({
      rows: D.ANTIGUEDAD_ABIERTOS.map((a) => ({
        label: a.label, value: a.deals, note: fmtQk(a.valor),
        color: a.estado === 'good' ? C.s3 : a.estado === 'warning' ? C.s4 : C.critical,
      })),
      width: W2, labelW: 96, valueW: 72, barH: 14, gap: 13,
    }))}
</div>

${callout('Dos datos que se arreglan en producto, no en capacitación.', `<b>Correo electrónico: 290 de 290 negocios vacíos.</b> El campo existe, nadie lo llena, y sin él no hay campaña de email posible: o se vuelve obligatorio en el alta, o se retira del formulario. <b>Valor: 87 negocios en cero</b>, el 30%. Mientras el valor sea opcional y manual, ningún pronóstico que salga del sistema es defendible.`, 'bad')}

<div class="cols2">
  ${block('Documentos y trazabilidad', '',
    `<div class="mini">
      ${[[fmtInt(D.DOCUMENTOS.dealsConCotizacion), 'negocios con cotización'],
        [fmtInt(D.DOCUMENTOS.dealsConPago), 'negocios con pago'],
        [fmtPct((D.DOCUMENTOS.dealsConAmbos / D.DOCUMENTOS.dealsConCotizacion) * 100, 1), 'de las cotizaciones terminan en pago'],
        [`${D.DOCUMENTOS.adjuntosMB} MB`, `${fmtInt(D.DOCUMENTOS.adjuntos)} archivos respaldados`]]
      .map(([v, l]) => `<div><b>${v}</b><span>${esc(l)}</span></div>`).join('')}
    </div>`)}
  ${block('Seguimientos agendados', `${D.SEGUIMIENTOS.total} en total.`,
    hBar({
      rows: [
        { label: 'Vencidos sin cerrar', value: D.SEGUIMIENTOS.vencidosSinCerrar, color: C.critical },
        { label: 'Completados', value: D.SEGUIMIENTOS.completados, color: C.s3 },
        { label: 'Futuros', value: D.SEGUIMIENTOS.futuros, color: C.s1 },
        { label: 'Sin nota escrita', value: D.SEGUIMIENTOS.sinNota, color: C.s4 },
      ].map((r) => ({ ...r, note: fmtPct((r.value / D.SEGUIMIENTOS.total) * 100, 0) })),
      width: W2, labelW: 106, valueW: 62, barH: 14, gap: 14,
    }))}
</div>
<p class="micro">Sólo <b>${D.DOCUMENTOS.cotizAnuladas} cotizaciones y ${D.DOCUMENTOS.pagosAnulados} pago</b> anulados en dos meses: el registro documental es limpio y auditable. Existen <b>26 pagos sin cotización previa</b> en el sistema, coherente con la venta de mostrador. Del lado del seguimiento la foto es la contraria: <b>${D.SEGUIMIENTOS.sinNota} de ${D.SEGUIMIENTOS.total} compromisos no tienen ni una línea escrita</b>, así que ni el supervisor ni un compañero que reciba la cartera saben qué se le prometió al cliente.</p>

${block('Cartera de clientes y concentración de valor', '',
  heatTable({
    head: ['Indicador', 'Valor', 'Qué significa'],
    rows: [
      { cells: [{ v: 'Clientes registrados' }, { v: fmtInt(D.CARTERA.clientesTotal) }, { v: `${fmtInt(D.CARTERA.clientesConDeal)} tienen al menos un negocio` }] },
      { cells: [{ v: 'Clientes recurrentes' }, { v: fmtInt(D.CARTERA.recurrentes) }, { v: `sólo ${fmtPct((D.CARTERA.recurrentes / D.CARTERA.clientesTotal) * 100, 1)} recompró: hay base para postventa` }] },
      { cells: [{ v: 'Teléfonos duplicados' }, { v: fmtInt(D.CARTERA.telefonosDuplicados) }, { v: 'mismo cliente cargado dos veces; requiere deduplicación' }] },
      { cells: [{ v: 'Ticket mediano' }, { v: fmtQ(D.CARTERA.medianaValor) }, { v: `contra un promedio de ${fmtQ(D.CARTERA.promedioValor)}: la cola larga pesa` }] },
      { cells: [{ v: 'Concentración' }, { v: fmtPct((D.CARTERA.top10pctValor / D.CARTERA.valorTotal) * 100, 1) }, { v: 'del valor está en el 10% de negocios más grandes' }] },
      { cells: [{ v: 'Negocio mayor' }, { v: fmtQ(D.CARTERA.maxValor) }, { v: 'techo actual de ticket registrado' }] },
    ],
  }))}
`);

/* ============================================== 7 · DEMANDA */
const p7 = page(7, 'Qué vende AquaXela, según su propia data', `
<p class="lead">El CRM no sólo mide al equipo: también describe la demanda. Estas tres lecturas salen de campos que ya se llenan hoy.</p>

${block('Categoría de equipo declarada en el negocio', `Sobre los ${fmtInt(T.negocios)} negocios registrados.`,
  hBar({
    rows: D.EQUIPOS.map((e) => ({
      label: e.label, value: e.deals, note: fmtPct((e.deals / T.negocios) * 100, 1),
      color: e.label === 'Otros' ? C.s2 : C.s1,
    })),
    width: W, labelW: 152, valueW: 84, barH: 14, gap: 12,
  })
  + `<p class="micro"><b>Bombas es el 65% del negocio</b>: el catálogo, el inventario y el material de venta deberían estar construidos alrededor de eso. Pero <b>"Otros" aparece en 88 negocios (30%)</b>: casi un tercio de lo que AquaXela vende no cabe en las categorías configuradas. Ese 30% no es misceláneo, es catálogo faltante — y mientras siga ahí, ningún análisis de producto es posible.</p>`)}

<div class="cols2">
  ${block('Valor por canal de entrada', 'Suma del valor de los negocios de cada canal.',
    hBar({
      rows: D.CANALES.map((c) => ({ label: c.label, value: c.valor, note: `${c.deals} neg.` })),
      width: W2, labelW: 96, valueW: 76, barH: 14, gap: 14, fmt: fmtQk, color: C.s1,
    }))}
  ${block('Cierres por mes', 'Negocios movidos a Ganado.',
    vBar({
      rows: D.CIERRES_MES.map((m) => ({
        label: m.mes, sub: m.parcial ? `${m.dias} días` : '', value: m.cierres,
        color: m.parcial ? C.s3 : C.s1,
      })),
      width: W2, height: 150, yTicks: 4,
    }))}
</div>
<p class="micro"><b>Julio fue el mejor mes:</b> 87 cierres por ${fmtQ(376286)} contra 28 por ${fmtQ(209925)} en junio. Agosto lleva 26 cierres en apenas 5 días hábiles, un ritmo consistente con julio. <b>Sala de ventas concentra ${fmtPct((890392 / T.valorTotal) * 100, 0)} del valor</b> pese a ser el 55% de los negocios: es el canal que trae los tickets grandes, y también el único con una tasa de cierre sana.</p>

${block('Concentración del valor', '',
  `<div class="mini m4">
    ${[[fmtQ(D.CARTERA.medianaValor), 'ticket mediano'],
      [fmtQ(D.CARTERA.promedioValor), 'ticket promedio'],
      [fmtPct((D.CARTERA.top10pctValor / D.CARTERA.valorTotal) * 100, 1), 'del valor en el 10% mayor'],
      [fmtQ(D.CARTERA.maxValor), 'negocio más grande']]
    .map(([v, l]) => `<div><b>${v}</b><span>${esc(l)}</span></div>`).join('')}
  </div>
  <p class="micro">La distancia entre mediana (${fmtQ(D.CARTERA.medianaValor)}) y promedio (${fmtQ(D.CARTERA.promedioValor)}) dice que AquaXela son <b>dos negocios distintos dentro de la misma empresa</b>: un mostrador de alto volumen y ticket bajo, y un puñado de proyectos grandes que aportan la mitad del valor. Hoy ambos se gestionan con el mismo flujo, las mismas metas y el mismo nivel de seguimiento. Separarlos —en precio, en atención y en el propio producto— es probablemente la decisión de mayor impacto que habilita este reporte.</p>`)}

${callout('Las tres lecturas de esta página, juntas.', 'El mostrador vende bombas y cierra solo; el proyecto grande entra por WhatsApp o por visita, tarda semanas y hoy nadie lo persigue. Un tercio de lo que se vende ni siquiera tiene categoría en el catálogo, así que la data de producto está incompleta justo donde hay que decidir inventario. Arreglar el catálogo y separar los dos flujos de venta son requisitos previos a cualquier estrategia comercial basada en estos números.')}
`);

/* ============================================ 8 · QUÉ HACER CON LA DATA */
const useBlock = (n, title, items, tone) => `
<div class="use ${tone}">
  <div class="use-h"><span class="un">${n}</span><h4>${title}</h4></div>
  <ul>${items.map((i) => `<li><b>${i[0]}</b> ${i[1]}</li>`).join('')}</ul>
</div>`;

const p8 = page(8, 'En qué se puede usar esta data', `
<p class="lead">Todo lo anterior es diagnóstico. Esto es lo que la misma base ya permite hacer, ordenado por qué tan rápido produce retorno.</p>

<div class="uses">
${useBlock('A', 'Acción comercial esta semana — no requiere desarrollo', [
  ['Cola de rescate WhatsApp.', `80 negocios entraron por WhatsApp y no cerraron. Es una lista nominal, con teléfono, que se puede llamar mañana; a la tasa de sala valen ~${fmtQ(200000)} en oportunidad.`],
  ['Rescate de negocios fríos.', `10 negocios por ${fmtQ(126430)} llevan más de 30 días sin una sola acción: 7 de Roberto Yax, 2 de Jimena Álvarez, 1 de Emanuel Fuentes.`],
  ['Barrido de seguimientos vencidos.', '50 compromisos con el cliente vencidos y sin cerrar. Cada uno es una promesa de contacto que el sistema ya tiene registrada.'],
  ['Reasignar cartera huérfana.', `${fmtQ(huerfano)} en negocios asignados a dos personas que no han entrado a la app en dos meses.`],
], 'now')}

${useBlock('B', 'Gestión del equipo — con números en lugar de percepción', [
  ['Comisiones auditables.', 'Valor ganado por operador, con cotización y pago adjuntos como respaldo. Ya es defendible ante el vendedor.'],
  ['Coaching diferenciado.', 'Julio Armas captura mucho y cierra poco: le falta seguimiento. Leticia Sinay cierra casi todo lo que toca pero no documenta valor: le falta disciplina de registro. Roberto Yax es el modelo a replicar.'],
  ['Metas por perfil de venta.', `Con ticket promedio real por persona (${fmtQ(7876)} contra ${fmtQ(1389)}) las metas dejan de ser una cifra plana para todos.`],
  ['Activar el rol SUPERVISOR.', 'Existe, está asignado y nunca se usó. Sin él nadie revisa el embudo salvo el dueño.'],
], 'team')}

${useBlock('C', 'Pronóstico y planeación', [
  ['Run rate de cierre.', `Julio cerró 87 negocios por ${fmtQ(376286)}; junio, 28 por ${fmtQ(209925)}. Con dos meses ya hay base para proyectar y detectar desviación semanal.`],
  ['Pipeline ponderado por etapa.', `Cotización (${fmtQ(397780)}) y Negociación (${fmtQ(157595)}) concentran el valor abierto. Ponderado por la probabilidad histórica de cada etapa sale un pronóstico, no un deseo.`],
  ['Staffing por hora.', 'El 36% de la actividad ocurre entre 11 y 13 h: ahí debe haber más gente en sala y ahí conviene lanzar las campañas de WhatsApp.'],
  ['Estacionalidad.', 'Dos meses son insuficientes para medirla. A partir del cuarto mes esta misma consulta la produce sin trabajo adicional.'],
], 'plan')}

${useBlock('D', 'Producto: qué cambiar en Koi CRM', [
  ['Modo "venta rápida".', 'Si 85% de los cierres ocurren en menos de 5 minutos, forzar 6 etapas es fricción. Un alta-y-cierre en una pantalla, con el embudo completo reservado al negocio consultivo.'],
  ['Valor obligatorio o derivado.', 'Tomarlo del monto de la cotización adjunta elimina de raíz los 87 negocios en cero.'],
  ['Recordatorio activo de seguimiento.', '58% de vencidos sin cerrar es un problema de notificación, no de voluntad: aviso al operador y tablero de vencidos para el supervisor.'],
  ['Quitar o exigir el correo, y abrir el catálogo.', 'Cero de 290 en email es ruido en el formulario; "Otros" en 30% de los negocios significa que las categorías no reflejan lo que se vende.'],
], 'prod')}

${useBlock('E', 'Ingresos nuevos con la data ya capturada', [
  ['Postventa y mantenimiento.', `Sólo ${fmtPct((D.CARTERA.recurrentes / D.CARTERA.clientesTotal) * 100, 1)} de los clientes recompró. 189 compraron una bomba con fecha conocida: eso es una campaña de mantenimiento programada, no una promoción a ciegas.`],
  ['Cross-sell por categoría y deduplicación.', 'Quien compró bomba y no filtro es una lista concreta hoy; los 19 teléfonos repetidos hay que limpiarlos antes de cualquier campaña.'],
  ['Precio por segmento.', `Con una mediana de ${fmtQ(D.CARTERA.medianaValor)} y el 53% del valor en el 10% de negocios más grandes, la política de precio del proyecto grande no debería ser la misma que la del mostrador.`],
], 'rev')}
</div>
`);

/* ============================================== 9 · MÉTRICAS PERMANENTES */
const p9 = page(9, 'Panel de control sugerido', `
<p class="lead">Estas doce métricas salen todas de la base actual sin cambiar el modelo de datos. Son las que conviene dejar fijas en un tablero para no volver a construir este reporte a mano.</p>

${heatTable({
  head: ['Métrica', 'Hoy', 'Frecuencia', 'Para qué sirve'],
  rows: [
    { cells: [{ v: 'Operadores activos en la semana' }, { v: '3' }, { v: 'Semanal' }, { v: 'Detectar abandono antes de que se vuelva crónico' }] },
    { cells: [{ v: 'Acciones por operador activo' }, { v: '~44' }, { v: 'Semanal' }, { v: 'Medir profundidad de uso, no sólo login' }] },
    { cells: [{ v: 'Negocios creados' }, { v: '40 / sem' }, { v: 'Semanal' }, { v: 'Volumen de entrada de demanda' }] },
    { cells: [{ v: 'Tasa de cierre global' }, { v: fmtPct((T.ganados / T.negocios) * 100, 1) }, { v: 'Mensual' }, { v: 'Salud comercial de punta a punta' }] },
    { cells: [{ v: 'Tasa de cierre por canal' }, { v: '6.7 – 70%' }, { v: 'Mensual' }, { v: 'Dónde invertir el esfuerzo de marketing' }] },
    { cells: [{ v: 'Valor ganado' }, { v: fmtQ(T.valorGanado) }, { v: 'Mensual' }, { v: 'Comisiones y cumplimiento de meta' }] },
    { cells: [{ v: 'Pipeline abierto ponderado' }, { v: fmtQ(T.valorAbierto) }, { v: 'Semanal' }, { v: 'Pronóstico del mes en curso' }] },
    { cells: [{ v: 'Negocios sin tocar 30+ días' }, { v: '10' }, { v: 'Semanal' }, { v: 'Cola de rescate: la métrica de mayor retorno' }] },
    { cells: [{ v: 'Seguimientos vencidos sin cerrar' }, { v: fmtInt(D.SEGUIMIENTOS.vencidosSinCerrar) }, { v: 'Diaria' }, { v: 'Promesas al cliente que se están incumpliendo' }] },
    { cells: [{ v: '% negocios con valor capturado' }, { v: fmtPct(100 - (87 / 290) * 100, 0) }, { v: 'Semanal' }, { v: 'Confiabilidad de todo lo demás' }] },
    { cells: [{ v: '% cotizaciones que llegan a pago' }, { v: fmtPct((D.DOCUMENTOS.dealsConAmbos / D.DOCUMENTOS.dealsConCotizacion) * 100, 1) }, { v: 'Mensual' }, { v: 'Efectividad real de la cotización' }] },
    { cells: [{ v: 'Clientes con recompra' }, { v: fmtInt(D.CARTERA.recurrentes) }, { v: 'Mensual' }, { v: 'Valor de vida del cliente y postventa' }] },
  ],
})}

<h3 class="h3 mt">Prioridad de los próximos 30 días</h3>
<div class="prio">
  <div class="pr p1"><span>1</span><div><b>Cola de rescate WhatsApp y negocios fríos.</b> Cero desarrollo, lista lista para llamar, el mayor retorno inmediato del reporte.</div></div>
  <div class="pr p2"><span>2</span><div><b>Arreglar la captura de valor.</b> Mientras 30% de los negocios valga cero, ningún pronóstico es sostenible frente a gerencia.</div></div>
  <div class="pr p3"><span>3</span><div><b>Notificación de seguimiento vencido.</b> Ataca a la vez los 50 compromisos abiertos y la brecha de conversión de WhatsApp.</div></div>
  <div class="pr p4"><span>4</span><div><b>Activar supervisión y reasignar cartera huérfana.</b> ${fmtQ(huerfano)} parados en usuarios que no entran a la app.</div></div>
  <div class="pr p5"><span>5</span><div><b>Modo venta rápida y catálogo ampliado.</b> Alinea el producto con el uso real: bitácora ágil para el 85%, embudo completo para el 15% de mayor ticket.</div></div>
</div>

<div class="method">
  <h4>Nota metodológica</h4>
  <p>Fuente: base de datos de producción <b>${esc(META.proyecto)}</b>, tenant <b>${esc(META.slug)}</b>, consultada el ${esc(META.corte)}. Se analizó la totalidad de los registros del tenant, sin muestreo. La ventana de actividad va del ${esc(META.desde)} al ${esc(META.hasta)}; la semana del 3 de agosto es parcial (5 días) y está marcada como tal en las gráficas. Las horas se convirtieron a GMT-6. "Acción" es todo evento del registro de actividad de la aplicación: alta, cambio de etapa, cotización, pago, seguimiento, nota, cambio de valor, reasignación y eliminación. Los importes provienen del campo de valor de cada negocio tal como lo capturó el operador; donde ese campo está en cero, el valor real es desconocido y no se imputó. Las tasas de cierre se calculan sobre negocios asignados, no sobre negocios trabajados. El tiempo a cierre se mide entre la creación del negocio y el primer movimiento a la etapa Ganado.</p>
</div>
`);

/* ==================================================================== CSS */
const css = `
@page { size: Letter; margin: 0; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0; background: ${C.plane}; color: ${C.ink};
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 11px; line-height: 1.5;
}
.page {
  position: relative; width: 8.5in; height: 11in; padding: 0.6in 0.66in 0.5in;
  background: ${C.surface}; margin: 0 auto; overflow: hidden;
  page-break-after: always; break-after: page;
}
.page:last-child { page-break-after: auto; break-after: auto; }

/* portada */
.cover { background: #0f1a26; color: #fff; padding: 0.72in 0.72in 0.55in;
         display: flex; flex-direction: column; justify-content: space-between; }
.cv-top { display: flex; justify-content: space-between; align-items: baseline; flex: none; }
.brandmark { font-size: 17px; font-weight: 800; letter-spacing: .16em; color: #fff; }
.brandmark span { color: ${C.s1}; margin-left: 2px; }
.cv-meta { font-size: 10px; color: #93a3b3; }
.cv-meta b { color: #d5dee6; font-weight: 600; }
.cv-mid { flex: none; padding: 0.5in 0; }
.cv-kick { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: ${C.s1}; font-weight: 700; margin: 0 0 6px; }
.cv-h1 { font-size: 70px; line-height: 1; margin: 0 0 16px; font-weight: 800; letter-spacing: -.03em; }
.cv-sub { font-size: 14.5px; line-height: 1.6; color: #b9c6d2; margin: 0 0 24px; max-width: 5.6in; }
.cv-line { height: 3px; width: 74px; background: ${C.s1}; margin-bottom: 24px; }
.cv-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 34px; max-width: 6.1in; }
.cv-facts b { display: block; font-size: 9px; letter-spacing: .13em; text-transform: uppercase; color: #7d8fa1; margin-bottom: 3px; font-weight: 700; }
.cv-facts span { font-size: 12.5px; color: #e4ecf3; }
.cv-strip { flex: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
            background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.14); }
.cv-strip > div { background: #0f1a26; padding: 14px 14px 13px; }
.cv-strip b { display: block; font-size: 24px; font-weight: 750; letter-spacing: -.02em; color: #fff; line-height: 1.15; }
.cv-strip span { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: #93a3b3; }

/* chrome de pagina */
.ph { display: flex; justify-content: space-between; font-size: 8.5px; letter-spacing: .1em; text-transform: uppercase;
      color: ${C.muted}; padding-bottom: 6px; border-bottom: 1px solid ${C.grid}; margin-bottom: 14px; }
.pf { position: absolute; left: 0.66in; right: 0.66in; bottom: 0.28in; display: flex; justify-content: space-between;
      font-size: 8.5px; color: ${C.muted}; border-top: 1px solid ${C.grid}; padding-top: 5px; }
.h2 { font-size: 24px; font-weight: 750; letter-spacing: -.02em; margin: 0 0 7px; }
.h3 { font-size: 12px; font-weight: 700; margin: 0 0 3px; }
.h3.mt { margin-top: 14px; }
.lead { font-size: 11.3px; line-height: 1.6; color: ${C.ink2}; margin: 0 0 13px; max-width: 6.8in; }
.lead b { color: ${C.ink}; font-weight: 650; }
.sub { font-size: 9.5px; color: ${C.muted}; margin: 0 0 6px; }
.block { margin-bottom: 13px; }
.cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.cols2.tight { gap: 24px; }
.cols2 .block { margin-bottom: 0; }
.micro { font-size: 9.5px; line-height: 1.52; color: ${C.ink2}; margin: 7px 0 0; }
.micro b { color: ${C.ink}; font-weight: 650; }
p.micro + .block, .callout + .block { margin-top: 14px; }
.chart { display: block; overflow: visible; }

/* stat tiles */
.tiles { display: grid; gap: 8px; margin-bottom: 14px; }
.tiles.t5 { grid-template-columns: repeat(5, 1fr); }
.tile { border: 1px solid ${C.grid}; border-radius: 6px; padding: 9px 9px 8px; border-top: 3px solid ${C.s1}; }
.tv { font-size: 20px; font-weight: 750; letter-spacing: -.025em; line-height: 1.1; }
.tl { font-size: 8.6px; text-transform: uppercase; letter-spacing: .06em; color: ${C.ink2}; margin-top: 3px; font-weight: 600; }
.ts { font-size: 8.8px; color: ${C.muted}; margin-top: 2px; }

/* hallazgos */
.finds { display: grid; gap: 6px; }
.find { display: flex; gap: 10px; padding: 8px 11px; border-radius: 6px; background: ${C.plane}; border-left: 3px solid ${C.s1}; }
.find.ok { border-left-color: ${C.good}; }
.find.warn { border-left-color: ${C.warning}; }
.find.bad { border-left-color: ${C.critical}; }
.fn { font-size: 15px; font-weight: 750; color: ${C.axis}; min-width: 14px; line-height: 1.3; }
.find h4 { font-size: 10.8px; margin: 0 0 2px; font-weight: 700; }
.find p { font-size: 9.8px; line-height: 1.52; margin: 0; color: ${C.ink2}; }
.find b { color: ${C.ink}; font-weight: 650; }

/* callouts */
.callout { font-size: 9.8px; line-height: 1.52; padding: 8px 11px; border-radius: 5px; margin-top: 9px; color: ${C.ink2};
           background: ${C.plane}; border-left: 3px solid ${C.s1}; }
.callout strong, .callout b { color: ${C.ink}; font-weight: 650; }
.callout.bad { background: #fdf3f3; border-left-color: ${C.critical}; }

/* leyenda */
.legend { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 7px; }
.lg { display: inline-flex; align-items: center; gap: 5px; font-size: 9.5px; color: ${C.ink2}; }
.lg i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }

/* tablas */
.tbl { width: 100%; border-collapse: collapse; font-size: 9.6px; }
.tbl th { text-align: left; font-size: 8.4px; text-transform: uppercase; letter-spacing: .07em; color: ${C.muted};
          font-weight: 700; padding: 0 7px 5px; border-bottom: 1px solid ${C.axis}; }
.tbl th.num, .tbl td.num { text-align: right; font-variant-numeric: tabular-nums; }
.tbl td { padding: 4.5px 7px; border-bottom: 1px solid ${C.grid}; }
.tbl td.lbl { font-weight: 600; color: ${C.ink}; }
.tbl td.lbl .sub { display: block; font-size: 7.8px; font-weight: 400; color: ${C.muted}; text-transform: lowercase; }
.tbl tbody tr:last-child td { border-bottom: none; }

/* mini stats */
.mini { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.mini.m4 { grid-template-columns: repeat(4, 1fr); }
.mini > div { background: ${C.plane}; border-radius: 5px; padding: 8px 9px; }
.mini b { display: block; font-size: 14px; font-weight: 700; letter-spacing: -.02em; }
.mini span { font-size: 8.5px; color: ${C.ink2}; line-height: 1.35; display: block; margin-top: 1px; }

/* usos */
.uses { display: grid; gap: 7px; }
.use { border: 1px solid ${C.grid}; border-radius: 6px; padding: 8px 12px 9px; }
.use-h { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.un { width: 16px; height: 16px; border-radius: 4px; background: ${C.s1}; color: #fff; font-size: 9.5px; font-weight: 750;
      display: flex; align-items: center; justify-content: center; }
.use.team .un { background: ${C.s2}; } .use.plan .un { background: ${C.s3}; }
.use.prod .un { background: ${C.s4}; } .use.rev .un { background: ${C.s5}; }
.use h4 { font-size: 10.8px; margin: 0; font-weight: 700; }
.use ul { margin: 0; padding-left: 15px; }
.use li { font-size: 9.5px; line-height: 1.47; color: ${C.ink2}; margin-bottom: 2px; }
.use li b { color: ${C.ink}; font-weight: 650; }

/* prioridades */
.prio { display: grid; gap: 5px; margin-bottom: 11px; }
.pr { display: flex; gap: 9px; align-items: flex-start; font-size: 9.8px; line-height: 1.48; color: ${C.ink2};
      background: ${C.plane}; padding: 7px 10px; border-radius: 5px; }
.pr b { color: ${C.ink}; font-weight: 650; }
.pr span { width: 16px; height: 16px; border-radius: 50%; color: #fff; font-size: 9px; font-weight: 750;
           display: flex; align-items: center; justify-content: center; flex: none; margin-top: 1px; }
.pr.p1 span { background: ${C.critical}; } .pr.p2 span { background: ${C.serious}; }
.pr.p3 span { background: ${C.warning}; color: ${C.ink}; } .pr.p4 span { background: ${C.s1}; }
.pr.p5 span { background: ${C.muted}; }

.method { border-top: 1px solid ${C.grid}; padding-top: 8px; }
.method h4 { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: ${C.muted}; margin: 0 0 4px; }
.method p { font-size: 8.5px; line-height: 1.55; color: ${C.muted}; margin: 0; }
.method b { color: ${C.ink2}; font-weight: 600; }
`;

/* ================================================================== SALIDA */
const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Reporte estadístico de uso — AquaXela · Koi CRM</title>
<style>${css}</style>
</head><body>
${cover}${p1}${p2}${p3}${p4}${p5}${p6}${p7}${p8}${p9}
</body></html>`;

writeFileSync(OUT, html, 'utf8');
console.log('OK ->', OUT, (html.length / 1024).toFixed(0) + ' KB');
