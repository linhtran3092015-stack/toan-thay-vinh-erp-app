import path from "node:path";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

// The service worker is only bundled for production builds. In development the
// plugin is a no-op so hot reload is never served from a stale cache.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  cacheOnNavigation: false,
  reloadOnOnline: false,
  // Only the icon set from /public is precached; everything else in /public is
  // fetched on demand.
  globPublicPatterns: ["icons/**/*"],
});

// Security headers (review S4). CSP stays compatible with Next.js inline
// bootstrap scripts and the Supabase/VietQR origins the app talks to.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const supabaseWsOrigin = supabaseOrigin.replace(/^http/, "ws");
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://vietqr.app${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseWsOrigin}` : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation powers on-site timekeeping; everything else stays off.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ headers: securityHeaders, source: "/(.*)" }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        hostname: "vietqr.app",
        pathname: "/img",
        protocol: "https",
      },
    ],
  },
  logging: {
    incomingRequests: {
      ignore: [/\/auth\/callback/],
    },
  },
  outputFileTracingRoot: path.join(__dirname),
};

export default withSerwist(nextConfig);
