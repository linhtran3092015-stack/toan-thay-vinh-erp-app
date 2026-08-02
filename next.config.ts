import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  outputFileTracingRoot:
    "/Users/linhtran/Documents/ERP-Toan-Thay-Vinh/toan-thay-vinh-erp-app",
};

export default nextConfig;
