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

// @cloud-dog/app-console — App routes and top-level providers.

import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import { ShellLayout } from '@cloud-dog/shell';
import type { NavItemType } from '@cloud-dog/shell';
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from '@cloud-dog/config';
import { AuthProvider, LoginPage, useAuth } from '@cloud-dog/auth';
import { BRAND_NAME } from '@cloud-dog/tokens';
import { z } from 'zod';
import { TestConsolePage } from '../views/TestConsolePage';
import { LogsPage } from '../views/LogsPage';
import { JobsPage } from '../views/JobsPage';
import { ConfigPage } from '../views/ConfigPage';
import { DepsPage } from '../views/DepsPage';
import { manifest } from './manifest';

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  MCP_BASE_URL: z.string().url().optional(),
  A2A_BASE_URL: z.string().url().optional(),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

function ShellApp() {
  const cfg = useConfig<AppRuntimeConfig>();
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();

  React.useEffect(() => {
    document.title = `${BRAND_NAME} : ${manifest.appName}`;
  }, []);

  const navItems: NavItemType[] = [
    {
      label: 'Core',
      path: '#',
      icon: <span aria-hidden="true">C</span>,
      children: [
        { label: 'Test Console', path: '/', icon: <span aria-hidden="true">T</span> },
        { label: 'Dependencies', path: '/deps', icon: <span aria-hidden="true">D</span> },
      ],
    },
    {
      label: 'Admin',
      path: '#',
      icon: <span aria-hidden="true">A</span>,
      children: [
        {
          label: 'Logs',
          path: '/admin/logs',
          icon: <span aria-hidden="true">L</span>,
        },
        {
          label: 'Jobs',
          path: '/admin/jobs',
          icon: <span aria-hidden="true">J</span>,
        },
        {
          label: 'Settings',
          path: '/admin/config',
          icon: <span aria-hidden="true">S</span>,
        },
      ],
    },
  ];

  if (location.pathname === '/login') return <LoginPage />;

  return (
    <ShellLayout
      appName={manifest.appName}
      navItems={navItems}
      userMenu={{
        displayName: auth.user?.displayName ?? 'DEV',
        email: auth.user?.email,
        onSettings: () => navigate('/admin/config'),
        onLogout: auth.isAuthenticated ? () => auth.logout() : () => navigate('/login'),
      }}
    >
      <Routes>
        <Route path="/" element={<TestConsolePage />} />
        <Route path="/deps" element={<DepsPage />} />
        <Route path="/admin/logs" element={<LogsPage />} />
        <Route path="/admin/jobs" element={<JobsPage />} />
        <Route path="/admin/config" element={<ConfigPage />} />
      </Routes>
    </ShellLayout>
  );
}

export function App() {
  return (
    <ConfigProvider schema={AppRuntimeConfigSchema}>
      <AppWithProviders />
    </ConfigProvider>
  );
}

function AppWithProviders() {
  const cfg = useConfig<AppRuntimeConfig>();
  return (
    <AuthProvider
      config={{
        mode: 'cookie',
        apiBaseUrl: cfg.API_BASE_URL,
        cookie: {
          loginPath: '/auth/login',
          mePath: '/auth/me',
          logoutPath: '/auth/logout',
          refreshPath: '/auth/refresh',
        },
      }}
    >
      <ShellApp />
    </AuthProvider>
  );
}
