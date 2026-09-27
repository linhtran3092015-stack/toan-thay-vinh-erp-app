import path from "node:path";
import type { NextConfig } from "next";

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

export default nextConfig;
