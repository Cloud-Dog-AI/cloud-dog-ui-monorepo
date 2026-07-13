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

import * as React from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  Activity,
  BookOpen,
  Bot,
  Boxes,
  FileText,
  FlaskConical,
  FolderOpen,
  History,
  Info,
  Key,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Server,
  Settings,
  Shield,
  Terminal,
  Users,
  Wrench,
} from 'lucide-react';
import { AuthProvider, LoginPage, SessionTimeoutProvider, useAuth } from '@cloud-dog/auth';
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from '@cloud-dog/config';
import { Button } from '@cloud-dog/ui';
import {
  IdamUsersPage,
  IdamGroupsPage,
  IdamApiKeysPage,
  IdamRolesPage,
  IdamRbacPage,
  setIdamTransportAuth,
} from '@cloud-dog/idam';
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
import { manifest } from './manifest';
import { AppStateProvider, useExpertAgentState } from '../state/AppState';
import { AdminPage } from '../views/AdminPage';
import { ApiDocsPage } from '../views/ApiDocsPage';
import { A2aConsolePage } from '../views/A2aConsolePage';
import { ChannelsPage } from '../views/ChannelsPage';
import { ChatPage } from '../views/ChatPage';
import { DashboardPage } from '../views/DashboardPage';
import { ExpertsPage } from '../views/ExpertsPage';
import { FilesPage } from '../views/FilesPage';
import { JobsPage } from '../views/JobsPage';
import { KnowledgePage } from '../views/KnowledgePage';
import { McpConsolePage } from '../views/McpConsolePage';
import { MonitoringPage } from '../views/MonitoringPage';
import { PromptsPage } from '../views/PromptsPage';
// EA-89 (W28E-1863 fix-wave-c): dedicated test-cases surface split out of /prompts.
import { PromptTestCasesPage } from '../views/PromptTestCasesPage';
// EA-27 (W28E-1863 fix-wave-c): dedicated Providers surface (list providers +
// fetch a provider's models). Backend GET /providers + /providers/{id}/models.
import { ProvidersPage } from '../views/ProvidersPage';
import { ServicesPage } from '../views/ServicesPage';
import { SessionsPage } from '../views/SessionsPage';
import { SettingsPage } from '../views/SettingsPage';
// EA-121 (W28E-1863 fix-wave-c): the Testing view was de-navigated (present in
// no navItem) yet still rendered on a direct /testing URL. The orphaned route and
// its import are removed so /testing now falls through the catch-all to "/".

const DISPLAY_VERSION = '0.1.0';

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  WEB_API_BASE_URL: z.string().min(1),
  MCP_BASE_URL: z.string().url().optional(),
  A2A_BASE_URL: z.string().url().optional(),
  AUTH_MODE: z.literal('cookie').optional(),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().optional(),
  APP_VERSION: z.string().optional(),
  PRODUCT_NAME: z.string().optional(),
  PRODUCT_DESCRIPTION: z.string().optional(),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

function isLoginRoute(pathname: string): boolean {
  return pathname === '/login' || pathname === '/web/auth/login';
}

function LegacyMonitoringRedirect() {
  const location = useLocation();
  return <Navigate to={`/audit-log${location.search}`} replace />;
}

function ShellAppChrome(props: {
  children: React.ReactNode;
  aboutOpen: boolean;
  onAboutOpenChange: (open: boolean) => void;
  onSessionTimeout: () => void;
}) {
  const cfg = useConfig<AppRuntimeConfig>();
  const { api } = useExpertAgentState();
  const [liveVersion, setLiveVersion] = React.useState(cfg.APP_VERSION ?? DISPLAY_VERSION);
  const sessionTimeoutMinutes = cfg.SESSION_TIMEOUT_MINUTES ?? 30;
  const sessionWarningMinutes =
    sessionTimeoutMinutes <= 10
      ? Math.max(0.05, Math.min(1, sessionTimeoutMinutes / 2))
      : 5;
  const [services, setServices] = React.useState<ServiceStatus[]>([
    { name: 'API', url: cfg.WEB_API_BASE_URL, status: 'warning' },
    { name: 'MCP', url: cfg.MCP_BASE_URL ?? `${window.location.origin}/mcp`, status: 'warning' },
    { name: 'A2A', url: cfg.A2A_BASE_URL ?? `${window.location.origin}/a2a`, status: 'warning' },
  ]);

  const refreshHealth = React.useCallback(async () => {
    const next: ServiceStatus[] = [
      { name: 'API', url: cfg.WEB_API_BASE_URL, status: 'warning' },
      { name: 'MCP', url: cfg.MCP_BASE_URL ?? `${window.location.origin}/mcp`, status: 'warning' },
      { name: 'A2A', url: cfg.A2A_BASE_URL ?? `${window.location.origin}/a2a`, status: 'warning' },
    ];
    try {
      const health = await api.getHealth();
      const isHealthy = health.status === 'ok' || health.status === 'healthy' || health.status === 'up';
      next[0] = { ...next[0], status: isHealthy ? 'ok' : 'error' };
      if (health.version) setLiveVersion(health.version);
    } catch {
      next[0] = { ...next[0], status: 'error' };
    }
    try {
      const mcpResponse = await fetch(`${cfg.MCP_BASE_URL ?? `${window.location.origin}/mcp`}/health`, { credentials: 'include' });
      next[1] = { ...next[1], status: mcpResponse.ok ? 'ok' : 'warning' };
    } catch {
      next[1] = { ...next[1], status: 'error' };
    }
    try {
      const a2aResponse = await fetch(`${cfg.A2A_BASE_URL ?? `${window.location.origin}/a2a`}/health`, { credentials: 'include' });
      next[2] = { ...next[2], status: a2aResponse.ok ? 'ok' : 'warning' };
    } catch {
      next[2] = { ...next[2], status: 'error' };
    }
    setServices(next);
  }, [api, cfg.A2A_BASE_URL, cfg.MCP_BASE_URL, cfg.WEB_API_BASE_URL]);

  React.useEffect(() => {
    void refreshHealth();
    const timer = window.setInterval(() => { void refreshHealth(); }, 15000);
    return () => window.clearInterval(timer);
  }, [refreshHealth]);

  return (
    <SessionTimeoutProvider
      timeoutMinutes={sessionTimeoutMinutes}
      warningMinutes={sessionWarningMinutes}
      onTimeout={props.onSessionTimeout}
    >
      <div className="space-y-4">
        <ServiceStatusBar services={services} />
        {props.children}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <VersionInfo version={liveVersion} buildDate={new Date().toISOString().slice(0, 10)} />
            <Button type="button" variant="ghost" size="sm" onClick={() => props.onAboutOpenChange(true)}>About</Button>
          </div>
          <CopyrightFooter />
          <span className="text-xs text-muted-foreground">session timeout active</span>
        </div>
        <AboutDialog
          open={props.aboutOpen}
          onOpenChange={props.onAboutOpenChange}
          productName={cfg.PRODUCT_NAME ?? manifest.appName}
          description={
            cfg.PRODUCT_DESCRIPTION ??
            "Multi-interface AI orchestration platform that runs API, Web UI, MCP, and A2A services together; manages experts, channels, sessions, files, knowledge, testing, and analytics with role-based controls."
          }
          companyName="Viewdeck Engineering Limited"
          websiteUrl="https://cloud-dog.net"
          version={liveVersion}
        />
      </div>
    </SessionTimeoutProvider>
  );
}

// W28E-1845: canonical /system/about route (WURL-SYSTEM-ABOUT). Renders the
// shared <AboutPage /> as a PAGE BODY (PS-WEBUI-URL-CANONICAL §11). The
// AboutDialog modal remains supplementary (user menu / footer). The same
// productName/description/companyName/websiteUrl/version the AboutDialog passes
// are rendered here so the About surface is identical as page or modal.
function SystemAboutPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const { api } = useExpertAgentState();
  const [liveVersion, setLiveVersion] = React.useState(cfg.APP_VERSION ?? DISPLAY_VERSION);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const health = await api.getHealth();
        if (!cancelled && health.version) setLiveVersion(health.version);
      } catch {
        /* keep configured/display version on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <AboutPage
      productName={cfg.PRODUCT_NAME ?? manifest.appName}
      description={
        cfg.PRODUCT_DESCRIPTION ??
        "Multi-interface AI orchestration platform that runs API, Web UI, MCP, and A2A services together; manages experts, channels, sessions, files, knowledge, testing, and analytics with role-based controls."
      }
      companyName="Viewdeck Engineering Limited"
      websiteUrl="https://cloud-dog.net"
      version={liveVersion}
      buildDate={new Date().toISOString().slice(0, 10)}
    />
  );
}

function ShellApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  // W28A-876: feed the active API key into the shared IDAM transport (api_key mode).
  setIdamTransportAuth({ apiKey: auth.getAccessToken?.() ?? null });
  const { api } = useExpertAgentState();
  const authReady = !auth.isLoading;
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const timeoutActionRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    timeoutActionRef.current = () => {
      void auth.logout().finally(() => navigate('/login'));
    };
  }, [auth, navigate]);

  const handleSessionTimeout = React.useCallback(() => {
    timeoutActionRef.current();
  }, []);

  const openAbout = React.useCallback(() => {
    setAboutOpen(true);
  }, []);

  React.useEffect(() => {
    document.title = `Cloud-Dog : ${manifest.appName}`;
  }, []);

  React.useEffect(() => {
    if (!authReady) return;
    const onLoginRoute = isLoginRoute(location.pathname);
    if (auth.isAuthenticated && onLoginRoute) navigate('/');
    if (!auth.isAuthenticated && !onLoginRoute) navigate('/login');
  }, [authReady, auth.isAuthenticated, location.pathname, navigate]);

  // W28E-1809C: every nav link is a PS-WEBUI-URL-CANONICAL v1.0 canonical route
  // (WURL-009). Legacy paths are 308-redirected by the web tier and also
  // forward-redirected client-side (see Routes below).
  const navItems: NavItemType[] = [
    {
      label: 'Expert Agent',
      path: '/',
      icon: navIcon(Bot),
      children: [
        { label: 'Dashboard', path: '/', icon: navIcon(LayoutDashboard) },
        { label: 'Experts', path: '/experts', icon: navIcon(Bot) },
        { label: 'Channels', path: '/channels', icon: navIcon(Activity) },
        { label: 'Chat', path: '/chat', icon: navIcon(MessageSquare) },
        { label: 'Sessions', path: '/sessions', icon: navIcon(History) },
        { label: 'Services', path: '/services', icon: navIcon(Server) },
        { label: 'Knowledge', path: '/knowledge', icon: navIcon(BookOpen) },
        { label: 'Files', path: '/files', icon: navIcon(FolderOpen) },
        { label: 'Prompts', path: '/prompts', icon: navIcon(FileText) },
        // EA-89: dedicated generated-test-cases surface.
        { label: 'Test Cases', path: '/prompts/test-cases', icon: navIcon(FlaskConical) },
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
        { label: 'Audit Log', path: '/audit-log', icon: navIcon(Activity) },
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
        // EA-27: dedicated Providers surface (LLM providers + their models).
        { label: 'Providers', path: '/providers', icon: navIcon(Boxes) },
        { label: 'Settings', path: '/system/settings', icon: navIcon(Settings) },
        { label: 'About', path: '/system/about', icon: navIcon(Info), onSelect: openAbout },
      ],
    },
  ];

  if (!authReady) return null;
  if (isLoginRoute(location.pathname)) return <LoginPage appName={manifest.appName} mode="cookie" />;
  if (!auth.isAuthenticated) return <LoginPage appName={manifest.appName} mode="cookie" />;

  return (
    <ShellLayout
      appName={manifest.appName}
      navItems={navItems}
      preset={operationalConsolePreset}
      userMenu={{
        displayName: auth.user?.displayName ?? auth.user?.email ?? 'Operator',
        email: auth.user?.email,
        onAbout: openAbout,
        onProfile: () => setProfileOpen(true),
        onSettings: () => navigate('/system/settings'),
        onLogout: () => auth.logout().then(() => navigate('/login')),
      }}
      homePath="/"
    >
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        links={[
          { label: 'Experts', description: 'Configured agents', onSelect: () => navigate('/experts') },
          { label: 'Channels', description: 'Conversation routes', onSelect: () => navigate('/channels') },
          { label: 'Sessions', description: 'User history', onSelect: () => navigate('/sessions') },
        ]}
        onChangePassword={async ({ currentPassword, newPassword }) => {
          await api.changePassword({ current_password: currentPassword, new_password: newPassword });
        }}
      />
      <ShellAppChrome aboutOpen={aboutOpen} onAboutOpenChange={setAboutOpen} onSessionTimeout={handleSessionTimeout}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/login" element={<LoginPage appName={manifest.appName} mode="cookie" />} />
          <Route path="/web/auth/login" element={<LoginPage appName={manifest.appName} mode="cookie" />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/experts" element={<ExpertsPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/files" element={<FilesPage />} />
          {/* W28E-1809C: PS-WEBUI-URL-CANONICAL v1.0 — /admin/* are the canonical
              IDAM routes (shared @cloud-dog/idam); /idam/* forward-redirect to them. */}
          <Route path="/admin/users" element={<IdamUsersPage apiBaseUrl="/web/api" />} />
          <Route path="/admin/groups" element={<IdamGroupsPage apiBaseUrl="/web/api" />} />
          <Route path="/admin/api-keys" element={<IdamApiKeysPage apiBaseUrl="/web/api" />} />
          <Route path="/admin/roles" element={<IdamRolesPage apiBaseUrl="/web/api" />} />
          <Route path="/admin/rbac" element={<IdamRbacPage apiBaseUrl="/web/api" />} />
          <Route path="/idam/users" element={<Navigate to="/admin/users" replace />} />
          <Route path="/idam/groups" element={<Navigate to="/admin/groups" replace />} />
          <Route path="/idam/api-keys" element={<Navigate to="/admin/api-keys" replace />} />
          <Route path="/idam/roles" element={<Navigate to="/admin/roles" replace />} />
          <Route path="/idam/rbac" element={<Navigate to="/admin/rbac" replace />} />
          {/* W28E-1852: PS-WEBUI-URL-CANONICAL §15 — /prompts is the canonical
              prompt/template family route; legacy /admin/prompts 308-redirects. */}
          <Route path="/prompts" element={<PromptsPage />} />
          <Route path="/admin/prompts" element={<Navigate to="/prompts" replace />} />
          <Route path="/admin/monitoring" element={<LegacyMonitoringRedirect />} />
          <Route path="/admin" element={<AdminPage />} />
          {/* Canonical Audit-Log surface (WURL-AUDIT) — the monitoring/history viewer. */}
          <Route path="/audit-log" element={<MonitoringPage />} />
          <Route path="/audit" element={<Navigate to="/audit-log" replace />} />
          <Route path="/diagnostics-audit" element={<Navigate to="/audit-log" replace />} />
          <Route path="/observability" element={<Navigate to="/audit-log" replace />} />
          <Route path="/logs" element={<Navigate to="/audit-log" replace />} />
          <Route path="/monitoring" element={<Navigate to="/audit-log" replace />} />
          {/* Canonical Developer consoles render the real pages (WURL-DEV-*). */}
          <Route path="/developer/api-docs" element={<ApiDocsPage />} />
          <Route path="/developer/mcp-console" element={<McpConsolePage />} />
          <Route path="/developer/a2a-console" element={<A2aConsolePage />} />
          <Route path="/api-docs" element={<Navigate to="/developer/api-docs" replace />} />
          <Route path="/docs" element={<Navigate to="/developer/api-docs" replace />} />
          <Route path="/openapi" element={<Navigate to="/developer/api-docs" replace />} />
          <Route path="/mcp-console" element={<Navigate to="/developer/mcp-console" replace />} />
          <Route path="/a2a-console" element={<Navigate to="/developer/a2a-console" replace />} />
          {/* EA-121: /testing route removed (the Testing view was de-navigated). */}
          {/* EA-89: dedicated generated-test-cases surface (was inline on /prompts). */}
          <Route path="/prompts/test-cases" element={<PromptTestCasesPage />} />
          {/* EA-27: dedicated Providers surface (list providers + fetch models). */}
          <Route path="/providers" element={<ProvidersPage />} />
          {/* Canonical System routes render the real pages (WURL-SYSTEM-*). */}
          <Route path="/system/jobs" element={<JobsPage />} />
          <Route path="/system/settings" element={<SettingsPage />} />
          <Route path="/system/about" element={<SystemAboutPage />} />
          <Route path="/jobs" element={<Navigate to="/system/jobs" replace />} />
          <Route path="/settings" element={<Navigate to="/system/settings" replace />} />
          <Route path="/admin/settings" element={<Navigate to="/system/settings" replace />} />
          <Route path="/about" element={<Navigate to="/system/about" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ShellAppChrome>
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
          loginPath: '/web/auth/login',
          mePath: '/web/auth/me',
          logoutPath: '/web/auth/logout',
        },
      }}
    >
      <AppStateProvider>
        <ShellApp />
      </AppStateProvider>
    </AuthProvider>
  );
}
