// @ts-check
import { withSentryConfig } from "@sentry/nextjs";

// `next dev` relies on eval() for fast refresh, so 'unsafe-eval' is only
// permitted in development. Production CSP omits it for XSS hardening.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;

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
              scriptSrc,
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

const sentryOptions = {
  silent: !process.env.CI,
  hideSourceMaps: true,
  webpack: { treeshake: { removeDebugLogging: true } },
  widenClientFileUpload: true,
};

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;
