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

const nextConfig: NextConfig = {
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
