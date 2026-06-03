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

// @cloud-dog/app-git-mcp — Vite configuration.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const apiTarget = process.env.GIT_MCP_API_PROXY_TARGET ?? "http://127.0.0.1:18585";
const mcpTarget = process.env.GIT_MCP_MCP_PROXY_TARGET ?? "http://127.0.0.1:18586";
const a2aTarget = process.env.GIT_MCP_A2A_PROXY_TARGET ?? "http://127.0.0.1:18587";

const proxy = {
  "/git-api": {
    target: apiTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/git-api/, ""),
  },
  "/git-mcp": {
    target: mcpTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/git-mcp/, ""),
  },
  "/git-a2a": {
    target: a2aTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/git-a2a/, ""),
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@cloud-dog/api-client": fileURLToPath(new URL("../../packages/api-client/src/index.ts", import.meta.url)),
      "@cloud-dog/auth": fileURLToPath(new URL("../../packages/auth/src/index.ts", import.meta.url)),
      "@cloud-dog/config": fileURLToPath(new URL("../../packages/config/src/index.ts", import.meta.url)),
      "@cloud-dog/shell": fileURLToPath(new URL("../../packages/shell/src/index.ts", import.meta.url)),
      "@cloud-dog/testing": fileURLToPath(new URL("../../packages/testing/src/index.ts", import.meta.url)),
      "@cloud-dog/tokens": fileURLToPath(new URL("../../packages/tokens/src/index.ts", import.meta.url)),
      "@cloud-dog/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url)),
    },
  },
  server: {
    proxy,
  },
  preview: {
    proxy,
  },
});
