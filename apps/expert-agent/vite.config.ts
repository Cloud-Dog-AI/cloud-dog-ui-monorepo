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

// @cloud-dog/app-expert-agent — Vite configuration.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const webTarget = process.env.EXPERT_AGENT_WEB_PROXY_TARGET ?? 'http://127.0.0.1:8031';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: webTarget,
        changeOrigin: true,
        secure: false,
      },
      '/runtime-config.js': {
        target: webTarget,
        changeOrigin: true,
      },
      '/web/api': {
        target: webTarget,
        changeOrigin: true,
      },
      '/web/auth': {
        target: webTarget,
        changeOrigin: true,
      },
      '/mcp': {
        target: webTarget,
        changeOrigin: true,
      },
      '/a2a': {
        target: webTarget,
        changeOrigin: true,
      },
    },
  },
});
