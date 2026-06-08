# R2 / adjuntos de cotizaciones y pagos — checklist de producción

Los comprobantes y cotizaciones se suben **vía la app** (`POST /api/upload/deal`) y se guardan en Cloudflare R2 server-side — **no requieren CORS** en el bucket. La lectura usa el proxy `/api/media/...` (no hace falta bucket público).

Para el flujo legacy (`/api/upload/sign` + PUT directo al presigned URL), sigue siendo obligatorio CORS en R2.

## 0. Dominio custom (ej. `koicrm.aquaxela.com`)

Al añadir un dominio distinto de `*.vercel.app`:

1. **Vercel** → Project → Settings → Domains → añade `koicrm.aquaxela.com` y sigue las instrucciones DNS.
2. **Cloudflare DNS** (zona `aquaxela.com`): CNAME `koicrm` → `cname.vercel-dns.com` (o el target que indique Vercel). Proxy **DNS only** (nube gris) suele ser más fiable con Vercel.
3. **Vercel env** (Production): actualiza y redeploy:
   - `AUTH_URL=https://koicrm.aquaxela.com`
   - `NEXT_PUBLIC_APP_URL=https://koicrm.aquaxela.com`
4. **R2 CORS** — añade el dominio custom (paso 2 abajo). Sin esto, los adjuntos fallan con *Error al subir el archivo* aunque avatares/branding sigan funcionando (van server-side).

Verifica DNS: `curl -I https://koicrm.aquaxela.com/api/health` → **200**.

## 1. Variables en Vercel (o tu host)

Copia desde `.env.production.example` y rellena en el proyecto de producción:

| Variable | Valor correcto |
|----------|----------------|
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` — **sin** `/nombre-bucket` al final |
| `S3_BUCKET` | Nombre del bucket, ej. `aqua-crm` (no incluir el bucket en `S3_ENDPOINT`) |
| `S3_ACCESS_KEY_ID` | Token R2 con lectura/escritura en ese bucket |
| `S3_SECRET_ACCESS_KEY` | Secret del token |
| `S3_REGION` | `auto` |
| `S3_PUBLIC_URL` | URL pública del bucket: dominio `r2.dev` habilitado o dominio custom |

**Error frecuente en local:** `S3_ENDPOINT=https://….r2.cloudflarestorage.com/mi-bucket` — el bucket va solo en `S3_BUCKET`.

Tras cambiar env en Vercel, **redeploy** la app.

## 2. CORS en el bucket R2 (obligatorio para adjuntos)

Los adjuntos de deals hacen `PUT` directo al presigned URL de R2 desde el navegador. El **Origin** es tu dominio de app (`https://koicrm.aquaxela.com`, `https://koicrm.vercel.app`, etc.). Si el dominio no está en CORS, la subida falla.

### Opción A — script (recomendado)

Con token Cloudflare (permiso **R2 Edit**):

```bash
cd crm-core
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="..."   # o tener S3_ENDPOINT en .env.local
export S3_BUCKET=aqua-crm
pnpm ops:configure-r2-cors
```

El policy por defecto está en `scripts/ops/r2-cors-production.json` e incluye `localhost`, `koicrm.vercel.app`, `koicrm.aquaxela.com` y `https://*.vercel.app`.

Dominio extra: `R2_CORS_ORIGINS=https://otro.ejemplo.com pnpm ops:configure-r2-cors`

### Opción B — dashboard manual

En Cloudflare → R2 → tu bucket → **Settings** → **CORS policy**, ejemplo:

```json
[
  {
    "AllowedOrigins": [
      "https://koicrm.aquaxela.com",
      "https://koicrm.vercel.app",
      "https://tu-dominio.com",
      "https://*.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

- Incluye el dominio de producción y, si usas previews, `https://*.vercel.app`.
- En desarrollo local añade `http://localhost:3000`.
- Sin CORS, la subida falla en el paso `PUT` al presigned URL (toast: *Error al subir el archivo*).

## 3. Lectura pública de archivos

`Quote.fileUrl` / `Payment.fileUrl` apuntan a `{S3_PUBLIC_URL}/{tenantId}/deals/{dealId}/{uuid}.ext`.

Opciones:

1. **R2.dev público** (rápido): en el bucket, habilitar acceso público y usar la URL `https://pub-xxxx.r2.dev` como `S3_PUBLIC_URL`.
2. **Dominio custom** en R2 conectado al bucket.
3. **Proxy autenticado** (futuro V2-I02): bucket privado + `GET /api/media/...` — no aplica hoy al flujo estándar.

Comprueba: sube un archivo en staging, abre la URL guardada en DB en una pestaña nueva → debe responder **200**.

## 4. Cuota de almacenamiento por tenant

`TenantSettings.storageMaxBytes` / `storageUsedBytes` se actualizan en `confirmUpload`. Si un tenant supera el límite, `/api/upload/sign` devuelve `403 storage_limit_exceeded`.

## 5. Compresión en cliente (V1 actual)

- **Fotos:** se redimensionan si superan 2560 px y se re-codifican en JPEG/WebP/PNG con calidad alta (~92%) antes del upload.
- **PDF:** se envían tal cual (ya suelen ser más livianos que fotos de cámara).

Esto reduce coste de R2; no sustituye un límite de tamaño por archivo (`fileSizeMaxBytes` en settings).

## 6. Verificación manual post-deploy

1. `GET https://<domain>/api/health` → `{"ok":true,"db":"ok","storage":"ok"}` (si `storage:"error"`, revisa `S3_*` en Vercel).
2. Abrir una oportunidad → **Cotizaciones** → Adjuntar foto o PDF → **Guardar**.
2. Debe aparecer el icono de enlace externo; el enlace abre el archivo.
3. Repetir en **Documentos de Pago**.
4. En DevTools → Network: `POST /api/upload/sign` → **200**, luego `PUT` al host R2 → **200**.

## 7. Rotación de credenciales

Si alguna clave R2 se expuso en un repo, **revócala** en Cloudflare y crea un token nuevo; actualiza Vercel y `.env.local` local.
