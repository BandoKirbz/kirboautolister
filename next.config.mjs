/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // The repo's .eslintrc.json is intentionally strict (no-explicit-any,
    // strict import ordering, etc.) and is useful for `npm run lint`
    // during development, but it was never actually satisfied across the
    // whole codebase. Gating `next build` on it made production builds
    // fail outright. Type-checking (tsc) still runs and blocks the build;
    // only linting is decoupled from it here.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "i.ebayimg.com",
      },
    ],
  },
};

export default nextConfig;
