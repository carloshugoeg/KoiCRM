# Reglas obligatorias para agentes en koi-crm

Estas reglas aplican a cualquier agente que trabaje en este repositorio.

## Lectura inicial obligatoria

Antes de hacer cualquier cambio, el agente debe leer primero los documentos generados por Claude dentro de `crm-core/`:

1. `crm-core/DEMO_INVENTORY.md`
2. `crm-core/ARCHITECTURE_PLAN.md`
3. `crm-core/IMPLEMENTATION_BACKLOG.md`
4. `crm-core/AGENT_RULES.md`
5. `crm-core/DECISIONS_AND_OPEN_QUESTIONS.md`

Si esos archivos todavia no existen, el agente debe detener la implementacion y generarlos usando `prompt1.md` como instruccion principal.

## Limites del repo

- `hardcoded-demo/` es solo referencia historica del demo fake.
- No modificar `hardcoded-demo/`.
- No copiar codigo desde `hardcoded-demo/`.
- Todo codigo real, documentacion real, tests, schemas, migraciones y seeds deben vivir en `crm-core/`.
- No releer `hardcoded-demo/` salvo necesidad critica y justificada. La fuente de verdad para implementar debe ser el plan dentro de `crm-core/`.

## Reglas de ejecucion de tasks

- Cada task debe tomarse desde `crm-core/IMPLEMENTATION_BACKLOG.md`.
- Antes de iniciar una task, confirma que entiendes sus criterios de aceptacion, dependencias y tests requeridos.
- No marques una task como terminada hasta que funcione al 100% segun sus criterios de aceptacion.
- No marques una subtask como terminada hasta que este implementada, verificada y sin pendientes ocultos.
- Si una task queda parcialmente hecha, dejala sin marcar y agrega una nota breve con el estado real.
- Cuando completes una subtask, marca su checkbox como done en el lugar exacto donde aparece.
- Cuando completes todas las subtasks de una task, marca tambien como done la task especifica.
- Si existe un indice general de tasks, marca tambien como done la entrada correspondiente en ese indice.
- Si agregas nuevas subtasks descubiertas durante la implementacion, agregalas al `.md` antes de resolverlas y marcalas cuando queden terminadas.

## Definicion de terminado

Una task solo puede marcarse como done cuando:

- La funcionalidad corre en la app real dentro de `crm-core/`.
- La persistencia real funciona cuando aplica.
- El multitenancy esta respetado en tablas, queries, endpoints y UI cuando aplica.
- Las validaciones necesarias existen.
- Los errores principales estan manejados.
- Los tests requeridos fueron escritos o actualizados.
- Los tests relevantes pasan.
- No hay datos hardcodeados usados como fuente real del sistema.
- La documentacion o backlog fue actualizado para reflejar el estado actual.

## Preservacion de tokens y eficiencia

- Lee primero los documentos de plan en `crm-core/`; no gastes tokens reescaneando el demo.
- Usa busquedas dirigidas por nombre de modulo, entidad, task o archivo en lugar de leer carpetas completas.
- Lee archivos grandes por secciones cuando sea suficiente.
- Resume hallazgos en notas o en el backlog para que futuros agentes no repitan el mismo analisis.
- Evita duplicar informacion entre documentos; enlaza o referencia el archivo fuente cuando sea posible.
- Antes de abrir muchos archivos, define que pregunta estas intentando responder.
- No vuelvas a leer `hardcoded-demo/` por costumbre. Si es inevitable, documenta la razon y el resultado.
- Manten el contexto activo enfocado en la task actual, sus dependencias y sus criterios de aceptacion.

## Reglas de calidad

- El CRM debe ser white label, multitenant, modular y escalable desde V1.
- La V1 debe cubrir todas las funciones presentadas por el demo, pero sin convertir el core en codigo especifico de aquasistemas.
- Lo especifico de aquasistemas debe modelarse como plantilla de industria, configuracion de tenant, catalogos, campos custom o reglas configurables.
- Toda decision importante debe quedar documentada como nota en `crm-core/DECISIONS_AND_OPEN_QUESTIONS.md` o como ADR si el plan lo define.
- No cierres una task con "pendiente de probar" como si estuviera terminada.
