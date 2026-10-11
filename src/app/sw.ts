/// <reference lib="webworker" />
// Service worker built by @serwist/next (see next.config.ts). It only ever
// caches static, content-hashed assets. Pages, RSC payloads, /api/* and every
// Supabase request go straight to the network so that nobody can see stale
// payroll or another session's data from an on-device cache.
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const SUPABASE_HOST_PATTERN = /(^|\.)supabase\.(co|in)$/i;
const STATIC_FILE_PATTERN = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf)$/i;

function isSameOrigin(url: URL): boolean {
  return url.origin === self.location.origin;
}

export const runtimeCaching: RuntimeCaching[] = [
  // Never cache application data.
  {
    matcher: ({ url }) => isSameOrigin(url) && url.pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ url }) => SUPABASE_HOST_PATTERN.test(url.hostname),
    handler: new NetworkOnly(),
  },
  // Content-hashed build output can be served from cache indefinitely.
  {
    matcher: ({ url }) => isSameOrigin(url) && url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "ttv-next-static",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
  // Icons, fonts and other static files served from /public.
  {
    matcher: ({ request, url }) =>
      isSameOrigin(url) &&
      request.method === "GET" &&
      !url.pathname.startsWith("/_next/image") &&
      STATIC_FILE_PATTERN.test(url.pathname),
    handler: new StaleWhileRevalidate({
      cacheName: "ttv-static-files",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
  // Everything else (navigations, RSC payloads, server actions, third-party
  // hosts such as vietqr.app) is intentionally unmatched: the browser fetches
  // it from the network without the service worker touching it.
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching,
});

serwist.addEventListeners();
