// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// @cloud-dog/app-file-mcp — Vite configuration.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));

const proxyTarget = process.env.FILE_MCP_API_PROXY_TARGET ?? "http://127.0.0.1:18090";
const runtimeConfigProxyEnabled =
  (process.env.FILE_MCP_RUNTIME_CONFIG_PROXY ?? "true").toLowerCase() !== "false";
const proxyConfig = {
  "^/api(?:/|$)": {
    target: proxyTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ""),
  },
  "^/mcp(?:/|$)": {
    target: proxyTarget,
    changeOrigin: true,
  },
  "^/webmcp(?:/|$)": {
    target: proxyTarget,
    changeOrigin: true,
  },
  "^/a2a(?:/|$)": {
    target: proxyTarget,
    changeOrigin: true,
  },
  "^/(?:health|status|ready|live)$": {
    target: proxyTarget,
    changeOrigin: true,
  },
  "^/auth(?:/|$)": {
    target: proxyTarget,
    changeOrigin: true,
  },
  "^/\\.well-known(?:/|$)": {
    target: proxyTarget,
    changeOrigin: true,
  },
  "/openapi.json": {
    target: proxyTarget,
    changeOrigin: true,
  },
  ...(runtimeConfigProxyEnabled
    ? {
        "/runtime-config.js": {
          target: proxyTarget,
          changeOrigin: true,
        },
      }
    : {}),
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@cloud-dog/shell": resolve(appDir, "../../packages/shell/src/index.ts"),
      "@cloud-dog/ui": resolve(appDir, "../../packages/ui/src/index.ts"),
    },
  },
  server: {
    proxy: proxyConfig,
  },
  preview: {
    proxy: proxyConfig,
  },
});
