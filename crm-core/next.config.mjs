// @ts-check
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI output during builds
  silent: !process.env.CI,
  // Don't expose source maps to the client bundle
  hideSourceMaps: true,
  // Remove debug logging from the Sentry bundle (reduces bundle size)
  webpack: { treeshake: { removeDebugLogging: true } },
  // Upload source maps to Sentry on build (requires SENTRY_AUTH_TOKEN + org/project in env)
  // Set SENTRY_ORG and SENTRY_PROJECT in your Vercel env vars alongside SENTRY_AUTH_TOKEN.
  widenClientFileUpload: true,
});
