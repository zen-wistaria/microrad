import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Custom server (production/WS) memakai `ws` di luar bundler — jangan
  // di-bundle agar native module tetap berfungsi.
  serverExternalPackages: ["ws"],
};

export default nextConfig;
