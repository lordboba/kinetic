import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    BACKEND_ENDPOINT: process.env.BACKEND_ENDPOINT,
    NEXT_PUBLIC_BACKEND_ENDPOINT: process.env.NEXT_PUBLIC_BACKEND_ENDPOINT,
  },
};

export default nextConfig;
