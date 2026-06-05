import { isGoogleAuthEnabled } from "@/lib/auth/config"
import { SignUpForm } from "./sign-up-form"

export default function SignUpPage() {
  return <SignUpForm googleEnabled={isGoogleAuthEnabled()} />
}
