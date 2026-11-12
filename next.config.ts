import type { NextConfig } from "next";
import { resolveApiProxyTarget } from "./lib/proxy-target.ts";

// The browser calls same-origin /api/... and this rewrite proxies it to the backend (on Vercel, an external
// rewrite), so the HTTP-only SameSite=Strict refresh cookie is first-party. Throws, failing `next build`,
// when a production build has no API_PROXY_TARGET.
const apiProxyTarget = resolveApiProxyTarget(process.env);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` }];
  },
};

export default nextConfig;
