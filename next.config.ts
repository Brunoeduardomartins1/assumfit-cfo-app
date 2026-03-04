import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react", "@/components/ui"],
  },
};

export default nextConfig;
