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

// @cloud-dog/app-notification-agent — App routes and top-level providers.
// Covers: FR1.27, FR1.31, FR1.32

import * as React from 'react';
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from '@cloud-dog/config';
import { AuthProvider, LoginPage, SessionTimeoutProvider, useAuth } from '@cloud-dog/auth';
import { AboutDialog, CopyrightFooter, ProfileDialog, ServiceStatusBar, ShellLayout, operationalConsolePreset } from '@cloud-dog/shell';
import type { NavItemType, ServiceStatus } from '@cloud-dog/shell';
import { BRAND_NAME } from '@cloud-dog/tokens';
import {
  Activity,
  Antenna,
  Bell,
  FileText,
  Info,
  Key,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Send,
  Settings,
  Shield,
  Terminal,
  Users,
  Wrench,
} from 'lucide-react';
import { manifest } from './manifest';
import { DashboardPage } from '../views/DashboardPage';
import { UsersPage } from '../views/UsersPage';
import { GroupsPage } from '../views/GroupsPage';
import { ChannelsPage } from '../views/ChannelsPage';
import { MessagesPage } from '../views/MessagesPage';
import { DeliveriesPage } from '../views/DeliveriesPage';
import { JobsPage } from '../views/JobsPage';
import { SettingsPage } from '../views/SettingsPage';
import { ApiKeysPage } from '../views/ApiKeysPage';
import { PromptsPage } from '../views/PromptsPage';
import { MonitoringPage } from '../views/MonitoringPage';
import { McpConsolePage } from '../views/McpConsolePage';
import { A2aConsolePage } from '../views/A2aConsolePage';
import { ApiDocsPage } from '../views/ApiDocsPage';
import { RbacPage } from '../views/RbacPage';
import { LegacyRoutePage } from '../views/LegacyRoutePage';
import { AppStateProvider } from '../state/AppState';

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  MCP_BASE_URL: z.string().url().optional(),
  A2A_BASE_URL: z.string().url().optional(),
  MCP_JSONRPC_PATH: z.string().min(1).optional(),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().optional(),
  AUTH_MODE: z.enum(['cookie', 'oidc']).optional(),
  OIDC_ISSUER: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().min(1).optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  OIDC_SCOPE: z.string().min(1).optional(),
  APP_VERSION: z.string().optional(),
  PRODUCT_NAME: z.string().optional(),
  PRODUCT_DESCRIPTION: z.string().optional(),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon className="h-4 w-4" />;

function shouldUseSameOriginCookieBase(configuredBaseUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const configured = new URL(configuredBaseUrl);
    const current = new URL(window.location.origin);
    const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);
    return (
      configured.protocol === current.protocol &&
      localHostnames.has(configured.hostname) &&
      localHostnames.has(current.hostname) &&
      configured.host !== current.host
    );
  } catch {
    return false;
  }
}

function ShellApp(props: { authMode: 'cookie' | 'oidc' }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const cfg = useConfig<AppRuntimeConfig>();
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);

  const [services, setServices] = React.useState<ServiceStatus[]>(() => [
    { name: 'API', url: cfg.API_BASE_URL, status: 'unknown' },
    { name: 'MCP', url: cfg.MCP_BASE_URL || '', status: 'unknown' },
    { name: 'A2A', url: cfg.A2A_BASE_URL || '', status: 'unknown' },
  ]);

  React.useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const next: ServiceStatus[] = [
        { name: 'API', url: cfg.API_BASE_URL, status: 'warning' },
        { name: 'MCP', url: cfg.MCP_BASE_URL || '', status: 'warning' },
        { name: 'A2A', url: cfg.A2A_BASE_URL || '', status: 'warning' },
      ];
      try {
        const res = await fetch(`${cfg.API_BASE_URL}/health`, { credentials: 'same-origin' });
        next[0] = { ...next[0], status: res.ok ? 'ok' : 'error' };
      } catch { next[0] = { ...next[0], status: 'error' }; }
      const mcpBase = cfg.MCP_BASE_URL || '';
      if (mcpBase) {
        try {
          const res = await fetch(`${mcpBase}/health`, { credentials: 'same-origin' });
          next[1] = { ...next[1], status: res.ok ? 'ok' : 'error' };
        } catch { next[1] = { ...next[1], status: 'error' }; }
      } else { next[1] = { ...next[1], status: 'warning' }; }
      const a2aBase = cfg.A2A_BASE_URL || '';
      if (a2aBase) {
        try {
          const res = await fetch(`${a2aBase}/health`, { credentials: 'same-origin' });
          next[2] = { ...next[2], status: res.ok ? 'ok' : 'error' };
        } catch { next[2] = { ...next[2], status: 'error' }; }
      } else { next[2] = { ...next[2], status: 'warning' }; }
      if (!cancelled) setServices(next);
    };
    void probe();
    const id = window.setInterval(() => { void probe(); }, 15000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [cfg.API_BASE_URL, cfg.MCP_BASE_URL, cfg.A2A_BASE_URL]);

  React.useEffect(() => {
    document.title = `${BRAND_NAME} : ${manifest.appName}`;
  }, []);

  React.useEffect(() => {
    if (auth.isLoading) return;
    if (auth.isAuthenticated && loc.pathname === '/login') navigate('/', { replace: true });
    if (!auth.isAuthenticated && loc.pathname !== '/login') navigate('/login');
  }, [auth.isAuthenticated, auth.isLoading, loc.pathname, navigate]);

  const navItems: NavItemType[] = [
    {
      label: 'Notification Agent',
      path: '/',
      icon: navIcon(Bell),
      children: [
        { label: 'Dashboard', path: '/', icon: navIcon(LayoutDashboard) },
        { label: 'Channels', path: '/channels', icon: navIcon(Bell) },
        { label: 'Messages', path: '/messages', icon: navIcon(MessageSquare) },
        { label: 'Deliveries', path: '/deliveries', icon: navIcon(Send) },
        { label: 'Prompts', path: '/prompts', icon: navIcon(FileText) },
        { label: 'Monitoring', path: '/monitoring', icon: navIcon(Activity) },
      ],
    },
    {
      label: 'Admin',
      path: '/admin/users',
      icon: navIcon(Users),
      children: [
        { label: 'Users', path: '/admin/users', icon: navIcon(Users) },
        { label: 'Groups', path: '/admin/groups', icon: navIcon(Users) },
        { label: 'API Keys', path: '/admin/api-keys', icon: navIcon(Key) },
        { label: 'RBAC', path: '/admin/rbac', icon: navIcon(Shield) },
      ],
    },
    {
      label: 'Developer',
      path: '/api-docs',
      icon: navIcon(Wrench),
      children: [
        { label: 'API Docs', path: '/api-docs', icon: navIcon(FileText) },
        { label: 'MCP Console', path: '/mcp-console', icon: navIcon(Terminal) },
        { label: 'A2A Console', path: '/a2a-console', icon: navIcon(Antenna) },
      ],
    },
    {
      label: 'System',
      path: '/jobs',
      icon: navIcon(Activity),
      children: [
        { label: 'Jobs', path: '/jobs', icon: navIcon(Layers) },
        { label: 'Settings', path: '/settings', icon: navIcon(Settings) },
        { label: 'About', path: '/about', icon: navIcon(Info) },
      ],
    },
  ];

  if (loc.pathname === '/login') {
    return <LoginPage appName={manifest.appName} mode={props.authMode} />;
  }
  if (auth.isLoading) {
    return null;
  }
  if (!auth.isAuthenticated) {
    return <LoginPage appName={manifest.appName} mode={props.authMode} />;
  }

  return (
    <>
    <ShellLayout
      appName={manifest.appName}
      navItems={navItems}
      preset={operationalConsolePreset}
      homePath="/"
      userMenu={{
        displayName: auth.user?.displayName ?? 'DEV',
        email: auth.user?.email,
        onProfile: () => setProfileOpen(true),
        onSettings: () => navigate('/settings'),
        onLogout: () => auth.logout().then(() => navigate('/login')),
      }}
    >
      <ServiceStatusBar services={services} />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/db/users" element={<UsersPage />} />
        <Route path="/admin/users/add" element={<UsersPage />} />
        <Route path="/admin/users/:userId/view" element={<UsersPage />} />
        <Route path="/admin/users/:userId/edit" element={<UsersPage />} />
        <Route path="/admin/groups" element={<GroupsPage />} />
        <Route path="/db/groups" element={<GroupsPage />} />
        <Route path="/admin/groups/add" element={<GroupsPage />} />
        <Route path="/admin/groups/:groupId/edit" element={<GroupsPage />} />
        <Route path="/admin/groups/:groupId/assign-owner" element={<GroupsPage />} />
        <Route path="/channels" element={<ChannelsPage />} />
        <Route path="/db/channels" element={<ChannelsPage />} />
        <Route path="/channels/add" element={<ChannelsPage />} />
        <Route path="/channels/:channelId/edit" element={<ChannelsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/db/messages" element={<MessagesPage />} />
        <Route path="/messages/:messageId" element={<MessagesPage />} />
        <Route path="/deliveries" element={<DeliveriesPage />} />
        <Route path="/db/deliveries" element={<DeliveriesPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/prompts" element={<PromptsPage />} />
        <Route path="/prompts/:promptId/edit" element={<PromptsPage />} />
        <Route path="/prompts/add" element={<PromptsPage />} />
        <Route path="/db/prompts" element={<PromptsPage />} />
        <Route path="/admin/api-keys" element={<ApiKeysPage />} />
        <Route path="/admin/rbac" element={<RbacPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/*
          /about route now opens the canonical AboutDialog modal (per W28A #33
          §3.E + W28A #38 §6). The previous bespoke <Card> implementation was
          removed; AboutDialog is the single platform-wide About surface.
        */}
        <Route
          path="/about"
          element={<AboutRoute onOpen={() => setAboutOpen(true)} />}
        />
        <Route path="/monitoring" element={<MonitoringPage />} />
        <Route path="/api-docs" element={<ApiDocsPage />} />
        <Route path="/mcp-console" element={<McpConsolePage />} />
        <Route path="/a2a-console" element={<A2aConsolePage />} />
        <Route path="/storage" element={<SettingsPage />} />
        <Route path="/logs" element={<MonitoringPage />} />
        <Route path="/mcp-logs" element={<MonitoringPage />} />
        <Route path="/web-api-docs" element={<ApiDocsPage />} />
        <Route path="/db/config" element={<SettingsPage />} />
        <Route path="/web-mcp-test" element={<McpConsolePage />} />
        <Route path="/llm-test" element={<SettingsPage />} />
        <Route path="/services" element={<MonitoringPage />} />
        <Route path="/status" element={<MonitoringPage />} />
        <Route path="*" element={<LegacyRoutePage />} />
      </Routes>
      <CopyrightFooter />
      <div className="px-3 pb-1 text-xs text-muted-foreground">version v{cfg.APP_VERSION ?? '0.1.0'} | session timeout {cfg.SESSION_TIMEOUT_MINUTES ?? 30}m</div>
    </ShellLayout>
    <AboutDialog
      open={aboutOpen}
      onOpenChange={setAboutOpen}
      productName={cfg.PRODUCT_NAME ?? manifest.appName}
      description={
        cfg.PRODUCT_DESCRIPTION ??
        'Multi-channel notification platform composed of four servers (API/REST, MCP, A2A, Web UI/Admin); accepts requests to notify users across email, SMS, WhatsApp, and chat with LLM-formatted content.'
      }
      companyName="Viewdeck Engineering Limited"
      websiteUrl="https://cloud-dog.net"
      version={cfg.APP_VERSION}
    />
    <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

// Route stub: opens the canonical AboutDialog modal then redirects to home,
// preserving the historical `/about` URL while routing through the platform
// surface. Bespoke <Card> implementation removed per W28A #38 (cross-service
// consistency: AboutDialog modal is the canonical About surface).
function AboutRoute({ onOpen }: { onOpen: () => void }) {
  React.useEffect(() => {
    onOpen();
  }, [onOpen]);
  return <Navigate to="/" replace />;
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
  const authMode = cfg.AUTH_MODE ?? 'cookie';
  const sessionTimeoutMinutes = cfg.SESSION_TIMEOUT_MINUTES ?? 30;
  const sessionWarningMinutes = Math.min(5, Math.max(1 / 60, sessionTimeoutMinutes / 2));
  const authApiBaseUrl =
    authMode === 'cookie' && shouldUseSameOriginCookieBase(cfg.API_BASE_URL)
      ? window.location.origin
      : cfg.API_BASE_URL;

  const oidc =
    authMode === 'oidc' &&
    cfg.OIDC_ISSUER &&
    cfg.OIDC_CLIENT_ID &&
    cfg.OIDC_REDIRECT_URI &&
    cfg.OIDC_SCOPE
      ? {
          issuer: cfg.OIDC_ISSUER,
          clientId: cfg.OIDC_CLIENT_ID,
          redirectUri: cfg.OIDC_REDIRECT_URI,
          scope: cfg.OIDC_SCOPE,
        }
      : undefined;

  return (
    <AuthProvider
      config={{
        mode: authMode,
        apiBaseUrl: authApiBaseUrl,
        cookie: {
          loginPath: '/auth/login',
          mePath: '/auth/me',
          logoutPath: '/auth/logout',
          refreshPath: '/auth/refresh',
        },
        oidc,
      }}
    >
      <SessionTimeoutProvider timeoutMinutes={sessionTimeoutMinutes} warningMinutes={sessionWarningMinutes}>
        <AppStateProvider>
          <ShellApp authMode={authMode} />
        </AppStateProvider>
      </SessionTimeoutProvider>
    </AuthProvider>
  );
}
