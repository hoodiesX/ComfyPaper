import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: "/demo/**"
      }
    ]
  }
};

export default nextConfig;
