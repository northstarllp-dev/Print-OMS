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
  // Note: do NOT use rewrites with `basePath: false` + internal destinations.
  // Next.js only allows that for external http(s) URLs and fails the build
  // with "Invalid rewrites found". Root favicon proxies live in vercel.json.
};

export default nextConfig;
