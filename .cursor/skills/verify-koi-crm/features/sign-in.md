# Sign in

Sign in lets a user authenticate with email and password and land inside their tenant app shell.

## Sub-features

- `signin-form` shows Correo, Contraseña, and Entrar on `/signin`.
- `signin-success` redirects into `/app/<tenantSlug>/...`.
- `signin-failure` shows Correo o contraseña incorrectos for bad passwords.

## How to get to it (user POV)

- Open `/signin` while signed out.
- Follow a redirect from a protected `/app/...` route to `/signin`.

## Driving it with control-koicrm

Preconditions:

- Verify app healthy at `http://127.0.0.1:3100`.
- Seed `test` present (`admin@test.local` / `Test1234!`) or demo credentials.
- `control-koicrm doctor` reports `DOCTOR_OK`.
- No prior storage state, or use a fresh run dir.

- **Open form.** Go to sign-in. Run `control-koicrm browser goto --url /signin`. Heading `Iniciar sesión` is visible.
- **Success path (session bootstrap).** Run `control-koicrm browser auth-credentials --email admin@test.local --password 'Test1234!'`. This posts to NextAuth `credentials` callback (same as `tests/e2e/auth.setup.ts`), then opens `/app`. URL matches `/app/test/` (or demo slug) within 30s. Use this before other features so hydration races do not fake a GET form submit.
- **Success path (visible form).** From a signed-out storage state, `goto /signin`, wait for heading `Iniciar sesión`, fill email/password, click `Entrar`, wait for `/app/`. Prefer this when proving the form itself.
- **Failure path.** On a fresh browser state, fill wrong password and submit. Run `control-koicrm browser goto --url /signin`, `control-koicrm browser fill --selector 'input[type="email"]' --value admin@test.local`, `control-koicrm browser fill --selector 'input[type="password"]' --value wrong-password`, `control-koicrm browser click --role button --name Entrar`. Text `Correo o contraseña incorrectos` appears.
- **Proof.** Capture post-login shell. Run `control-koicrm browser screenshot --path sign-in/after-login.png` and `control-koicrm browser snapshot --aria --path sign-in/after-login.aria.txt`. Artifacts show tenant chrome (pipeline or onboarding), not the sign-in form.

## Gotchas

- Google buttons appear only when `GOOGLE_CLIENT_*` is set; verify env leaves them empty.
- `auth-credentials` persists Playwright storage state in the run dir; clear the run or use a new `KOICRM_VERIFY_RUN_ID` before proving failure after success.
- Seed `test` vs `demo` changes the expected slug (`test` vs `demo-aqua`).
