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

// @cloud-dog/app-sql-agent — App routes and top-level providers.

// Covers: FR-52
// Covers: FR-53
// Covers: FR-54
// Covers: FR-55
// Covers: FR-56
// Covers: FR-57
// Covers: FR-58
// Covers: FR-59
// Covers: FR-60
// Covers: FR-61
// Covers: FR-62
// Covers: FR-63

import * as React from 'react';
import { Link, Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from '@cloud-dog/config';
import { AuthProvider, LoginPage, SessionTimeoutProvider, useAuth } from '@cloud-dog/auth';
import {
  AboutDialog,
  AboutPage,
  CopyrightFooter,
  ProfileDialog,
  ServiceStatusBar,
  ShellLayout,
  VersionInfo,
  operationalConsolePreset,
  type NavItemType,
  type ServiceStatus,
} from '@cloud-dog/shell';
import { BRAND_NAME } from '@cloud-dog/tokens';
import {
  Activity,
  Database,
  File,
  FileText,
  Info,
  Key,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Settings,
  Shield,
  Table2,
  Terminal,
  Users,
  Wrench,
} from 'lucide-react';
import { manifest } from './manifest';
import { requestJson, useApiResource } from '../lib/sqlAgentApi';
import { QueryPage } from '../views/QueryPage';
import { JobsPage } from '../views/JobsPage';
import { ContextPage } from '../views/ContextPage';
// W28E-1838 §6: bespoke ../views/{Admin,Users,Groups,ApiKeys}Page removed; IDAM uses shared @cloud-dog/idam.
import { McpPage } from '../views/McpPage';
import { A2APage } from '../views/A2APage';
import { StatusPage } from '../views/StatusPage';
import { LogsPage } from '../views/LogsPage';
import { TablesPage } from '../views/TablesPage';
import { ConfigPage } from '../views/ConfigPage';
import { SettingsPage } from '../views/SettingsPage';
import FilesPage from '../views/FilesPage';
import {
  IdamUsersPage,
  IdamGroupsPage,
  IdamApiKeysPage,
  IdamRbacPage,
  IdamRolesPage,
  setIdamTransportAuth,
} from '@cloud-dog/idam';

const DocsPage = React.lazy(async () => import('../views/DocsPage').then((module) => ({ default: module.DocsPage })));

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  MCP_BASE_URL: z.string().url().optional(),
  A2A_BASE_URL: z.string().url().optional(),
  AUTH_MODE: z.literal('cookie').optional(),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().optional(),
  APP_VERSION: z.string().optional(),
  PRODUCT_NAME: z.string().optional(),
  PRODUCT_DESCRIPTION: z.string().optional(),
});

// Canonical product description sourced from sql-agent-mcp-server/README.md (W28A snag #25-15).
const DEFAULT_PRODUCT_DESCRIPTION =
  'Cloud-Dog SQL reasoning service that converts natural-language prompts into validated SQL workflows and exposes equivalent REST, Web UI, MCP, and A2A contracts.';

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

function ShellApp() {
  const cfg = useConfig<AppRuntimeConfig>();
  const loc = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  // W28A-876: feed the active API key into the shared IDAM transport (api_key mode).
  setIdamTransportAuth({ apiKey: auth.getAccessToken?.() ?? null });
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  // W28E-1863 fix-wave-d (WSC-014 / PS-30 UI-R7.3): the /version payload also
  // carries container build provenance (source_commit / build_date) for the
  // shared @cloud-dog/shell AboutPage.
  const versionInfo = useApiResource<{ version?: string; source_commit?: string; commit?: string; build_date?: string }>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/version'),
    [cfg.API_BASE_URL],
  );
  // 25-12 — horizontal ServiceStatusBar (replaces vertical HealthWidget block).
  const [services, setServices] = React.useState<ServiceStatus[]>(() => [
    { name: 'API', url: cfg.API_BASE_URL, status: 'warning' },
    { name: 'MCP', url: cfg.MCP_BASE_URL ?? `${cfg.API_BASE_URL}/api/v1/mcp`, status: 'warning' },
    { name: 'A2A', url: cfg.A2A_BASE_URL ?? `${cfg.API_BASE_URL}/a2a`, status: 'warning' },
  ]);
  React.useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const next: ServiceStatus[] = [
        { name: 'API', url: cfg.API_BASE_URL, status: 'warning' },
        { name: 'MCP', url: cfg.MCP_BASE_URL ?? `${cfg.API_BASE_URL}/api/v1/mcp`, status: 'warning' },
        { name: 'A2A', url: cfg.A2A_BASE_URL ?? `${cfg.API_BASE_URL}/a2a`, status: 'warning' },
      ];
      try {
        await requestJson(cfg.API_BASE_URL, '/api/v1/version');
        next[0] = { ...next[0], status: 'ok' };
      } catch {
        next[0] = { ...next[0], status: 'error' };
      }
      try {
        await requestJson(cfg.API_BASE_URL, '/api/v1/mcp/health');
        next[1] = { ...next[1], status: 'ok' };
      } catch {
        next[1] = { ...next[1], status: 'error' };
      }
      try {
        await requestJson(cfg.API_BASE_URL, '/api/v1/a2a/health');
        next[2] = { ...next[2], status: 'ok' };
      } catch {
        next[2] = { ...next[2], status: 'warning' };
      }
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
    if (auth.isAuthenticated && loc.pathname === '/login') navigate('/');
    if (!auth.isAuthenticated && loc.pathname !== '/login') navigate('/login');
  }, [auth.isAuthenticated, auth.isLoading, loc.pathname, navigate]);

  const navItems: NavItemType[] = [
    {
      label: 'SQL Agent',
      path: '/',
      icon: navIcon(Database),
      children: [
        { label: 'Dashboard', path: '/', icon: navIcon(LayoutDashboard) },
        { label: 'Search', path: '/search', icon: navIcon(MessageSquare) },
        { label: 'Data Context', path: '/context', icon: navIcon(Database) },
        { label: 'Tables', path: '/tables', icon: navIcon(Table2) },
        { label: 'Files', path: '/files', icon: navIcon(File) },
        { label: 'Audit Log', path: '/audit-log', icon: navIcon(Activity) },
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
        { label: 'Roles', path: '/admin/roles', icon: navIcon(Shield) },
        { label: 'RBAC', path: '/admin/rbac', icon: navIcon(Shield) },
      ],
    },
    {
      label: 'Developer',
      path: '/developer/api-docs',
      icon: navIcon(Wrench),
      children: [
        { label: 'API Docs', path: '/developer/api-docs', icon: navIcon(FileText) },
        { label: 'MCP Console', path: '/developer/mcp-console', icon: navIcon(Terminal) },
        { label: 'A2A Console', path: '/developer/a2a-console', icon: navIcon(Radio) },
      ],
    },
    {
      label: 'System',
      path: '/system/jobs',
      icon: navIcon(Activity),
      children: [
        { label: 'Jobs', path: '/system/jobs', icon: navIcon(Layers) },
        { label: 'Settings', path: '/system/settings', icon: navIcon(Settings) },
        { label: 'About', path: '/system/about', icon: navIcon(Info) },
      ],
    },
  ];

  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 text-sm text-slate-600">
        Restoring session...
      </div>
    );
  }
  if (loc.pathname === '/login') return <LoginPage appName={manifest.appName} mode="cookie" />;
  if (!auth.isAuthenticated) return <LoginPage appName={manifest.appName} mode="cookie" />;

  return (
    <SessionTimeoutProvider timeoutMinutes={cfg.SESSION_TIMEOUT_MINUTES ?? 30} warningMinutes={5}>
      <AuthenticatedShell
        aboutOpen={aboutOpen}
        profileOpen={profileOpen}
        cfg={cfg}
        navItems={navItems}
        navigate={navigate}
        services={services}
        setAboutOpen={setAboutOpen}
        setProfileOpen={setProfileOpen}
        version={versionInfo.data?.version ?? cfg.APP_VERSION}
        commitHash={(versionInfo.data?.source_commit ?? versionInfo.data?.commit) || undefined}
        buildDate={versionInfo.data?.build_date || undefined}
        auth={auth}
      />
    </SessionTimeoutProvider>
  );
}

type AuthenticatedShellProps = {
  aboutOpen: boolean;
  profileOpen: boolean;
  cfg: AppRuntimeConfig;
  navItems: NavItemType[];
  navigate: ReturnType<typeof useNavigate>;
  services: ServiceStatus[];
  setAboutOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProfileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  version?: string;
  commitHash?: string;
  buildDate?: string;
  auth: ReturnType<typeof useAuth>;
};

function AuthenticatedShell(props: AuthenticatedShellProps) {
  return (
    <ShellLayout
      appName={manifest.appName}
      navItems={props.navItems}
      preset={operationalConsolePreset}
      userMenu={{
        displayName: props.auth.user?.displayName ?? props.auth.user?.email ?? 'Operator',
        email: props.auth.user?.email,
        onProfile: () => props.setAboutOpen(true),
        onSettings: () => props.navigate('/system/settings'),
        onLogout: () => props.auth.logout().then(() => props.navigate('/login')),
      }}
    >
      <Link
        aria-label="Go to Dashboard"
        className="fixed left-0 top-0 z-10 hidden h-14 w-80 md:block"
        id="shell-home-link"
        to="/"
      />
      <ProfileDialog open={props.profileOpen} onOpenChange={props.setProfileOpen} />
      <div className="space-y-6">
        {/* 25-12 — Horizontal ServiceStatusBar (replaces vertical column health). */}
        <ServiceStatusBar services={props.services} />
        <Routes>
          <Route path="/" element={<StatusPage />} />
          <Route path="/login" element={<LoginPage appName={manifest.appName} mode="cookie" />} />
          <Route path="/home" element={<StatusPage />} />
          <Route path="/search" element={<QueryPage />} />
          <Route path="/query" element={<Navigate to="/search" replace />} />
          <Route path="/sql" element={<Navigate to="/search" replace />} />
          <Route path="/connections" element={<Navigate to="/context" replace />} />
          <Route path="/jobs" element={<Navigate to="/system/jobs" replace />} />
          <Route path="/system/jobs" element={<JobsPage />} />
          <Route path="/context" element={<ContextPage />} />
          <Route path="/tables" element={<TablesPage />} />
          <Route path="/activity" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/audit" element={<Navigate to="/audit-log" replace />} />
          <Route path="/diagnostics-audit" element={<Navigate to="/audit-log" replace />} />
          <Route path="/observability" element={<Navigate to="/audit-log" replace />} />
          <Route path="/logs" element={<Navigate to="/audit-log" replace />} />
          <Route path="/audit-log" element={<LogsPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/settings" element={<Navigate to="/system/settings" replace />} />
          <Route path="/system/settings" element={<SettingsPage />} />
          <Route path="/admin/settings" element={<Navigate to="/system/settings" replace />} />
          <Route path="/docs" element={<Navigate to="/developer/api-docs" replace />} />
          <Route path="/api-docs" element={<Navigate to="/developer/api-docs" replace />} />
          <Route path="/openapi" element={<Navigate to="/developer/api-docs" replace />} />
          <Route
            path="/developer/api-docs"
            element={
              <React.Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading API docs…</div>}>
                <DocsPage />
              </React.Suspense>
            }
          />
          {/* PS-71 canonical IDAM routes — shared @cloud-dog/idam components (W28A-876) */}
          <Route path="/idam/users" element={<Navigate to="/admin/users" replace />} />
          <Route path="/idam/groups" element={<Navigate to="/admin/groups" replace />} />
          <Route path="/idam/api-keys" element={<Navigate to="/admin/api-keys" replace />} />
          <Route path="/idam/roles" element={<Navigate to="/admin/roles" replace />} />
          <Route path="/idam/rbac" element={<Navigate to="/admin/rbac" replace />} />
          {/* W28E-1838 §6: canonical /admin/* IDAM pages use the shared @cloud-dog/idam components (no bespoke). */}
          <Route path="/admin/users" element={<IdamUsersPage apiBaseUrl="/web/api" />} />
          <Route path="/admin/groups" element={<IdamGroupsPage apiBaseUrl="/web/api" />} />
          <Route path="/admin/api-keys" element={<IdamApiKeysPage apiBaseUrl="/web/api" />} />
          <Route path="/admin/roles" element={<IdamRolesPage apiBaseUrl="/web/api" />} />
          <Route path="/admin/rbac" element={<IdamRbacPage apiBaseUrl="/web/api" />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/mcp" element={<Navigate to="/developer/mcp-console" replace />} />
          <Route path="/a2a" element={<Navigate to="/developer/a2a-console" replace />} />
          <Route path="/mcp-console" element={<Navigate to="/developer/mcp-console" replace />} />
          <Route path="/a2a-console" element={<Navigate to="/developer/a2a-console" replace />} />
          <Route path="/console/mcp" element={<Navigate to="/developer/mcp-console" replace />} />
          <Route path="/console/a2a" element={<Navigate to="/developer/a2a-console" replace />} />
          <Route path="/developer/mcp-console" element={<McpPage />} />
          <Route path="/developer/a2a-console" element={<A2APage />} />
          <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
          {/* /system/about route: canonical About surface per W28A #25-15 and PS-WEBUI-URL-CANONICAL.
              W28E-1845 / §11: renders the shared @cloud-dog/shell AboutPage; the service-specific
              API endpoint, authentication mode, and runtime health grid are preserved (no-loss)
              via the serviceProfile / extra extension slots. /about 308s here. */}
          <Route path="/about" element={<Navigate to="/system/about" replace />} />
          <Route
            path="/system/about"
            element={
              <AboutPage
                productName={props.cfg.PRODUCT_NAME ?? manifest.appName}
                description={props.cfg.PRODUCT_DESCRIPTION ?? DEFAULT_PRODUCT_DESCRIPTION}
                companyName="Viewdeck Engineering Limited"
                websiteUrl="https://cloud-dog.net"
                version={props.version ?? props.cfg.APP_VERSION}
                commitHash={props.commitHash}
                buildDate={props.buildDate}
                serviceProfile={
                  <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-slate-500">Service</dt>
                      <dd className="font-medium text-slate-950">
                        {props.cfg.PRODUCT_NAME ?? manifest.appName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Version</dt>
                      <dd className="font-medium text-slate-950">
                        {props.version ?? props.cfg.APP_VERSION ?? 'unknown'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">API</dt>
                      <dd className="break-all font-medium text-slate-950">{props.cfg.API_BASE_URL}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Authentication</dt>
                      <dd className="font-medium text-slate-950">{props.cfg.AUTH_MODE ?? 'cookie'}</dd>
                    </div>
                  </dl>
                }
                extra={
                  <div className="grid gap-3 md:grid-cols-3" aria-label="Runtime health">
                    {props.services.map((service) => (
                      <div key={service.name} className="rounded-lg border border-slate-200 p-4">
                        <p className="text-sm font-medium text-slate-950">{service.name}</p>
                        <p className="mt-1 text-xs uppercase text-slate-500">{service.status}</p>
                      </div>
                    ))}
                  </div>
                }
              />
            }
          />
        </Routes>
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-col gap-2 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
            <VersionInfo version={props.version} />
            <button
              type="button"
              onClick={() => props.setAboutOpen(true)}
              className="text-xs font-medium text-primary underline self-start md:self-auto"
              data-testid="footer-about-trigger"
            >
              About
            </button>
          </div>
          <CopyrightFooter className="px-0 py-0" />
          <span className="text-xs text-slate-600">Session timeout: 30 min</span>
        </div>
      </div>
      <AboutDialog
        open={props.aboutOpen}
        onOpenChange={props.setAboutOpen}
        productName={props.cfg.PRODUCT_NAME ?? manifest.appName}
        description={props.cfg.PRODUCT_DESCRIPTION ?? DEFAULT_PRODUCT_DESCRIPTION}
        companyName="Viewdeck Engineering Limited"
        version={props.version}
        websiteUrl="https://cloud-dog.net"
      />
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
          refreshPath: '/auth/me',
        },
      }}
    >
      <ShellApp />
    </AuthProvider>
  );
}
