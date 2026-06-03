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

// @cloud-dog/app-index-retriever — Vite configuration.

import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxyTarget = process.env.INDEX_RETRIEVER_API_PROXY_TARGET ?? "http://127.0.0.1:8686";
const a2aProxyTarget = process.env.INDEX_RETRIEVER_A2A_PROXY_TARGET ?? proxyTarget;
const appIndexHtmlPath = fileURLToPath(new URL("./index.html", import.meta.url));
const distIndexHtmlPath = fileURLToPath(new URL("./dist/index.html", import.meta.url));
const spaRoutePaths = new Set([
  "/security",
  "/admin",
  "/admin/users",
  "/admin/groups",
  "/admin/api-keys",
  "/admin/rbac",
]);
const proxyEntries = Object.fromEntries(
  [
    "/api",
    "/app",
    "/admin",
    "/auth",
    "/mcp",
    "/health",
    "/status",
    "/docs",
    "/redoc",
  ].map((prefix) => [`^${prefix}(?:/|$)`, { target: proxyTarget, changeOrigin: true }])
);
const a2aProxyEntries = {
  "^/a2a/\\.well-known(?:/|$)": {
    target: a2aProxyTarget,
    changeOrigin: true,
    rewrite: (requestPath: string) => requestPath.replace(/^\/a2a/, ""),
  },
  "^/a2a(?:/|$)": { target: a2aProxyTarget, changeOrigin: true },
};

function resolveRequestPath(url: string | undefined): string {
  return (url ?? "/").split("?")[0] ?? "/";
}

function indexRetrieverSpaRoutes() {
  return {
    name: "index-retriever-spa-routes",
    configureServer(server: {
      middlewares: {
        use: (handler: (req: { method?: string; url?: string }, res: { setHeader: (name: string, value: string) => void; end: (body: string) => void }, next: () => void) => void | Promise<void>) => void;
      };
      transformIndexHtml: (url: string, html: string) => Promise<string>;
    }) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET") {
          next();
          return;
        }

        const pathname = resolveRequestPath(req.url);
        if (!spaRoutePaths.has(pathname)) {
          next();
          return;
        }

        const html = await fs.readFile(appIndexHtmlPath, "utf8");
        const transformed = await server.transformIndexHtml(pathname, html);
        res.setHeader("Content-Type", "text/html");
        res.end(transformed);
      });
    },
    configurePreviewServer(server: {
      middlewares: {
        use: (handler: (req: { method?: string; url?: string }, res: { setHeader: (name: string, value: string) => void; end: (body: string) => void }, next: () => void) => void | Promise<void>) => void;
      };
    }) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET") {
          next();
          return;
        }

        const pathname = resolveRequestPath(req.url);
        if (!spaRoutePaths.has(pathname)) {
          next();
          return;
        }

        const html = await fs.readFile(distIndexHtmlPath, "utf8");
        res.setHeader("Content-Type", "text/html");
        res.end(html);
      });
    },
  };
}

export default defineConfig({
  plugins: [indexRetrieverSpaRoutes(), react()],
  server: {
    proxy: {
      ...proxyEntries,
      ...a2aProxyEntries,
      "/openapi.json": { target: proxyTarget, changeOrigin: true },
      "/runtime-config.js": { target: proxyTarget, changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      ...proxyEntries,
      ...a2aProxyEntries,
      "/openapi.json": { target: proxyTarget, changeOrigin: true },
      "/runtime-config.js": { target: proxyTarget, changeOrigin: true },
    },
  },
});
