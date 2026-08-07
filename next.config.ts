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
  async rewrites() {
    // Vercel project avatars scrape the deployment root (/favicon.ico), which
    // sits outside basePath. Proxy those requests to the active client brand.
    return {
      beforeFiles: [
        {
          source: "/favicon.ico",
          destination: "/printoms/api/favicon",
          basePath: false,
        },
        {
          source: "/apple-touch-icon.png",
          destination: "/printoms/api/apple-touch-icon",
          basePath: false,
        },
        {
          source: "/apple-touch-icon-precomposed.png",
          destination: "/printoms/api/apple-touch-icon",
          basePath: false,
        },
      ],
    };
  },
};

export default nextConfig;
