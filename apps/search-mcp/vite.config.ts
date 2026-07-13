// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-server proxy points at the search-mcp service (FastAPI) on its default port.
// Production serving is via `search-mcp-server/ui/dist/` mounted by the service.
const proxyTarget = process.env.SEARCH_MCP_API_PROXY_TARGET ?? "http://127.0.0.1:9557";
const proxy = (_path: string) => ({ target: proxyTarget, changeOrigin: true });

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": proxy("/api"),
      "/v1": proxy("/v1"),
      "/auth": proxy("/auth"),
      "/mcp": proxy("/mcp"),
      "/a2a": proxy("/a2a"),
      "/.well-known": proxy("/.well-known"),
      "/health": proxy("/health"),
    },
  },
});
