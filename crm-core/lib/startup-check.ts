const REQUIRED_ENV = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "RESEND_API_KEY",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_REGION",
  "S3_PUBLIC_URL",
] as const;

if (process.env.NODE_ENV === "production") {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[startup] Missing required environment variables: ${missing.join(", ")}\n` +
        `See .env.production.example for setup instructions.`
    );
  }
}
