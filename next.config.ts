import type { NextConfig } from "next";

const githubPagesBasePath = process.env.GITHUB_PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: githubPagesBasePath || undefined,
  assetPrefix: githubPagesBasePath || undefined,
};

export default nextConfig;
