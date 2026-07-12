import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Google-derived enrichment (ratings, review excerpts) is fetched at request
  // time and never permanently republished — see CLAUDE.md §12.3 and §31.1.
};

export default nextConfig;
