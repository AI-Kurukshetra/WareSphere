import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(configDir, "../..");

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot
  }
};

export default nextConfig;
