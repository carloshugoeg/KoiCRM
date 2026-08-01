# Alta de un cliente nuevo

Cómo se da de alta un espacio de trabajo, de principio a fin. Escrito para que lo pueda seguir
alguien que no construyó la aplicación.

El paso 3 es el que no se puede saltar: **un espacio recién creado nace bloqueado** y el cliente
verá una pantalla de acceso denegado hasta que alguien le otorgue la licencia desde el servidor.

---

## 1. La persona se registra

El cliente entra a `/signup`, crea su cuenta con correo y contraseña, y al no pertenecer a
ningún espacio la aplicación lo lleva a `/app/onboarding`.

Ahí elige:

- **Nombre** del espacio — como lo verá su equipo.
- **Identificador** (`slug`) — aparece en la URL, `/app/<slug>/…`. No se puede cambiar después
  sin tocar la base de datos, así que conviene revisarlo antes de confirmar.
- **Industria** — determina las etapas del embudo y los catálogos iniciales. Hoy existe
  `aquasistemas`. Ver `lib/industry/registry.ts` para la lista vigente.

## 2. Qué recibe el espacio automáticamente

`bootstrapTenant` crea, en una sola transacción:

- El espacio, con `subscriptionValidated: false` — de ahí el bloqueo del paso 3.
- La membresía de quien lo creó, como **Superadministrador**.
- Las etapas del embudo y los catálogos de la industria elegida, incluidos los **motivos de
  archivo**.
- Una fila de permisos: `MEMBER` con `pipeline.viewAll` en `true`.

Esa última merece explicación. Los espacios anteriores al sistema de permisos recibieron esa
misma fila en la migración `20260727045954`, para que nadie notara el cambio. Un espacio nuevo
no la heredaría de esa migración, así que la siembra el bootstrap: **los asesores del cliente
nuevo ven todo el embudo desde el primer día**, igual que los clientes existentes. Un
administrador puede cerrarlo cuando quiera en *Ajustes → Permisos*.

Lo que **no** se abre: los totales del embudo, los reportes de todo el equipo y los montos en
estadísticas siguen en su default restringido, para que alguien los conceda a propósito.

## 3. Otorgar la licencia

Sin esto el cliente no entra.

```bash
cd crm-core
pnpm ops:grant-license <correo-del-cliente>
```

Deja el espacio en `subscriptionValidated: true`, la membresía en `ACTIVE` y el
almacenamiento en 1 PiB.

**Ojo con el almacenamiento.** El script fija un límite efectivamente ilimitado. Si el cliente
contrató un tier con tope, ajústalo después en *Ajustes* o directamente sobre
`TenantSettings.storageMaxBytes`; el script no pregunta.

El script necesita `DATABASE_ADMIN_URL`, que lee de `crm-core/.env`. En producción esa variable
apunta al pooler de Supabase — no al host directo, que es solo IPv6.

## 4. Verificar antes de entregar

Entra como el cliente y comprueba:

- [ ] Carga `/app/<slug>/pipeline` sin redirigir a `/app/access`.
- [ ] El embudo muestra las etapas de su industria.
- [ ] *Ajustes → Catálogos avanzados → Motivos de archivo* tiene motivos cargados.
- [ ] *Ajustes → Permisos* muestra "Ver el embudo de todo el equipo" encendido para Asesor.
- [ ] Crear una oportunidad de prueba y archivarla, para confirmar que el motivo se guarda.
- [ ] Borrar esa oportunidad de prueba.

## 5. Invitar al equipo

Desde *Ajustes → Usuarios*, con un enlace de unión. Los roles asignables son Superadministrador,
Supervisor, Asesor y Solo lectura; el rol de propietario no se asigna, pertenece a quien creó el
espacio.

A cada persona conviene asignarle su **PIN de acción** de cuatro dígitos: es lo que identifica
al autor de cada escritura.

---

## Si algo sale mal

**El cliente ve "acceso denegado".** Falta el paso 3, o su membresía no quedó `ACTIVE`.

**El embudo aparece vacío para un asesor pero lleno para el administrador.** El permiso
`pipeline.viewAll` de `MEMBER` no quedó sembrado. Revisar en *Ajustes → Permisos*; se puede
encender ahí mismo sin tocar la base.

**Todas las páginas fallan con P2022.** Faltan migraciones en producción. El build de Vercel
**no** corre `migrate deploy` — hay que aplicarlas a mano como `admin_user` antes de promover
el despliegue.

**Se acabó el espacio de almacenamiento antes de tiempo.** Ver la nota del paso 3.
