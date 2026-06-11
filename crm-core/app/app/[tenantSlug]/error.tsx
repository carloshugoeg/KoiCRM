"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold">No pudimos cargar esta sección</h2>
      <p className="text-sm text-muted-foreground">
        Ocurrió un error al mostrar esta parte del espacio de trabajo. El error
        ha sido registrado automáticamente.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        Reintentar
      </button>
    </div>
  );
}
