/** Maps Auth.js `?error=` query params to user-facing Spanish messages. */
export function signInErrorMessage(errorParam: string | null): string | null {
  if (!errorParam) return null
  switch (errorParam) {
    case "link_expired":
      return "El enlace expiró. Solicita uno nuevo."
    case "no_workspace":
      return "No tienes acceso a un espacio de trabajo. Crea uno o pide una invitación."
    case "wrong_account":
      return "Inicia sesión con el correo al que se envió la invitación."
    case "invalid_link":
      return "Enlace no válido."
    case "OAuthAccountNotLinked":
      return "Este correo ya está registrado con contraseña. Inicia sesión con tu contraseña o usa el mismo correo en Google si es tu cuenta."
    case "OAuthSignin":
    case "OAuthCallback":
      return "No se pudo completar el inicio con Google. Intenta de nuevo."
    case "AccessDenied":
      return "Acceso denegado."
    case "Configuration":
      return "Inicio con Google no está configurado en este entorno."
    case "TooManyRequests":
      return "Demasiados intentos. Espera un momento."
    default:
      return "Error al iniciar sesión."
  }
}
