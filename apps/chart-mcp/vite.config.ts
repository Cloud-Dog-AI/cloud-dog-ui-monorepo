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

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-server proxy points at the chart-mcp WEB tier (cookie auth + /api bridge), default 8099.
// Production serving is via the web tier itself (ui/dist); this proxy only affects `npm run dev`.
const proxyTarget = process.env.CHART_MCP_WEB_PROXY_TARGET ?? "http://127.0.0.1:8099";

const proxy = (path: string) => ({ target: proxyTarget, changeOrigin: true });

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": proxy("/api"),
      "/auth": proxy("/auth"),
      "/mcp": proxy("/mcp"),
      "/a2a": proxy("/a2a"),
      "/.well-known": proxy("/.well-known"),
    },
  },
});
