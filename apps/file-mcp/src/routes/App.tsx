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

// @cloud-dog/app-file-mcp — App routes and top-level providers.

import * as React from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  Activity,
  ClipboardList,
  FileText,
  Folder,
  HardDrive,
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
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from "@cloud-dog/config";
import { AuthProvider, LoginPage, SessionTimeoutProvider, useAuth } from "@cloud-dog/auth";
import { AboutDialog, AboutPage, CopyrightFooter, DocLinks, ProfileDialog, ServiceStatusBar, ShellLayout } from "@cloud-dog/shell";
import type { NavItemType, ServiceStatus } from "@cloud-dog/shell";
import { Button, Spinner, ToastProvider } from "@cloud-dog/ui";
import { manifest } from "./manifest";
import { AppStateProvider, useFileMcpState } from "../state/AppState";
import { canManageGoogleDriveSettings } from "../lib/rbac";
import { DashboardPage } from "../views/DashboardPage";
import { FileBrowserPage } from "../views/FileBrowserPage";
import { SearchPage } from "../views/SearchPage";
import { StorageProfilesPage } from "../views/StorageProfilesPage";
import { AuditLogPage } from "../views/AuditLogPage";
import { SettingsPage } from "../views/SettingsPage";
import {
  IdamUsersPage,
  IdamGroupsPage,
  IdamApiKeysPage,
  IdamRolesPage,
  IdamRbacPage,
} from "@cloud-dog/idam";
import { GoogleDriveSettingsPage } from "../views/GoogleDriveSettingsPage";
import { McpConsolePage } from "../views/McpConsolePage";
import { A2aConsolePage } from "../views/A2aConsolePage";
import { ApiDocsPage } from "../views/ApiDocsPage";
import { JobsPage } from "../views/JobsPage";
import { WatchesPage } from "../views/WatchesPage";

const ROUTES = {
  dashboard: "/",
  catalogue: "/catalogue",
  search: "/search",
  storageProfiles: "/storage-profiles",
  watches: "/watches",
  auditLog: "/audit-log",
  googleDriveSettings: "/google-drive-settings",
  adminUsers: "/admin/users",
  adminGroups: "/admin/groups",
  adminApiKeys: "/admin/api-keys",
  adminRoles: "/admin/roles",
  adminRbac: "/admin/rbac",
  apiDocs: "/developer/api-docs",
  mcpConsole: "/developer/mcp-console",
  a2aConsole: "/developer/a2a-console",
  jobs: "/system/jobs",
  settings: "/system/settings",
  about: "/system/about",
} as const;

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("api_key"),
  ADMIN_UI_TOKEN: z.string().optional(),
  AUDIT_LOG_PATH: z.string().optional(),
  DEFAULT_BROWSE_PATH: z.string().optional(),
  PROFILE_STORE_PATH: z.string().optional(),
  MCP_BASE_URL: z.string().optional(),
  A2A_BASE_URL: z.string().optional(),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().optional(),
  APP_VERSION: z.string().optional(),
  // W28E-1863 fix-wave-a (WSC-014 / PS-30 UI-R7.3): build identity injected
  // by the backend runtime-config (source commit + build date + deploy env).
  APP_COMMIT: z.string().optional(),
  APP_BUILD_DATE: z.string().optional(),
  APP_CONTAINER_DIGEST: z.string().optional(),
  APP_ENV: z.string().optional(),
  PRODUCT_NAME: z.string().optional(),
  PRODUCT_DESCRIPTION: z.string().optional(),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

// W28E-1863 fix-wave-c (WSC-014 / PS-30 UI-R7.3): build identity for the About page.
// The file-mcp backend already emits build identity two ways at the deployed
// `a282f7f`: (1) runtime-config.js APP_COMMIT/APP_BUILD_DATE (read via cfg below) and
// (2) a same-origin `/version` JSON route. The About page prefers the runtime-config
// values; this hook fetches `/version` as a fallback so the About page still renders
// commit/build-date if the static runtime-config is stale — matching the estate
// chart/geo/scheduler pattern. Passed to the shared @cloud-dog/shell AboutPage (which
// already renders commitHash/buildDate) — no fork of the shared component.
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

// ---------------------------------------------------------------------------
// Fix 5: Persistent session timer display — mirrors SessionTimeoutProvider
// logic to show remaining session time in the top bar area.
// ---------------------------------------------------------------------------
const ACTIVITY_EVENTS_TIMER = ["mousemove", "keydown", "scroll", "click", "touchstart"] as const;

function useSessionCountdown(timeoutMinutes: number): string {
  const totalSeconds = timeoutMinutes * 60;
  const [secondsLeft, setSecondsLeft] = React.useState(totalSeconds);
  const lastActivityRef = React.useRef(Date.now());

  React.useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    for (const ev of ACTIVITY_EVENTS_TIMER) {
      document.addEventListener(ev, onActivity, { passive: true });
    }
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, totalSeconds - elapsed);
      setSecondsLeft(remaining);
    }, 1000);
    return () => {
      clearInterval(interval);
      for (const ev of ACTIVITY_EVENTS_TIMER) {
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
      className="text-xs font-mono text-muted-foreground px-2 py-1 rounded bg-muted/50"
      title="Session time remaining"
      aria-label={`Session expires in ${countdown}`}
    >
      Session: {countdown}
    </span>
  );
}

function ShellApp() {
  const loc = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const cfg = useConfig<AppRuntimeConfig>();
  const app = useFileMcpState();
  const buildIdentity = useBuildIdentity();
  // Prefer the runtime-config build identity (APP_COMMIT/APP_BUILD_DATE); fall back
  // to the same-origin /version fetch if the static runtime-config is stale/empty.
  const aboutCommitHash = cfg.APP_COMMIT ?? buildIdentity.commitHash;
  const aboutBuildDate = cfg.APP_BUILD_DATE ?? buildIdentity.buildDate;

  const [loginDraft, setLoginDraft] = React.useState(app.apiKey);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const canAccessGoogleDrive = canManageGoogleDriveSettings(app.currentUser ?? auth.user);
  const [services, setServices] = React.useState<ServiceStatus[]>(() => [
    { name: "API", url: app.apiBaseUrl, status: "unknown" },
    { name: "MCP", url: app.mcpBaseUrl, status: "unknown" },
    { name: "A2A", url: app.a2aBaseUrl, status: "unknown" },
  ]);

  React.useEffect(() => {
    document.title = manifest.appName;
  }, []);

  React.useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    const probe = async () => {
      const apiUrl = `${app.apiBaseUrl.replace(/\/+$/, "")}/health`;
      const mcpUrl = `${app.mcpBaseUrl}/health`;
      const a2aUrl = `${app.a2aBaseUrl}/health`;
      const next: ServiceStatus[] = [
        { name: "API", url: apiUrl, status: "unknown" },
        { name: "MCP", url: mcpUrl, status: "unknown" },
        { name: "A2A", url: a2aUrl, status: "unknown" },
      ];
      try {
        const result = await app.api.getHealth();
        next[0] = { ...next[0], status: result.status === "ok" ? "ok" : "warning" };
      } catch {
        next[0] = { ...next[0], status: "error" };
      }
      try {
        const tools = await app.api.listTools();
        next[1] = { ...next[1], status: tools.length > 0 ? "ok" : "warning" };
      } catch {
        next[1] = { ...next[1], status: "error" };
      }
      try {
        const a2aResult = await app.api.getA2aHealth();
        const state = String((a2aResult as Record<string, unknown>)?.status ?? "").toLowerCase();
        next[2] = { ...next[2], status: state === "ok" ? "ok" : "error" };
      } catch {
        next[2] = { ...next[2], status: "error" };
      }
      if (!cancelled) setServices(next);
    };
    void probe();
    const id = window.setInterval(() => { void probe(); }, 15000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [auth.isAuthenticated, app.api, app.apiBaseUrl, app.mcpBaseUrl, app.a2aBaseUrl]);

  React.useEffect(() => {
    setLoginDraft(app.apiKey);
  }, [app.apiKey]);

  const navItems: NavItemType[] = [
    {
      label: "File MCP",
      path: "/",
      icon: navIcon(Folder),
      children: [
        { label: "Dashboard", path: "/", icon: navIcon(LayoutDashboard) },
        { label: "Catalogue", path: ROUTES.catalogue, icon: navIcon(Folder) },
        { label: "Storage Profiles", path: ROUTES.storageProfiles, icon: navIcon(HardDrive) },
        { label: "Change Watches", path: ROUTES.watches, icon: navIcon(Radio) },
        { label: "Search", path: ROUTES.search, icon: navIcon(Search) },
        { label: "Audit Log", path: ROUTES.auditLog, icon: navIcon(ClipboardList) },
        ...(canAccessGoogleDrive
          ? [{ label: "Google Drive", path: ROUTES.googleDriveSettings, icon: navIcon(HardDrive) }]
          : []),
      ],
    },
    {
      label: "Admin",
      path: ROUTES.adminUsers,
      icon: navIcon(Users),
      children: [
        { label: "Users", path: ROUTES.adminUsers, icon: navIcon(Users) },
        { label: "Groups", path: ROUTES.adminGroups, icon: navIcon(Users) },
        { label: "API Keys", path: ROUTES.adminApiKeys, icon: navIcon(Key) },
        { label: "Roles", path: ROUTES.adminRoles, icon: navIcon(Shield) },
        { label: "RBAC", path: ROUTES.adminRbac, icon: navIcon(Shield) },
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
        { label: "Jobs", path: ROUTES.jobs, icon: navIcon(Layers) },
        { label: "Settings", path: ROUTES.settings, icon: navIcon(Settings) },
        { label: "About", path: ROUTES.about, icon: navIcon(Info) },
      ],
    },
  ];

  const onLogin = async (apiKey: string) => {
    await app.signIn(apiKey);
    if (loc.pathname === "/login") navigate("/");
  };

  const onLogout = async () => {
    await app.signOut();
    navigate("/login");
  };

  if (auth.isLoading) {
    return (
      <div className="min-h-[60vh] grid place-items-center" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-5 w-5" />
          Loading session...
        </div>
      </div>
    );
  }

  if (app.isRestoringSession) {
    return (
      <div className="min-h-[60vh] grid place-items-center" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-5 w-5" />
          Restoring saved session...
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
    <>
      <ShellLayout
        appName={manifest.appName}
        navItems={navItems}
        homePath="/"
        onHomeNavigate={(path) => navigate(path)}
        userMenu={{
          displayName: auth.user?.displayName ?? "API key",
          email: auth.user?.email,
          onLogout,
          onSettings: () => navigate(ROUTES.settings),
          onProfile: () => setProfileOpen(true),
        }}
      >
        <div className="space-y-6">
          <ServiceStatusBar services={services} />
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/catalogue" element={<FileBrowserPage />} />
            <Route path="/file-browser" element={<Navigate to={ROUTES.catalogue} replace />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/storage-profiles" element={<StorageProfilesPage />} />
            <Route path="/watches" element={<WatchesPage />} />
            <Route path="/change-watches" element={<Navigate to={ROUTES.watches} replace />} />
            <Route path="/profiles" element={<Navigate to={ROUTES.storageProfiles} replace />} />
            <Route path="/source-connections" element={<Navigate to={ROUTES.storageProfiles} replace />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="/audit" element={<Navigate to={ROUTES.auditLog} replace />} />
            <Route path="/diagnostics-audit" element={<Navigate to={ROUTES.auditLog} replace />} />
            <Route path="/observability" element={<Navigate to={ROUTES.auditLog} replace />} />
            <Route path="/logs" element={<Navigate to={ROUTES.auditLog} replace />} />
            <Route path="/system/jobs" element={<JobsPage />} />
            <Route path="/developer/api-docs" element={<ApiDocsPage />} />
            {/* PS-71 canonical IDAM routes — shared @cloud-dog/idam components (W28A-876) */}
            <Route path="/admin/users" element={<IdamUsersPage apiBaseUrl="" />} />
            <Route path="/admin/groups" element={<IdamGroupsPage apiBaseUrl="" />} />
            <Route path="/admin/api-keys" element={<IdamApiKeysPage apiBaseUrl="" />} />
            <Route path="/admin/roles" element={<IdamRolesPage apiBaseUrl="" />} />
            <Route path="/admin/rbac" element={<IdamRbacPage apiBaseUrl="" />} />
            <Route path="/idam" element={<Navigate to={ROUTES.adminUsers} replace />} />
            <Route path="/idam/users" element={<Navigate to={ROUTES.adminUsers} replace />} />
            <Route path="/idam/groups" element={<Navigate to={ROUTES.adminGroups} replace />} />
            <Route path="/idam/api-keys" element={<Navigate to={ROUTES.adminApiKeys} replace />} />
            <Route path="/idam/roles" element={<Navigate to={ROUTES.adminRoles} replace />} />
            <Route path="/idam/rbac" element={<Navigate to={ROUTES.adminRbac} replace />} />
            <Route path="/admin-identity" element={<Navigate to={ROUTES.adminUsers} replace />} />
            <Route path="/admin-rbac" element={<Navigate to={ROUTES.adminRbac} replace />} />
            <Route path="/admin/identity" element={<Navigate to={ROUTES.adminUsers} replace />} />
            <Route path="/admin" element={<Navigate to={ROUTES.adminUsers} replace />} />
            <Route path="/google-drive-settings" element={<GoogleDriveSettingsPage />} />
            <Route path="/developer/mcp-console" element={<McpConsolePage />} />
            <Route path="/developer/a2a-console" element={<A2aConsolePage />} />
            <Route path="/system/settings" element={<SettingsPage />} />
            {/* W28E-1845 / PS-WEBUI-URL-CANONICAL §11: canonical /system/about renders the
                shared @cloud-dog/shell AboutPage as a page body; the existing About copy,
                company and website (from the AboutDialog) are preserved via the
                serviceProfile/docLinks extension slots (no-loss). /about 308s below. */}
            <Route
              path="/system/about"
              element={
                <AboutPage
                  productName={cfg.PRODUCT_NAME ?? manifest.appName}
                  description={
                    cfg.PRODUCT_DESCRIPTION ??
                    "Language-neutral filesystem and document-manipulation tools for automation and agent workflows; exposes tools over an MCP/JSON-RPC-style boundary."
                  }
                  companyName="Viewdeck Engineering Limited"
                  websiteUrl="https://cloud-dog.net"
                  version={cfg.APP_VERSION}
                  commitHash={aboutCommitHash}
                  buildDate={aboutBuildDate}
                  docLinks={
                    <div className="flex flex-wrap gap-3">
                      <a href={ROUTES.apiDocs} className="text-primary underline">API Docs</a>
                      <a href={ROUTES.mcpConsole} className="text-primary underline">MCP Console</a>
                      <a href={ROUTES.a2aConsole} className="text-primary underline">A2A Console</a>
                      <a href={ROUTES.settings} className="text-primary underline">Settings</a>
                    </div>
                  }
                />
              }
            />
            <Route path="/api-docs" element={<Navigate to={ROUTES.apiDocs} replace />} />
            <Route path="/docs" element={<Navigate to={ROUTES.apiDocs} replace />} />
            <Route path="/openapi" element={<Navigate to={ROUTES.apiDocs} replace />} />
            <Route path="/mcp" element={<Navigate to={ROUTES.mcpConsole} replace />} />
            <Route path="/mcp-console" element={<Navigate to={ROUTES.mcpConsole} replace />} />
            <Route path="/a2a" element={<Navigate to={ROUTES.a2aConsole} replace />} />
            <Route path="/a2a-console" element={<Navigate to={ROUTES.a2aConsole} replace />} />
            <Route path="/jobs" element={<Navigate to={ROUTES.jobs} replace />} />
            <Route path="/settings" element={<Navigate to={ROUTES.settings} replace />} />
            <Route path="/about" element={<Navigate to={ROUTES.about} replace />} />
            <Route path="*" element={<NotFoundRoute />} />
          </Routes>

          <div className="flex items-center justify-between border-t pt-3">
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
              <SessionTimerDisplay timeoutMinutes={cfg.SESSION_TIMEOUT_MINUTES ?? 30} />
              <DocLinks links={[
                { label: "API Docs", url: ROUTES.apiDocs },
                { label: "MCP Console", url: ROUTES.mcpConsole },
                { label: "A2A Console", url: ROUTES.a2aConsole },
                { label: "Settings", url: ROUTES.settings },
              ]} />
            </div>
          </div>
        </div>
      </ShellLayout>

      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        productName={cfg.PRODUCT_NAME ?? manifest.appName}
        description={
          cfg.PRODUCT_DESCRIPTION ??
          "Language-neutral filesystem and document-manipulation tools for automation and agent workflows; exposes tools over an MCP/JSON-RPC-style boundary."
        }
        companyName="Viewdeck Engineering Limited"
        websiteUrl="https://cloud-dog.net"
        version={cfg.APP_VERSION}
      />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

function NotFoundRoute() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-normal">Not found</h1>
      <p className="text-sm text-muted-foreground">The requested page does not exist.</p>
    </div>
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
        cookie: { loginPath: "/auth/login", mePath: "/auth/me?optional=1", logoutPath: "/auth/logout" },
      }}
    >
      <ToastProvider>
        <SessionTimeoutProvider timeoutMinutes={cfg.SESSION_TIMEOUT_MINUTES ?? 30} warningMinutes={5}>
          <AppStateProvider>
            <ShellApp />
          </AppStateProvider>
        </SessionTimeoutProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
