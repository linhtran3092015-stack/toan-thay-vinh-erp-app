import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    incomingRequests: {
      ignore: [/\/auth\/callback/],
    },
  },
  outputFileTracingRoot:
    "/Users/linhtran/Documents/ERP-Toan-Thay-Vinh/toan-thay-vinh-erp-app",
};

export default nextConfig;
