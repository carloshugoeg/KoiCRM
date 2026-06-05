import { isGoogleAuthEnabled } from "@/lib/auth/config"
import { SignInFormWithSuspense } from "./sign-in-form"

export default function SignInPage() {
  return <SignInFormWithSuspense googleEnabled={isGoogleAuthEnabled()} />
}
