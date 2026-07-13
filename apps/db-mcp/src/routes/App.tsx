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

import * as React from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from "@cloud-dog/config";
import { AuthProvider, LoginPage, SessionTimeoutProvider, useAuth } from "@cloud-dog/auth";
import { ShellLayout, operationalConsolePreset, AboutPage, AboutDialog, ProfileDialog, DocLinks, ServiceStatusBar, CopyrightFooter } from "@cloud-dog/shell";
import type { NavItemType, ServiceStatus } from "@cloud-dog/shell";
import {
  Activity,
  ClipboardList,
  Database,
  FileText,
  FolderOpen,
  GitBranch,
  Info,
  Key,
  Layers,
  LayoutDashboard,
  Radio,
  Search,
  Settings,
  Shield,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import {
  Button,
  Spinner,
  ToastProvider,
} from "@cloud-dog/ui";
import { manifest } from "./manifest";
import { AppStateProvider, useDbMcpState } from "../state/AppState";
import { DashboardPage } from "../views/DashboardPage";
import { SourceConnectionsPage } from "../views/SourceConnectionsPage";
import { ProfilesPage } from "../views/ProfilesPage";
import {
  IdamUsersPage,
  IdamGroupsPage,
  IdamApiKeysPage,
  IdamRolesPage,
  IdamRbacPage,
  setIdamTransportAuth,
} from "@cloud-dog/idam";
import { CataloguePage } from "../views/CataloguePage";
import { EntityDetailPage } from "../views/EntityDetailPage";
import { DataBrowserPage } from "../views/DataBrowserPage";
import { SearchPage } from "../views/SearchPage";
import { RelationshipsPage } from "../views/RelationshipsPage";
import { SchemaPage } from "../views/SchemaPage";
import { AuditPage } from "../views/AuditPage";
import { JobsPage } from "../views/JobsPage";
import { ApiDocsPage } from "../views/ApiDocsPage";
import { SettingsPage } from "../views/SettingsPage";
import { McpConsolePage } from "../views/McpConsolePage";
import { A2aConsolePage } from "../views/A2aConsolePage";
import { WatchesPage } from "../views/WatchesPage";

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("api_key"),
  API_KEY_HEADER: z.string().default("X-API-Key"),
  MCP_BASE_URL: z.string().url().optional(),
  APP_VERSION: z.string().optional(),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

const PENDING_PATH_STORAGE_KEY = "db-mcp.pending-path";
const ROUTES = {
  dashboard: "/",
  login: "/login",
  sourceConnections: "/admin/source-connections",
  profiles: "/admin/profiles",
  catalogue: "/catalogue",
  dataBrowser: "/data-browser",
  search: "/search",
  relationships: "/relationships",
  schema: "/schema",
  auditLog: "/audit-log",
  users: "/admin/users",
  groups: "/admin/groups",
  apiKeys: "/admin/api-keys",
  roles: "/admin/roles",
  rbac: "/admin/rbac",
  apiDocs: "/developer/api-docs",
  mcpConsole: "/developer/mcp-console",
  a2aConsole: "/developer/a2a-console",
  watches: "/system/watches",
  jobs: "/system/jobs",
  settings: "/system/settings",
  about: "/system/about",
} as const;

// Single source of truth for the inactivity timeout — shared by SessionTimeoutProvider
// (which owns the actual logout) and the visible SessionTimerDisplay (PS-77 CW-A3 / PS-30 UI-R10).
const SESSION_TIMEOUT_MINUTES = 30;

// PS-77 CW-A3 / PS-30 UI-R23: a visible session countdown. Mirrors the canonical file-mcp
// (W28A-845) pattern — an app-local display that reflects remaining session time. The actual
// session expiry + warning dialog are owned by SessionTimeoutProvider from @cloud-dog/auth.
const SESSION_ACTIVITY_EVENTS = ["mousemove", "keydown", "scroll", "click", "touchstart"] as const;

function useSessionCountdown(timeoutMinutes: number): string {
  const totalSeconds = timeoutMinutes * 60;
  const [secondsLeft, setSecondsLeft] = React.useState(totalSeconds);
  const lastActivityRef = React.useRef(Date.now());

  React.useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    for (const ev of SESSION_ACTIVITY_EVENTS) {
      document.addEventListener(ev, onActivity, { passive: true });
    }
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      setSecondsLeft(Math.max(0, totalSeconds - elapsed));
    }, 1000);
    return () => {
      window.clearInterval(interval);
      for (const ev of SESSION_ACTIVITY_EVENTS) {
        document.removeEventListener(ev, onActivity);
      }
    };
  }, [totalSeconds]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function SessionTimerDisplay({ timeoutMinutes }: { timeoutMinutes: number }) {
  const countdown = useSessionCountdown(timeoutMinutes);
  return (
    <span
      className="rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground"
      title="Session time remaining"
      aria-label={`Session expires in ${countdown}`}
    >
      Session: {countdown}
    </span>
  );
}

function safeStorageGet(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

function safeStorageRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

// W28E-1863 fix-wave-d (WSC-014 / PS-30 UI-R7.3): build identity for the About page.
// The db-mcp web tier serves a same-origin `/version` that emits source_commit +
// build_date (config-routed from the container build). The static inline runtime
// config only carries a hard-coded APP_VERSION, so per-build provenance is fetched
// here and passed to the shared @cloud-dog/shell AboutPage (no shell fork).
type BuildIdentity = { commitHash?: string; buildDate?: string };

function useBuildIdentity(): BuildIdentity {
  const [identity, setIdentity] = React.useState<BuildIdentity>({});
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetch(`${window.location.origin}/version`, {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (!resp.ok) return;
        const data = (await resp.json()) as {
          source_commit?: string;
          commit?: string;
          build_date?: string;
        };
        if (cancelled) return;
        const commitHash = (data.source_commit ?? data.commit ?? "").trim();
        const buildDate = (data.build_date ?? "").trim();
        setIdentity({
          commitHash: commitHash || undefined,
          buildDate: buildDate || undefined,
        });
      } catch {
        // Build identity is best-effort; the About page degrades to version-only.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  return identity;
}

function ShellApp() {
  const loc = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const cfg = useConfig<AppRuntimeConfig>();
  const app = useDbMcpState();
  const buildIdentity = useBuildIdentity();
  // W28A-876: feed the active API key into the shared IDAM transport (api_key mode).
  setIdamTransportAuth({ apiKey: app.apiKey || auth.getAccessToken?.() || null });
  const [loginDraft, setLoginDraft] = React.useState(app.apiKey);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [services, setServices] = React.useState<ServiceStatus[]>(() => [
    { name: "API", url: cfg.API_BASE_URL, status: "unknown" },
    { name: "MCP", url: cfg.MCP_BASE_URL || "", status: "unknown" },
    { name: "A2A", url: "", status: "unknown" },
  ]);

  React.useEffect(() => {
    document.title = manifest.appName;
  }, []);

  React.useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    const probe = async () => {
      const next: ServiceStatus[] = [
        { name: "API", url: cfg.API_BASE_URL, status: "warning" },
        { name: "MCP", url: cfg.MCP_BASE_URL || "", status: "warning" },
        { name: "A2A", url: "", status: "unknown" },
      ];
      try {
        const res = await fetch(`${cfg.API_BASE_URL}/health`, { credentials: "same-origin" });
        next[0] = { ...next[0], status: res.ok ? "ok" : "error" };
      } catch { next[0] = { ...next[0], status: "error" }; }
      const mcpBase = cfg.MCP_BASE_URL || "";
      if (mcpBase) {
        try {
          const res = await fetch(`${mcpBase}/health`, { credentials: "same-origin" });
          next[1] = { ...next[1], status: res.ok ? "ok" : "error" };
        } catch { next[1] = { ...next[1], status: "error" }; }
      }
      if (!cancelled) setServices(next);
    };
    void probe();
    const id = window.setInterval(() => { void probe(); }, 15000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [cfg.API_BASE_URL, cfg.MCP_BASE_URL, auth.isAuthenticated]);

  React.useEffect(() => {
    setLoginDraft(app.apiKey);
  }, [app.apiKey]);

  React.useEffect(() => {
    if (auth.isAuthenticated && loc.pathname === ROUTES.login) {
      const pendingPath = safeStorageGet(PENDING_PATH_STORAGE_KEY);
      safeStorageRemove(PENDING_PATH_STORAGE_KEY);
      navigate(pendingPath || ROUTES.dashboard);
      return;
    }
    if (!auth.isAuthenticated && loc.pathname !== ROUTES.login) {
      safeStorageSet(PENDING_PATH_STORAGE_KEY, `${loc.pathname}${loc.search}`);
      navigate(ROUTES.login);
    }
  }, [auth.isAuthenticated, loc.pathname, loc.search, navigate]);

  const navItems: NavItemType[] = [
    {
      label: "DB MCP",
      path: "/",
      icon: navIcon(Database),
      children: [
        { label: "Dashboard", path: ROUTES.dashboard, icon: navIcon(LayoutDashboard) },
        { label: "Source Connections", path: ROUTES.sourceConnections, icon: navIcon(Database) },
        { label: "Profiles", path: ROUTES.profiles, icon: navIcon(FolderOpen) },
        { label: "Catalogue", path: ROUTES.catalogue, icon: navIcon(Database) },
        { label: "Entity Detail", path: "/catalogue?view=entity-detail", icon: navIcon(FileText) },
        { label: "Data Browser", path: ROUTES.dataBrowser, icon: navIcon(Database) },
        { label: "Search", path: ROUTES.search, icon: navIcon(Search) },
        { label: "Relationships", path: ROUTES.relationships, icon: navIcon(GitBranch) },
        { label: "Schema", path: ROUTES.schema, icon: navIcon(Wrench) },
        { label: "Audit & Log", path: ROUTES.auditLog, icon: navIcon(ClipboardList) },
      ],
    },
    {
      label: "Admin",
      path: ROUTES.users,
      icon: navIcon(Users),
      children: [
        { label: "Users", path: ROUTES.users, icon: navIcon(Users) },
        { label: "Groups", path: ROUTES.groups, icon: navIcon(Users) },
        { label: "API Keys", path: ROUTES.apiKeys, icon: navIcon(Key) },
        { label: "Roles", path: ROUTES.roles, icon: navIcon(Shield) },
        { label: "RBAC", path: ROUTES.rbac, icon: navIcon(Shield) },
      ],
    },
    {
      label: "Developer",
      path: ROUTES.apiDocs,
      icon: navIcon(Wrench),
      children: [
        { label: "API Docs", path: ROUTES.apiDocs, icon: navIcon(FileText) },
        { label: "MCP Console", path: ROUTES.mcpConsole, icon: navIcon(Terminal) },
        { label: "A2A Console", path: ROUTES.a2aConsole, icon: navIcon(Radio) },
      ],
    },
    {
      label: "System",
      path: ROUTES.jobs,
      icon: navIcon(Activity),
      children: [
        { label: "Change Watches", path: ROUTES.watches, icon: navIcon(Activity) },
        { label: "Jobs", path: ROUTES.jobs, icon: navIcon(Layers) },
        { label: "Settings", path: ROUTES.settings, icon: navIcon(Settings) },
        { label: "About", path: ROUTES.about, icon: navIcon(Info) },
      ],
    },
  ];

  const onLogin = async (apiKey: string) => {
    await app.signIn(apiKey);
    if (loc.pathname === ROUTES.login) {
      const pendingPath = safeStorageGet(PENDING_PATH_STORAGE_KEY);
      safeStorageRemove(PENDING_PATH_STORAGE_KEY);
      navigate(pendingPath || ROUTES.dashboard);
    }
  };

  if (auth.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-5 w-5" /> Loading session...
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <LoginPage
        appName={manifest.appName}
        mode={(cfg.AUTH_MODE === "cookie" ? "cookie" : "api_key") as "cookie" | "api_key"}
        apiKeyValue={loginDraft}
        onApiKeyChange={setLoginDraft}
        onApiKeySubmit={({ apiKey }) => onLogin(apiKey)}
        error={app.authError ?? auth.error}
      />
    );
  }

  return (
    <ShellLayout
      appName={manifest.appName}
      navItems={navItems}
      preset={operationalConsolePreset}
      userMenu={{
        displayName: auth.user?.displayName ?? (cfg.AUTH_MODE === "cookie" ? "admin" : "API key"),
        email: auth.user?.email,
        onProfile: () => setProfileOpen(true),
        onSettings: () => navigate(ROUTES.settings),
        onLogout: () => app.signOut().then(() => navigate(ROUTES.login)),
      }}
    >
      <ServiceStatusBar services={services} />
      <Routes>
        <Route path={ROUTES.dashboard} element={<DashboardPage />} />
        <Route path={ROUTES.login} element={<Navigate to={ROUTES.dashboard} replace />} />
        <Route path={ROUTES.sourceConnections} element={<SourceConnectionsPage />} />
        <Route path={ROUTES.profiles} element={<ProfilesPage />} />
        <Route path="/source-connections" element={<Navigate to={ROUTES.sourceConnections} replace />} />
        <Route path="/profiles" element={<Navigate to={ROUTES.profiles} replace />} />
        {/* PS-WEBUI-URL-CANONICAL: /admin/* is canonical; /idam/* remains an alias only. */}
        <Route path={ROUTES.users} element={<IdamUsersPage apiBaseUrl="/webapi" />} />
        <Route path={ROUTES.groups} element={<IdamGroupsPage apiBaseUrl="/webapi" />} />
        <Route path={ROUTES.apiKeys} element={<IdamApiKeysPage apiBaseUrl="/webapi" />} />
        <Route path={ROUTES.roles} element={<IdamRolesPage apiBaseUrl="/webapi" />} />
        <Route path={ROUTES.rbac} element={<IdamRbacPage apiBaseUrl="/webapi" />} />
        <Route path="/idam/users" element={<Navigate to={ROUTES.users} replace />} />
        <Route path="/idam/groups" element={<Navigate to={ROUTES.groups} replace />} />
        <Route path="/idam/api-keys" element={<Navigate to={ROUTES.apiKeys} replace />} />
        <Route path="/idam/roles" element={<Navigate to={ROUTES.roles} replace />} />
        <Route path="/idam/rbac" element={<Navigate to={ROUTES.rbac} replace />} />
        <Route path="/apikeys" element={<Navigate to={ROUTES.apiKeys} replace />} />
        <Route path="/api-keys" element={<Navigate to={ROUTES.apiKeys} replace />} />
        <Route path="/rbac" element={<Navigate to={ROUTES.rbac} replace />} />
        <Route path="/catalogue" element={<CataloguePage />} />
        <Route path="/catalogue/:profileId/:namespaceId/:entityId" element={<CataloguePage />} />
        <Route path="/catalogue/:profileId/:namespaceId" element={<CataloguePage />} />
        <Route path="/catalogue/:profileId" element={<CataloguePage />} />
        <Route path="/catalogue/:ns/:entity" element={<EntityDetailPage />} />
        <Route path="/data-browser" element={<DataBrowserPage />} />
        <Route path="/data/:profileId/:ns/:entity" element={<DataBrowserPage />} />
        <Route path="/data/:ns/:entity" element={<DataBrowserPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/relationships" element={<RelationshipsPage />} />
        <Route path="/schema/:profileId" element={<SchemaPage />} />
        <Route path="/schema" element={<SchemaPage />} />
        <Route path={ROUTES.auditLog} element={<AuditPage />} />
        <Route path="/audit" element={<Navigate to={ROUTES.auditLog} replace />} />
        <Route path="/diagnostics-audit" element={<Navigate to={ROUTES.auditLog} replace />} />
        <Route path="/observability" element={<Navigate to={ROUTES.auditLog} replace />} />
        <Route path="/logs" element={<Navigate to={ROUTES.auditLog} replace />} />
        <Route path={ROUTES.watches} element={<WatchesPage />} />
        <Route path="/watches" element={<Navigate to={ROUTES.watches} replace />} />
        <Route path={ROUTES.jobs} element={<JobsPage />} />
        <Route path="/jobs" element={<Navigate to={ROUTES.jobs} replace />} />
        <Route path={ROUTES.mcpConsole} element={<McpConsolePage />} />
        <Route path="/mcp-console" element={<Navigate to={ROUTES.mcpConsole} replace />} />
        <Route path={ROUTES.a2aConsole} element={<A2aConsolePage />} />
        <Route path="/a2a-console" element={<Navigate to={ROUTES.a2aConsole} replace />} />
        <Route path="/docs-browser" element={<Navigate to={ROUTES.apiDocs} replace />} />
        <Route path={ROUTES.apiDocs} element={<ApiDocsPage />} />
        <Route path="/api-docs" element={<Navigate to={ROUTES.apiDocs} replace />} />
        <Route path="/docs" element={<Navigate to={ROUTES.apiDocs} replace />} />
        <Route path="/openapi" element={<Navigate to={ROUTES.apiDocs} replace />} />
        <Route path={ROUTES.settings} element={<SettingsPage />} />
        <Route path="/settings" element={<Navigate to={ROUTES.settings} replace />} />
        {/* W28E-1845 / PS-WEBUI-URL-CANONICAL §11: canonical /system/about renders the
            shared @cloud-dog/shell AboutPage page body (was routed through the AboutDialog
            modal); service profile copy preserved via serviceProfile (no-loss). The
            supplementary AboutDialog modal remains for the footer/user-menu trigger. */}
        <Route
          path={ROUTES.about}
          element={
            <AboutPage
              productName={manifest.appName}
              description="Database discovery, governance and MCP tooling."
              companyName="Viewdeck Engineering Limited"
              websiteUrl="https://cloud-dog.net"
              version={app.appVersion}
              commitHash={buildIdentity.commitHash}
              buildDate={buildIdentity.buildDate}
              serviceProfile={
                <div className="space-y-3 text-left">
                  <p>
                    DB MCP is the Cloud-Dog AI database discovery and governance service. It catalogues sources,
                    browses entities and data, surfaces relationships and schema, and exposes governed query and
                    MCP tooling across API, MCP, A2A and WebUI surfaces.
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Source connections, catalogue, data browser, search, relationships and schema views.</li>
                    <li>Identity, RBAC, persistence, jobs and audit via the Cloud-Dog platform packages.</li>
                  </ul>
                </div>
              }
              docLinks={
                <div className="flex flex-wrap gap-3">
                  <a href={ROUTES.apiDocs} className="text-primary underline">API Docs</a>
                  <a href={ROUTES.mcpConsole} className="text-primary underline">MCP Console</a>
                  <a href={ROUTES.a2aConsole} className="text-primary underline">A2A Console</a>
                </div>
              }
            />
          }
        />
        <Route path="/about" element={<Navigate to={ROUTES.about} replace />} />
        <Route path="/ui/login" element={<Navigate to={ROUTES.login} replace />} />
        <Route path="/auth/login" element={<Navigate to={ROUTES.login} replace />} />
        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Routes>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="flex items-center gap-3">
          <CopyrightFooter />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAboutOpen(true)}
            aria-label="About this application"
          >
            About
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <SessionTimerDisplay timeoutMinutes={SESSION_TIMEOUT_MINUTES} />
          <DocLinks links={[
            { label: "API Docs", url: ROUTES.apiDocs },
            { label: "MCP Console", url: ROUTES.mcpConsole },
            { label: "A2A Console", url: ROUTES.a2aConsole },
          ]} />
        </div>
      </div>
      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        productName={manifest.appName}
        description="Database discovery, governance and MCP tooling."
        companyName="Viewdeck Engineering Limited"
        websiteUrl="https://cloud-dog.net"
        version={app.appVersion}
      />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
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
        mode: (cfg.AUTH_MODE === "cookie" ? "cookie" : "api_key") as "cookie" | "api_key",
        apiBaseUrl: cfg.API_BASE_URL,
        cookie: { loginPath: "/auth/login", mePath: "/auth/me", logoutPath: "/auth/logout" },
      }}
    >
      <ToastProvider>
        <SessionTimeoutProvider timeoutMinutes={SESSION_TIMEOUT_MINUTES} warningMinutes={5}>
          <AppStateProvider>
            <ShellApp />
          </AppStateProvider>
        </SessionTimeoutProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
