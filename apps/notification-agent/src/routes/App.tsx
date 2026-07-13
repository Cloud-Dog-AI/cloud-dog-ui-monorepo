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
import { AboutDialog, AboutPage, CopyrightFooter, ProfileDialog, ServiceStatusBar, ShellLayout, operationalConsolePreset } from '@cloud-dog/shell';
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
// W28E-1838 §6: bespoke ../views/UsersPage + GroupsPage removed; IDAM uses shared @cloud-dog/idam.
import { ChannelsPage } from '../views/ChannelsPage';
import { MessagesPage } from '../views/MessagesPage';
import { DeliveriesPage } from '../views/DeliveriesPage';
import { JobsPage } from '../views/JobsPage';
import { SettingsPage } from '../views/SettingsPage';
import { PromptsPage } from '../views/PromptsPage';
import { MonitoringPage } from '../views/MonitoringPage';
import { McpConsolePage } from '../views/McpConsolePage';
import { A2aConsolePage } from '../views/A2aConsolePage';
import { ApiDocsPage } from '../views/ApiDocsPage';
// IDAM Roles/RBAC/Users/Groups/API-keys are served by the shared @cloud-dog/idam
// pages below (W28A-876 §6). The bespoke RolesPage/RbacPage forks were deleted
// (W28A-885 §1.4); the unmounted ApiKeysPage legacy view remains on disk.
import { LegacyRoutePage } from '../views/LegacyRoutePage';
import {
  IdamUsersPage,
  IdamGroupsPage,
  IdamApiKeysPage,
  IdamRolesPage,
  IdamRbacPage,
  setIdamTransportAuth,
} from '@cloud-dog/idam';
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

function CanonicalRedirect(props: { to: string }) {
  const loc = useLocation();
  return <Navigate to={`${props.to}${loc.search}${loc.hash}`} replace />;
}

const canonicalAliasTargets: Readonly<Record<string, string>> = {
  '/idam/users': '/admin/users',
  '/idam/groups': '/admin/groups',
  '/idam/api-keys': '/admin/api-keys',
  '/idam/roles': '/admin/roles',
  '/idam/rbac': '/admin/rbac',
  '/api-keys': '/admin/api-keys',
  '/apikeys': '/admin/api-keys',
  '/rbac': '/admin/rbac',
  '/jobs': '/system/jobs',
  '/settings': '/system/settings',
  '/about': '/system/about',
  '/audit': '/audit-log',
  '/observability': '/audit-log',
  '/monitoring': '/audit-log',
  '/diagnostics-audit': '/audit-log',
  '/logs': '/audit-log',
  '/api-docs': '/developer/api-docs',
  '/docs': '/developer/api-docs',
  '/openapi': '/developer/api-docs',
  '/mcp-console': '/developer/mcp-console',
  '/a2a-console': '/developer/a2a-console',
  '/storage': '/system/settings',
  '/mcp-logs': '/audit-log',
  '/web-api-docs': '/developer/api-docs',
  '/db/config': '/system/settings',
  '/web-mcp-test': '/developer/mcp-console',
  '/llm-test': '/system/settings',
  '/services': '/audit-log',
  '/status': '/audit-log',
};

function ShellApp(props: { authMode: 'cookie' | 'oidc' }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  // W28A-876: feed the active API key into the shared IDAM transport (api_key mode).
  setIdamTransportAuth({ apiKey: auth.getAccessToken?.() ?? null });
  const cfg = useConfig<AppRuntimeConfig>();
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  // XC-001: footer + About version sourced from the live container GET /version,
  // falling back to the build-baked config value and finally 'unknown'.
  const [liveVersion, setLiveVersion] = React.useState<string>('');
  // W28E-1863 fix-wave-d (WSC-014 / PS-30 UI-R7.3): container build provenance for
  // the shared @cloud-dog/shell AboutPage (from the live GET /version payload).
  const [buildIdentity, setBuildIdentity] = React.useState<{ commitHash?: string; buildDate?: string }>({});

  React.useEffect(() => {
    let cancelled = false;
    const loadVersion = async () => {
      try {
        const res = await fetch(`${cfg.API_BASE_URL}/version`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          version?: string;
          source_commit?: string;
          commit?: string;
          build_date?: string;
        };
        if (cancelled || !data) return;
        if (data.version) setLiveVersion(String(data.version));
        const commitHash = String(data.source_commit ?? data.commit ?? '').trim();
        const buildDate = String(data.build_date ?? '').trim();
        setBuildIdentity({
          commitHash: commitHash || undefined,
          buildDate: buildDate || undefined,
        });
      } catch {
        /* keep fallback (cfg.APP_VERSION ?? 'unknown') */
      }
    };
    void loadVersion();
  }, [cfg.API_BASE_URL]);

  const displayVersion = liveVersion || cfg.APP_VERSION || 'unknown';

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

  React.useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated) return;
    const canonicalAliasTarget = canonicalAliasTargets[loc.pathname];
    if (canonicalAliasTarget) {
      navigate(`${canonicalAliasTarget}${loc.search}${loc.hash}`, { replace: true });
    }
  }, [auth.isAuthenticated, auth.isLoading, loc.hash, loc.pathname, loc.search, navigate]);

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
        // R-Audit (W28A-730-R3 / L4 R1 + PS-77 addendum-b §1): canonical route
        // /audit-log + menu label EXACTLY "Audit Log". /diagnostics-audit remains
        // a legacy alias mounting the SAME shared LogTablePanel/MonitoringPage
        // (CX-104 row links target the alias and keep working).
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
        // CX-110: role policies live on their own page, split out of the RBAC page.
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
        { label: 'A2A Console', path: '/developer/a2a-console', icon: navIcon(Antenna) },
      ],
    },
    {
      label: 'System',
      path: '/system/jobs',
      icon: navIcon(Activity),
      children: [
        { label: 'Jobs', path: '/system/jobs', icon: navIcon(Layers) },
        { label: 'Settings', path: '/system/settings', icon: navIcon(Settings) },
        // R-About (W28A-730-R3 / L4 R2 + PS-77 addendum-b §2): About is a
        // NAVIGABLE page at /about that RENDERS the About content as the route
        // body. The AboutDialog modal additionally remains, reachable from the
        // user menu (onAbout below).
        { label: 'About', path: '/system/about', icon: navIcon(Info) },
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

  const canonicalAliasTarget = canonicalAliasTargets[loc.pathname];
  if (canonicalAliasTarget) {
    return <CanonicalRedirect to={canonicalAliasTarget} />;
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
        onSettings: () => navigate('/system/settings'),
        // R-About: the canonical About surface is the /about page; the modal
        // additionally remains reachable from the user menu (addendum-b §2).
        onAbout: () => setAboutOpen(true),
        // W28E-1854 / PDS-013: log out via a full-page navigation to the server
        // GET /logout (clears the session + api-key bridge cookies, then 302 ->
        // /login). A client-side navigate kept this poll-heavy dashboard SPA
        // mounted, so an in-flight /webapi/* poll could re-issue the signed
        // session cookie and re-authenticate right after logout. A hard nav
        // tears the SPA down (cancelling in-flight polls) so logout is terminal.
        onLogout: () => { window.location.assign('/logout'); },
      }}
    >
      <ServiceStatusBar services={services} />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/login" element={<LoginPage appName={manifest.appName} mode={props.authMode} />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        {/* PS-71 canonical IDAM routes — shared @cloud-dog/idam components (W28A-876) */}
        <Route path="/idam/users" element={<CanonicalRedirect to="/admin/users" />} />
        <Route path="/idam/groups" element={<CanonicalRedirect to="/admin/groups" />} />
        <Route path="/idam/api-keys" element={<CanonicalRedirect to="/admin/api-keys" />} />
        <Route path="/idam/roles" element={<CanonicalRedirect to="/admin/roles" />} />
        <Route path="/idam/rbac" element={<CanonicalRedirect to="/admin/rbac" />} />
        <Route path="/api-keys" element={<CanonicalRedirect to="/admin/api-keys" />} />
        <Route path="/apikeys" element={<CanonicalRedirect to="/admin/api-keys" />} />
        <Route path="/rbac" element={<CanonicalRedirect to="/admin/rbac" />} />
        {/* PS-WEBUI-URL-CANONICAL: /admin/* is the canonical IDAM/admin namespace. */}
        {/* W28E-1838 §6: IDAM pages use the shared @cloud-dog/idam components (no bespoke). */}
        <Route path="/admin/users" element={<IdamUsersPage apiBaseUrl="/webapi" />} />
        <Route path="/admin/groups" element={<IdamGroupsPage apiBaseUrl="/webapi" />} />
        <Route path="/admin/api-keys" element={<IdamApiKeysPage apiBaseUrl="/webapi" />} />
        <Route path="/admin/roles" element={<IdamRolesPage apiBaseUrl="/webapi" />} />
        <Route path="/admin/rbac" element={<IdamRbacPage apiBaseUrl="/webapi" />} />
        {/* Legacy detail/sub-paths -> canonical list (shared component hosts add/edit/view dialogs). */}
        <Route path="/db/users" element={<CanonicalRedirect to="/admin/users" />} />
        <Route path="/admin/users/add" element={<CanonicalRedirect to="/admin/users" />} />
        <Route path="/admin/users/:userId/view" element={<CanonicalRedirect to="/admin/users" />} />
        <Route path="/admin/users/:userId/edit" element={<CanonicalRedirect to="/admin/users" />} />
        <Route path="/db/groups" element={<CanonicalRedirect to="/admin/groups" />} />
        <Route path="/admin/groups/add" element={<CanonicalRedirect to="/admin/groups" />} />
        <Route path="/admin/groups/:groupId/edit" element={<CanonicalRedirect to="/admin/groups" />} />
        <Route path="/admin/groups/:groupId/assign-owner" element={<CanonicalRedirect to="/admin/groups" />} />
        <Route path="/channels" element={<ChannelsPage />} />
        <Route path="/db/channels" element={<CanonicalRedirect to="/channels" />} />
        <Route path="/channels/add" element={<ChannelsPage />} />
        <Route path="/channels/:channelId/edit" element={<ChannelsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/db/messages" element={<CanonicalRedirect to="/messages" />} />
        <Route path="/messages/:messageId" element={<MessagesPage />} />
        <Route path="/deliveries" element={<DeliveriesPage />} />
        <Route path="/db/deliveries" element={<CanonicalRedirect to="/deliveries" />} />
        <Route path="/jobs" element={<CanonicalRedirect to="/system/jobs" />} />
        <Route path="/system/jobs" element={<JobsPage />} />
        <Route path="/prompts" element={<PromptsPage />} />
        <Route path="/prompts/:promptId/edit" element={<PromptsPage />} />
        <Route path="/prompts/add" element={<PromptsPage />} />
        <Route path="/db/prompts" element={<CanonicalRedirect to="/prompts" />} />
        <Route path="/settings" element={<CanonicalRedirect to="/system/settings" />} />
        <Route path="/system/settings" element={<SettingsPage />} />
        {/*
          R-About (W28A-730-R3 / L4 R2 + PS-77 addendum-b §2): /about RENDERS the
          About content as the route body (version from live GET /version with
          __version__/config fallback). Supersedes the prior modal+Navigate('/')
          redirect, which the L4 ruling deems NON-CONFORMANT. Modal still mounted
          (user menu onAbout).
        */}
        <Route
          path="/system/about"
          element={
            <AboutPage
              productName={cfg.PRODUCT_NAME ?? manifest.appName}
              description={
                cfg.PRODUCT_DESCRIPTION ??
                'Multi-channel notification platform composed of four servers (API/REST, MCP, A2A, Web UI/Admin); accepts requests to notify users across email, SMS, WhatsApp, and chat with LLM-formatted content.'
              }
              companyName="Viewdeck Engineering Limited"
              websiteUrl="https://cloud-dog.net"
              version={displayVersion}
              commitHash={buildIdentity.commitHash}
              buildDate={buildIdentity.buildDate}
            />
          }
        />
        <Route path="/about" element={<CanonicalRedirect to="/system/about" />} />
        {/* R-Audit (L4 R1 + addendum-b §1): canonical /audit-log; /diagnostics-audit,
            /monitoring, /logs remain legacy aliases mounting the SAME shared component. */}
        <Route path="/audit-log" element={<MonitoringPage />} />
        <Route path="/audit" element={<CanonicalRedirect to="/audit-log" />} />
        <Route path="/observability" element={<CanonicalRedirect to="/audit-log" />} />
        <Route path="/monitoring" element={<CanonicalRedirect to="/audit-log" />} />
        <Route path="/diagnostics-audit" element={<CanonicalRedirect to="/audit-log" />} />
        <Route path="/logs" element={<CanonicalRedirect to="/audit-log" />} />
        <Route path="/api-docs" element={<CanonicalRedirect to="/developer/api-docs" />} />
        <Route path="/docs" element={<CanonicalRedirect to="/developer/api-docs" />} />
        <Route path="/openapi" element={<CanonicalRedirect to="/developer/api-docs" />} />
        <Route path="/developer/api-docs" element={<ApiDocsPage />} />
        <Route path="/mcp-console" element={<CanonicalRedirect to="/developer/mcp-console" />} />
        <Route path="/developer/mcp-console" element={<McpConsolePage />} />
        <Route path="/a2a-console" element={<CanonicalRedirect to="/developer/a2a-console" />} />
        <Route path="/developer/a2a-console" element={<A2aConsolePage />} />
        <Route path="/storage" element={<CanonicalRedirect to="/system/settings" />} />
        <Route path="/mcp-logs" element={<CanonicalRedirect to="/audit-log" />} />
        <Route path="/web-api-docs" element={<CanonicalRedirect to="/developer/api-docs" />} />
        <Route path="/db/config" element={<CanonicalRedirect to="/system/settings" />} />
        <Route path="/web-mcp-test" element={<CanonicalRedirect to="/developer/mcp-console" />} />
        <Route path="/llm-test" element={<CanonicalRedirect to="/system/settings" />} />
        <Route path="/services" element={<CanonicalRedirect to="/audit-log" />} />
        <Route path="/status" element={<CanonicalRedirect to="/audit-log" />} />
        <Route path="*" element={<LegacyRoutePage />} />
      </Routes>
      {/* XC-001: the shared CopyrightFooter self-probes GET /version (canonical
          live-version banner). Session timeout note retained alongside it. */}
      <CopyrightFooter />
      <div className="px-3 pb-1 text-xs text-muted-foreground">session timeout {cfg.SESSION_TIMEOUT_MINUTES ?? 30}m</div>
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
      version={displayVersion}
    />
    <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
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
  const authMode = cfg.AUTH_MODE ?? 'cookie';
  const sessionTimeoutMinutes = cfg.SESSION_TIMEOUT_MINUTES ?? 30;
  const sessionWarningMinutes = Math.min(5, Math.max(1 / 60, sessionTimeoutMinutes / 2));

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
        apiBaseUrl: cfg.API_BASE_URL,
        cookie: {
          loginPath: '/auth/login',
          mePath: '/auth/me?optional=1',
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
