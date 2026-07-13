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

// @cloud-dog/app-notification-agent — Vite configuration.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxyTarget = process.env.NOTIFICATION_AGENT_API_PROXY_TARGET ?? 'http://127.0.0.1:8020';
const runtimeConfigProxyEnabled =
  (process.env.NOTIFICATION_AGENT_RUNTIME_CONFIG_PROXY ?? 'true').toLowerCase() !== 'false';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@cloud-dog/ui'],
  },
  server: {
    proxy: {
      '/api/': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/auth': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/webapi': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/health': {
        target: proxyTarget,
        changeOrigin: true,
      },
      ...(runtimeConfigProxyEnabled
        ? {
            '/runtime-config.js': {
              target: proxyTarget,
              changeOrigin: true,
            },
          }
        : {}),
    },
  },
});
