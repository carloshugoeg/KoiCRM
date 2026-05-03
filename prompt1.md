# Prompt para Claude: scan profundo y plan de arquitectura para CRM white label

Actua como arquitecto principal de software, product analyst y tech lead senior. Tu mision en este primer trabajo NO es implementar todavia: tu mision es hacer un scan profundo del codebase demo y escribir un plan tecnico-producto completo para reconstruirlo como un CRM real, modular, multitenant, white label y altamente customizable.

## Contexto del repositorio

Estas trabajando en el repositorio:

`C:\Users\carlo\Documents\Proyectos\koi-crm`

El repo tiene dos carpetas principales:

- `hardcoded-demo/`: demo CRM especializado para una empresa de venta de aquasistemas. Es un demo vibecoded, hardcodeado, fake, sin utilidad real como sistema productivo. Sirve SOLO como referencia funcional, visual, de flujos, entidades, labels, estados, pantallas, datos aparentes y comportamiento esperado.
- `crm-core/`: aqui debe vivir el producto real. Todo codigo nuevo, arquitectura real, documentacion tecnica del producto real, tests, schemas y futuras implementaciones deben ir aqui.

## Mision exacta

Escanea `hardcoded-demo/` una sola vez de forma exhaustiva para entender absolutamente todas las funcionalidades que presenta el demo CRM especializado para aquasistemas. Despues, escribe un plan de arquitectura y ejecucion para convertir todas esas funcionalidades, sin perder ninguna, en un CRM real white label, multitenant, modular, escalable y adaptable a otras industrias.

La V1 debe contener solamente las funciones presentadas en el demo, pero debe contenerlas TODAS. No inventes un alcance gigante fuera del demo para la V1. Si propones capacidades futuras, separalas claramente como "post-V1" y no las mezcles con el scope obligatorio.

El objetivo de negocio es transformar el demo de aquasistemas en la base de un CRM vendible a multiples industrias. Sin embargo, el scope minimo de V1 debe funcionar muy bien para la industria original: venta, instalacion, seguimiento, clientes, oportunidades, cotizaciones, operaciones y cualquier otra funcionalidad que el demo muestre para aquasistemas.

## Restricciones no negociables

1. No reutilices codigo de `hardcoded-demo/`.
   - No copies componentes, hooks, estilos, estructuras internas ni implementaciones.
   - Puedes usar el demo solo como fuente de requisitos, comportamiento, UI esperada, entidades, estados, labels, metricas y reglas aparentes.
   - El codigo del demo es fake; la solucion real debe ser disenada desde cero.

2. No modifiques `hardcoded-demo/`.
   - No edites, borres, reformatees ni reorganices nada dentro de `hardcoded-demo/`.
   - Si necesitas anotar hallazgos, hazlo en archivos dentro de `crm-core/`.

3. Todo trabajo real debe ir en `crm-core/`.
   - El plan final debe escribirse dentro de `crm-core/`.
   - Cualquier documentacion auxiliar, inventario, schema propuesto, backlog, ADR o task list debe vivir dentro de `crm-core/`.

4. Lee `hardcoded-demo/` profundamente al inicio y genera un inventario completo.
   - Despues de escribir el inventario funcional y el plan, NO vuelvas a leer `hardcoded-demo/` salvo que sea 100% necesario para resolver una duda critica.
   - Si vuelves a leerlo, debes registrar en el plan o en notas de trabajo exactamente por que fue necesario.
   - La idea es no gastar tokens releyendo siempre el demo; el primer scan debe capturar todo lo necesario.

5. No asumas funcionalidades. Verifica contra el demo.
   - Si el demo muestra una pantalla, boton, tabla, filtro, grafica, modal, estado, metrica, accion, flujo, entidad o campo, incluyelo en el inventario.
   - Si algo parece funcional pero esta hardcodeado o incompleto, documentalo como "funcion presentada por el demo" y disena como deberia existir de forma real.
   - Si algo es ambiguo, documenta la ambiguedad y propone una decision explicita para V1.

6. El CRM final debe ser multitenant.
   - Desde V1, la arquitectura, base de datos, autorizacion, configuracion, branding, datos y modulos deben considerar aislamiento por tenant.
   - Debe existir un modelo claro de tenant, usuarios, roles, permisos, settings, branding y configuracion por tenant.

7. La base de datos debe ser adaptativa.
   - Debe poder acoplarse a cualquier industria con configuracion, no con forks del producto.
   - Para V1, debe modelar bien el caso aquasistemas.
   - El diseno debe permitir campos custom, entidades configurables, pipelines/etapas configurables, formularios configurables, vistas configurables, catalogos por tenant, reglas por tenant y taxonomias de industria.
   - Evita una base de datos tan generica que mate la integridad del dominio. Propone una estrategia balanceada entre tablas core fuertes y extensibilidad controlada.

8. La V1 no debe ser una demo.
   - Debe ser un producto real con persistencia real, reglas reales, validaciones reales, tests, arquitectura clara y separacion de capas.
   - Nada de datos hardcodeados como fuente principal del sistema.
   - Si se necesitan datos demo, deben ser seeds separados, reemplazables y marcados como demo.

## Proceso obligatorio

### Fase 1: Scan exhaustivo de `hardcoded-demo/`

Lee primero la estructura del proyecto y luego todos los archivos relevantes dentro de `hardcoded-demo/`, especialmente:

- `package.json`
- `server.js`
- `data/app-data.json`
- `src/main.jsx`
- `src/SalesFunnel.jsx`
- `src/persistence.js`
- `src/index.css`
- configs de Vite/Tailwind/PostCSS si afectan UI o comportamiento

Ignora `node_modules/` y `dist/` salvo que haya una razon critica.

Durante el scan, identifica y documenta:

- Todas las pantallas o vistas.
- Todos los modulos funcionales.
- Todos los componentes visibles importantes.
- Todos los botones, acciones y comandos que aparentan existir.
- Todos los formularios, campos, filtros, busquedas, tabs, modales, sidebars y dashboards.
- Todas las tablas, tarjetas, graficas, KPIs, metricas y reportes.
- Todas las entidades de negocio.
- Todos los campos visibles y campos inferidos desde datos.
- Todos los estados, etapas, pipelines, prioridades, categorias y tipos.
- Todas las relaciones entre entidades.
- Todas las reglas de negocio aparentes.
- Todos los flujos de usuario de inicio a fin.
- Toda logica de persistencia fake/local/hardcodeada.
- Todos los datos seed usados para simular el negocio.
- Todo lo especifico de aquasistemas que debe sobrevivir en V1.
- Todo lo que deberia ser configurable para white label.

### Fase 2: Inventario funcional completo

Antes de proponer arquitectura, crea un inventario funcional completo. Este inventario sera la fuente de verdad para no tener que releer el demo despues.

El inventario debe incluir, como minimo:

- Mapa de pantallas/vistas.
- Mapa de modulos.
- Lista de funcionalidades por modulo.
- Lista de entidades y atributos.
- Lista de relaciones.
- Lista de estados y transiciones.
- Lista de acciones CRUD y acciones de negocio.
- Lista de reportes, dashboards y metricas.
- Lista de configuraciones necesarias por tenant.
- Lista de reglas especificas para aquasistemas.
- Lista de gaps del demo que deben resolverse para que sea un producto real.

Marca cada item con una categoria:

- `V1-obligatorio`: aparece en el demo y debe implementarse en el CRM real.
- `V1-inferido`: no esta totalmente implementado, pero el demo lo sugiere claramente y hace falta para cerrar el flujo real.
- `Post-V1`: mejora futura, no requerida para esta primera version.
- `Decision-pendiente`: requiere decision del owner.

### Fase 3: Arquitectura del CRM real

Disena una arquitectura completa para `crm-core/`, incluyendo:

- Stack recomendado y justificacion.
- Estructura de carpetas.
- Capas del sistema.
- Modulos de dominio.
- Modelo multitenant.
- Modelo de autorizacion.
- Modelo de configuracion white label.
- Modelo de base de datos adaptativa.
- Estrategia de migraciones.
- Estrategia de seeds demo por industria.
- API/backend.
- Frontend.
- Estado de aplicacion.
- Validaciones.
- Observabilidad/logging basico.
- Manejo de errores.
- Seguridad minima.
- Testing.
- Proceso de desarrollo para agentes.

No elijas un stack por moda. Elige uno que permita construir rapido, mantener limpio, testear bien y escalar. Si el repo ya tiene una direccion clara dentro de `crm-core/`, respetala; si `crm-core/` esta vacio, propone el stack desde cero.

### Fase 4: Business logic y modelo adaptable

El plan debe explicar como convertir lo especifico de aquasistemas en configuracion reutilizable:

- Que queda como core CRM generico.
- Que queda como modulo o plantilla de industria "aquasistemas".
- Que queda como configuracion por tenant.
- Que debe estar normalizado en tablas core.
- Que debe ir como custom fields/config schema.
- Como manejar pipelines configurables.
- Como manejar catalogos configurables.
- Como manejar formularios y vistas configurables.
- Como manejar roles y permisos por tenant.
- Como manejar branding white label.

El resultado debe permitir vender el CRM a otras industrias despues sin reescribir el producto.

### Fase 5: Plan de implementacion con tasks y subtasks

Genera un backlog ejecutable, con tasks y subtasks claras para agentes de codigo.

El backlog debe estar escrito en formato checklist Markdown para poder marcar avance real:

- Cada milestone debe tener un checkbox.
- Cada task debe tener un checkbox.
- Cada subtask y actividad verificable debe tener un checkbox.
- Debe existir un indice general de tasks al inicio de `IMPLEMENTATION_BACKLOG.md`, tambien con checkboxes.
- Cada task del indice general debe enlazar o referenciar su seccion detallada.
- Los agentes futuros deben poder marcar done en dos lugares cuando corresponda: el indice general y la task/subtask especifica.
- Incluye una nota explicita indicando que nada se marca como done hasta que funcione al 100% y cumpla criterios de aceptacion, tests y verificacion.
- Si una task se divide durante implementacion, el agente debe agregar las nuevas subtasks al `.md` antes de marcarlas como completadas.

Cada task debe incluir:

- Objetivo.
- Carpeta/archivos esperados dentro de `crm-core/`.
- Dependencias.
- Criterios de aceptacion.
- Tests requeridos.
- Notas de arquitectura.
- Riesgos o decisiones.

Divide el trabajo en milestones recomendados:

1. Foundation del monorepo/app.
2. Data model y migraciones.
3. Tenant/auth/roles.
4. Configuracion white label.
5. Modulos core CRM.
6. Plantilla de industria aquasistemas.
7. UI real equivalente al demo.
8. Dashboards/reportes.
9. Tests y hardening.
10. Seeds/demo data controlada.

Si encuentras un orden mejor, puedes ajustarlo, pero explica por que.

### Fase 6: Reglas para agentes

Incluye reglas explicitas para futuros agentes que implementen el plan:

- Leer siempre `DEMO_INVENTORY.md`, `ARCHITECTURE_PLAN.md`, `IMPLEMENTATION_BACKLOG.md`, `AGENT_RULES.md` y `DECISIONS_AND_OPEN_QUESTIONS.md` antes de hacer cualquier cambio.
- No tocar `hardcoded-demo/`.
- No copiar codigo del demo.
- Implementar solo en `crm-core/`.
- Antes de implementar una task, leer el plan y el inventario, no releer el demo.
- Si una task requiere releer el demo, justificarlo en una nota.
- No marcar una task como done hasta que funcione al 100%.
- Marcar como done cada subtask y actividad completada en `IMPLEMENTATION_BACKLOG.md`.
- Cuando una task este terminada, marcar done tanto en su seccion detallada como en el indice general de tasks.
- Si algo queda parcial, dejarlo sin marcar y documentar el estado real.
- Mantener multitenancy en cada tabla, query y endpoint que maneje datos de negocio.
- No introducir hardcoding de la industria aquasistemas en core generico.
- Separar configuracion de industria, tenant y usuario.
- Escribir tests por cada modulo.
- Mantener migraciones y seeds reproducibles.
- No avanzar con datos fake como si fueran persistencia real.
- Documentar decisiones importantes como ADRs.

### Fase 7: Reglas de preservacion de tokens

Incluye reglas concretas para mejorar la eficacia de futuros agentes y evitar gasto innecesario de contexto:

- El inventario generado debe ser suficientemente completo para que futuros agentes no relean `hardcoded-demo/`.
- Los agentes deben usar los documentos dentro de `crm-core/` como fuente principal.
- Los agentes deben buscar por modulo, entidad, task o archivo especifico antes de leer archivos grandes completos.
- Los agentes deben leer solo las secciones relevantes del plan cuando trabajen en una task acotada.
- Si un agente descubre informacion nueva, debe actualizar el backlog, inventario, decisiones o reglas para que no se redescubra despues.
- Evitar duplicar explicaciones largas entre archivos; preferir referencias claras entre documentos.
- Registrar cualquier relectura inevitable de `hardcoded-demo/` con motivo, archivo revisado y conclusion.
- Mantener notas de implementacion breves y accionables, no narrativas largas.

## Entregables requeridos

Crea estos archivos dentro de `crm-core/`:

1. `crm-core/DEMO_INVENTORY.md`
   - Inventario exhaustivo de todo lo encontrado en `hardcoded-demo/`.
   - Debe ser suficientemente completo para no tener que volver a leer el demo.

2. `crm-core/ARCHITECTURE_PLAN.md`
   - Plan de arquitectura completo del CRM real white label multitenant.
   - Debe incluir stack, capas, modulos, DB adaptativa, business logic, procesos, tests y reglas para agentes.

3. `crm-core/IMPLEMENTATION_BACKLOG.md`
   - Tasks y subtasks ejecutables para construir la V1 real.
   - Debe incluir criterios de aceptacion y tests por task.
   - Debe usar checkboxes Markdown en el indice general, milestones, tasks, subtasks y actividades verificables.
   - Debe explicar que los agentes futuros deben marcar done tanto en el indice general como en la seccion detallada de cada task.
   - Debe prohibir marcar una task como done hasta que funcione al 100%.

4. `crm-core/AGENT_RULES.md`
   - Reglas operativas para agentes futuros.
   - Debe ser corto, directo y accionable.
   - Debe incluir reglas de lectura inicial, marcado de tasks/subtasks completadas y preservacion de tokens.

5. `crm-core/DECISIONS_AND_OPEN_QUESTIONS.md`
   - Decisiones tomadas.
   - Decisiones pendientes.
   - Preguntas para el owner.
   - Riesgos principales.

## Nivel de detalle esperado

Se extremadamente concreto. No escribas un plan generico de "hacer CRM con clientes y ventas". Este plan debe demostrar que entendiste este demo especifico de aquasistemas y que sabes transformarlo en un producto real.

Incluye nombres de modulos y entidades derivados del demo. Incluye campos y estados. Incluye flujos. Incluye reglas. Incluye pantallas. Incluye KPIs. Incluye todo lo que aparezca.

Si algo aparece 4 veces con variaciones, capturalo. Si un boton no hace nada pero se ve como funcionalidad futura del demo, capturalo. Si un campo esta en JSON pero no se renderiza, capturalo. Si una metrica se calcula hardcodeada, capturala y explica como deberia calcularse real.

## Criterios de exito

El trabajo esta bien hecho si:

- Alguien puede implementar la V1 real leyendo solo los archivos creados en `crm-core/`, sin volver a leer `hardcoded-demo/`.
- Todas las funcionalidades presentadas por el demo estan inventariadas y mapeadas a tasks.
- El plan no reutiliza codigo fake.
- El CRM queda disenado como white label multitenant desde V1.
- La base de datos queda pensada para adaptarse a otras industrias sin abandonar el caso aquasistemas.
- Las tasks son suficientemente especificas para que agentes de codigo puedan ejecutarlas sin improvisar arquitectura.
- El backlog permite marcar avance con checkboxes en indice general, milestones, tasks, subtasks y actividades.
- Las reglas dejan claro que no se marca nada como done hasta que funcione al 100%.
- Las reglas de preservacion de tokens reducen la necesidad de releer `hardcoded-demo/`.
- Los limites entre core generico, plantilla de industria aquasistemas y configuracion por tenant quedan claros.

## Ultima instruccion importante

No empieces implementando codigo productivo. Primero termina el scan, el inventario y el plan. Tu salida final debe resumir que archivos creaste en `crm-core/`, que tan completo quedo el inventario y que dudas quedan para el owner.
