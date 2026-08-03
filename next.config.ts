import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/printoms",
  async redirects() {
    return [
      {
        source: "/",
        destination: "/printoms",
        basePath: false,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
