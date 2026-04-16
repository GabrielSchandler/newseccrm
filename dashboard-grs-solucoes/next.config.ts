import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["read-excel-file", "unzipper"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
