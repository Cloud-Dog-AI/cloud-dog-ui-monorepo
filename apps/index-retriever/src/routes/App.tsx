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

// @cloud-dog/app-index-retriever — App routes and top-level providers.

import * as React from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from "@cloud-dog/config";
import { AuthProvider, LoginPage, SessionTimeoutProvider, useAuth } from "@cloud-dog/auth";
import {
  Activity,
  Archive,
  Database,
  FileStack,
  FileText,
  FolderOpen,
  Key,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Library,
  Radio,
  Search,
  Settings,
  Shield,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import {
  AboutDialog,
  AboutPage,
  CopyrightFooter,
  DocLinks,
  ServiceStatusBar,
  ShellLayout,
  VersionInfo,
  type NavItemType,
  type ServiceStatus,
} from "@cloud-dog/shell";
import {
  Button,
  Spinner,
} from "@cloud-dog/ui";
import {
  IdamUsersPage,
  IdamGroupsPage,
  IdamApiKeysPage,
  IdamRolesPage,
  IdamRbacPage,
  setIdamTransportAuth,
} from "@cloud-dog/idam";
import { manifest } from "./manifest";
import { AppStateProvider, useIndexRetrieverState } from "../state/AppState";
import { DashboardPage } from "../views/DashboardPage";
import { ProfileCrudPage } from "../views/ProfileCrudPage";
import { CollectionCrudPage } from "../views/CollectionCrudPage";
import { SourceConfigPage } from "../views/SourceConfigPage";
import { IngestSearchPage } from "../views/IngestSearchPage";
import { RetentionDeletePage } from "../views/RetentionDeletePage";
import { WatchesPage } from "../views/WatchesPage";
import { ObservabilityPage } from "../views/ObservabilityPage";
import { McpConsolePage } from "../views/McpConsolePage";
import { A2aConsolePage } from "../views/A2aConsolePage";
import { SettingsPage } from "../views/SettingsPage";
import { ApiDocsPage } from "../views/ApiDocsPage";
import { JobsPageView } from "../views/JobsPageView";
import { StructureDocumentsPage } from "../views/StructureDocumentsPage";
import { StructureCorporaPage } from "../views/StructureCorporaPage";
import { StructureTemplatesPage } from "../views/StructureTemplatesPage";

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("cookie"),
  APP_VERSION: z.string().optional(),
  BUILD_DATE: z.string().optional(),
  GIT_COMMIT: z.string().optional(),
  DEFAULT_PROFILE: z.string().optional(),
  DEFAULT_COLLECTION: z.string().optional(),
  MCP_BASE_URL: z.string().optional(),
  A2A_BASE_URL: z.string().optional(),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().positive().optional(),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

function withPath(base: string | undefined, path: string): string {
  if (!base?.trim()) return path;
  return new URL(path, base).toString();
}

function deriveSiblingPort(baseUrl: string, nextPort: number): string | null {
  try {
    const url = new URL(baseUrl, window.location.origin);
    url.port = String(nextPort);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function guessMcpBase(cfg: AppRuntimeConfig): string {
  if (cfg.MCP_BASE_URL?.trim()) return cfg.MCP_BASE_URL;
  if (cfg.API_BASE_URL.includes(":8074")) {
    return deriveSiblingPort(cfg.API_BASE_URL, 8076) ?? `${window.location.origin}/mcp`;
  }
  return `${window.location.origin}/mcp`;
}

function guessA2aBase(cfg: AppRuntimeConfig): string {
  if (cfg.A2A_BASE_URL?.trim()) return cfg.A2A_BASE_URL;
  if (cfg.API_BASE_URL.includes(":8074")) {
    return deriveSiblingPort(cfg.API_BASE_URL, 8077) ?? `${window.location.origin}/a2a`;
  }
  return `${window.location.origin}/a2a`;
}

async function probeProtectedEndpoint(
  url: string,
  getAccessToken: () => string | null
): Promise<"ok" | "warning" | "error"> {
  const headers = new Headers({ accept: "application/json" });
  const token = getAccessToken()?.trim();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      credentials: "include",
    });
    if (response.ok) {
      return "ok";
    }
    if (response.status === 401 || response.status === 403) {
      return "warning";
    }
    return "error";
  } catch {
    return "error";
  }
}

function useServiceStatuses(cfg: AppRuntimeConfig, app: ReturnType<typeof useIndexRetrieverState>): ServiceStatus[] {
  const auth = useAuth();
  const mcpBase = guessMcpBase(cfg);
  const a2aBase = guessA2aBase(cfg);

  const [services, setServices] = React.useState<ServiceStatus[]>([
    { name: "API", url: cfg.API_BASE_URL, status: "unknown" },
    { name: "MCP", url: mcpBase, status: "unknown" },
    { name: "A2A", url: a2aBase, status: "unknown" },
  ]);

  React.useEffect(() => {
    let mounted = true;

    const check = async () => {
      const accessToken = auth.getAccessToken()?.trim() || app.apiKey.trim() || null;
      const apiStatus = await app.api
        .getHealth()
        .then(() => "ok" as const)
        .catch(() => "error" as const);
      const mcpStatus = accessToken
        ? await probeProtectedEndpoint(
            withPath(cfg.API_BASE_URL, "/api/v1/tools"),
            () => accessToken
          )
        : ("unknown" as const);
      const a2aStatus = accessToken
        ? await app.api.getA2aHealth().then(() => "ok" as const).catch(() => "error" as const)
        : ("unknown" as const);

      if (!mounted) return;
      setServices([
        { name: "API", url: cfg.API_BASE_URL, status: apiStatus },
        { name: "MCP", url: mcpBase, status: mcpStatus },
        { name: "A2A", url: a2aBase, status: a2aStatus },
      ]);
    };

    void check();
    const intervalId = window.setInterval(() => void check(), 30_000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [a2aBase, app.api, auth.getAccessToken, cfg, mcpBase]);

  return services;
}

function ShellApp() {
  const cfg = useConfig<AppRuntimeConfig>();
  const loc = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const app = useIndexRetrieverState();
  const services = useServiceStatuses(cfg, app);

  const [loginDraft, setLoginDraft] = React.useState(app.apiKey);
  const [aboutOpen, setAboutOpen] = React.useState(false);

  React.useEffect(() => {
    document.title = manifest.appName;
  }, []);

  React.useEffect(() => {
    setLoginDraft(app.apiKey);
    // W28A-775: complete the shared @cloud-dog/idam adoption — feed the active API key
    // into the IDAM transport so the shared IDAM pages (Users/Groups/API-Keys/RBAC/Roles)
    // authenticate in this service's api_key mode (cookie-only auth would 401 the backend).
    setIdamTransportAuth(
      cfg.AUTH_MODE === "api_key" ? { apiKey: auth.getAccessToken()?.trim() || app.apiKey || null } : null,
    );
  }, [app.apiKey, auth.getAccessToken, cfg.AUTH_MODE]);

  const navItems: NavItemType[] = [
    {
      label: "Index Retriever",
      path: "/dashboard",
      icon: navIcon(Database),
      children: [
        { label: "Dashboard", path: "/dashboard", icon: navIcon(LayoutDashboard) },
        { label: "Profiles", path: "/profiles", icon: navIcon(FolderOpen) },
        { label: "Collections", path: "/collections", icon: navIcon(Database) },
        { label: "File Ingest", path: "/source-config", icon: navIcon(Wrench) },
        { label: "Search", path: "/search", icon: navIcon(Search) },
        { label: "Retention Delete", path: "/retention-delete", icon: navIcon(Archive) },
        { label: "Audit Log", path: "/audit-log", icon: navIcon(Activity) },
      ],
    },
    {
      label: "Document Structure",
      path: "/structure/documents",
      icon: navIcon(FileStack),
      children: [
        { label: "Structure Documents", path: "/structure/documents", icon: navIcon(FileStack) },
        { label: "Structure Corpora", path: "/structure/corpora", icon: navIcon(Library) },
        { label: "Structure Templates", path: "/structure/templates", icon: navIcon(LayoutTemplate) },
      ],
    },
    {
      label: "Admin",
      path: "/admin/users",
      icon: navIcon(Users),
      children: [
        { label: "Users", path: "/admin/users", icon: navIcon(Users) },
        { label: "Groups", path: "/admin/groups", icon: navIcon(Users) },
        { label: "API Keys", path: "/admin/api-keys", icon: navIcon(Key) },
        { label: "Roles", path: "/admin/roles", icon: navIcon(Shield) },
        { label: "RBAC", path: "/admin/rbac", icon: navIcon(Shield) },
      ],
    },
    {
      label: "Developer",
      path: "/developer/api-docs",
      icon: navIcon(Wrench),
      children: [
        { label: "API Docs", path: "/developer/api-docs", icon: navIcon(FileText) },
        { label: "MCP Console", path: "/developer/mcp-console", icon: navIcon(Terminal) },
        { label: "A2A Console", path: "/developer/a2a-console", icon: navIcon(Radio) },
      ],
    },
    {
      label: "System",
      path: "/system/jobs",
      icon: navIcon(Activity),
      children: [
        { label: "Jobs", path: "/system/jobs", icon: navIcon(Layers) },
        { label: "Change Watches", path: "/system/watches", icon: navIcon(Radio) },
        { label: "Settings", path: "/system/settings", icon: navIcon(Settings) },
      ],
    },
  ];

  const onLogin = async (apiKey: string) => {
    await app.signIn(apiKey);
    if (loc.pathname === "/login") navigate("/dashboard");
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
        homePath="/dashboard"
        navItems={navItems}
        userMenu={{
          displayName: auth.user?.displayName ?? "API key",
          email: auth.user?.email,
          onLogout,
          onSettings: () => navigate("/system/settings"),
        }}
      >
        <div className="space-y-6">
          <ServiceStatusBar services={services} />

          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profiles" element={<ProfileCrudPage />} />
            {/* W28A-734-R2: bespoke /security SecurityAdminSectionView fork removed (§1.4);
                redirect legacy bookmarks to the canonical shared IDAM admin. */}
            <Route path="/security" element={<Navigate to="/admin/users" replace />} />
            {/* PS-71 v2.2 canonical IDAM routes — shared @cloud-dog/idam components (W28E-1838-STD-F03: /admin/* canonical) */}
            <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/users" element={<IdamUsersPage apiBaseUrl="/api" />} />
            <Route path="/admin/groups" element={<IdamGroupsPage apiBaseUrl="/api" />} />
            <Route path="/admin/api-keys" element={<IdamApiKeysPage apiBaseUrl="/api" />} />
            <Route path="/admin/roles" element={<IdamRolesRoute />} />
            <Route path="/admin/rbac" element={<IdamRbacPage apiBaseUrl="/api" />} />
            {/* legacy /idam/* (and /apikeys,/api-keys,/rbac) aliases -> 308/redirect to canonical /admin/* (PS-WEBUI-URL-CANONICAL WURL-ADMIN-*) */}
            <Route path="/idam/users" element={<Navigate to="/admin/users" replace />} />
            <Route path="/idam/groups" element={<Navigate to="/admin/groups" replace />} />
            <Route path="/idam/api-keys" element={<Navigate to="/admin/api-keys" replace />} />
            <Route path="/idam/roles" element={<Navigate to="/admin/roles" replace />} />
            <Route path="/idam/rbac" element={<Navigate to="/admin/rbac" replace />} />
            <Route path="/apikeys" element={<Navigate to="/admin/api-keys" replace />} />
            <Route path="/api-keys" element={<Navigate to="/admin/api-keys" replace />} />
            <Route path="/rbac" element={<Navigate to="/admin/rbac" replace />} />
            <Route path="/collections" element={<CollectionCrudPage />} />
            <Route path="/structure/documents" element={<StructureDocumentsPage />} />
            <Route path="/structure/corpora" element={<StructureCorporaPage />} />
            <Route path="/structure/templates" element={<StructureTemplatesPage />} />
            <Route path="/source-config" element={<SourceConfigPage />} />
            <Route path="/source-connections" element={<Navigate to="/source-config" replace />} />
            <Route path="/search" element={<IngestSearchPage />} />
            <Route path="/ingest-search" element={<Navigate to="/search" replace />} />
            <Route path="/retention-delete" element={<RetentionDeletePage />} />
            <Route path="/system/jobs" element={<JobsPageView />} />
            <Route path="/jobs" element={<Navigate to="/system/jobs" replace />} />
            {/* W28E-1870-A: VDB change-watch page (PS-102 §10); /watches -> canonical */}
            <Route path="/system/watches" element={<WatchesPage />} />
            <Route path="/watches" element={<Navigate to="/system/watches" replace />} />
            <Route path="/audit-log" element={<ObservabilityPage />} />
            <Route path="/audit" element={<Navigate to="/audit-log" replace />} />
            <Route path="/diagnostics-audit" element={<Navigate to="/audit-log" replace />} />
            <Route path="/observability" element={<Navigate to="/audit-log" replace />} />
            <Route path="/logs" element={<Navigate to="/audit-log" replace />} />
            <Route path="/developer/mcp-console" element={<McpConsolePage />} />
            <Route path="/mcp-console" element={<Navigate to="/developer/mcp-console" replace />} />
            <Route path="/developer/a2a-console" element={<A2aConsolePage />} />
            <Route path="/a2a-console" element={<Navigate to="/developer/a2a-console" replace />} />
            <Route path="/developer/api-docs" element={<ApiDocsPage />} />
            <Route path="/api-docs" element={<Navigate to="/developer/api-docs" replace />} />
            <Route path="/docs" element={<Navigate to="/developer/api-docs" replace />} />
            <Route path="/openapi" element={<Navigate to="/developer/api-docs" replace />} />
            <Route path="/system/settings" element={<SettingsPage />} />
            <Route path="/settings" element={<Navigate to="/system/settings" replace />} />
            {/* W28E-1845: canonical navigable About page (shared @cloud-dog/shell AboutPage); legacy /about -> 308/redirect */}
            <Route
              path="/system/about"
              element={
                <AboutPage
                  productName={manifest.appName}
                  description="Index retriever administration, ingest, search, observability, MCP, and A2A operations."
                  websiteUrl="https://cloud-dog.net"
                  version={cfg.APP_VERSION}
                  buildDate={cfg.BUILD_DATE}
                  commitHash={cfg.GIT_COMMIT}
                />
              }
            />
            <Route path="/about" element={<Navigate to="/system/about" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>

          <div className="flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground">Session timeout: {cfg.SESSION_TIMEOUT_MINUTES ?? 30}m</span>
              <span className="text-xs text-muted-foreground">Version {cfg.APP_VERSION ?? "0.1.0"}</span>
              <VersionInfo version={cfg.APP_VERSION} buildDate={cfg.BUILD_DATE} commitHash={cfg.GIT_COMMIT} />
              <DocLinks
                links={[
                  { label: "API Docs", url: "/developer/api-docs" },
                  { label: "MCP Console", url: "/developer/mcp-console" },
                  { label: "A2A Console", url: "/developer/a2a-console" },
                  { label: "Settings", url: "/system/settings" },
                ]}
              />
              <Button variant="secondary" size="sm" onClick={() => setAboutOpen(true)}>
                About
              </Button>
            </div>
            <footer className="py-2 px-3 text-xs text-muted-foreground">Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited</footer>
          </div>
        </div>
      </ShellLayout>

      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        productName={manifest.appName}
        description="Index retriever administration, ingest, search, observability, MCP, and A2A operations."
        websiteUrl="https://cloud-dog.net"
        version={cfg.APP_VERSION}
      />
    </>
  );
}

function IdamRolesRoute() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Roles</h1>
      <IdamRolesPage apiBaseUrl="/api" />
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
        cookie: { loginPath: "/auth/login", mePath: "/auth/me", logoutPath: "/auth/logout" },
      }}
    >
      <AppStateProvider>
        <SessionTimeoutProvider timeoutMinutes={cfg.SESSION_TIMEOUT_MINUTES ?? 30} warningMinutes={5}>
          <ShellApp />
        </SessionTimeoutProvider>
      </AppStateProvider>
    </AuthProvider>
  );
}
