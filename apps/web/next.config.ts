import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@alice/database", "@alice/shared", "@alice/ingestor", "@alice/source-registry", "@alice/taxonomy"],
  serverExternalPackages: ["pg"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
