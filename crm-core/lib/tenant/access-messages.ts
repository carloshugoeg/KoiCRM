import type { AccessDenialReason } from "@/lib/tenant/access-types"

export function accessDenialCopy(reason: AccessDenialReason): {
  title: string
  body: string
} {
  switch (reason) {
    case "no_membership":
      return {
        title: "Sin membresía activa",
        body:
          "No tienes un espacio de trabajo asignado. Solicita la adquisición de una membresía o únete con un enlace de unión de tu administrador.",
      }
    case "membership_inactive":
      return {
        title: "Membresía inactiva",
        body:
          "Tu acceso al embudo está suspendido. Contacta al equipo de Koi para renovar tu membresía o usa un enlace de unión válido.",
      }
    case "tenant_subscription_inactive":
      return {
        title: "Espacio de trabajo no validado",
        body:
          "La membresía del propietario de este espacio aún no está validada. Ningún usuario del equipo puede acceder al embudo hasta que se complete la validación. El propietario debe contactar para renovación o activación.",
      }
  }
}

export function membershipContactInfo() {
  return {
    email: process.env.MEMBERSHIP_CONTACT_EMAIL ?? "soporte@koisoftware.com",
    phone: process.env.MEMBERSHIP_CONTACT_PHONE ?? null,
    label: process.env.MEMBERSHIP_CONTACT_LABEL ?? "Koi Software",
  }
}
