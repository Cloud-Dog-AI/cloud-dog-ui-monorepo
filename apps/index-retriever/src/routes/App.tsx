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
  FileText,
  FolderOpen,
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
  AboutDialog,
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
import { manifest } from "./manifest";
import { AppStateProvider, useIndexRetrieverState } from "../state/AppState";
import { DashboardPage } from "../views/DashboardPage";
import { ProfileCrudPage } from "../views/ProfileCrudPage";
import { CollectionCrudPage } from "../views/CollectionCrudPage";
import { SourceConfigPage } from "../views/SourceConfigPage";
import { IngestSearchPage } from "../views/IngestSearchPage";
import { RetentionDeletePage } from "../views/RetentionDeletePage";
import { ObservabilityPage } from "../views/ObservabilityPage";
import { McpConsolePage } from "../views/McpConsolePage";
import { A2aConsolePage } from "../views/A2aConsolePage";
import { UsersPage } from "../views/UsersPage";
import { GroupsPage } from "../views/GroupsPage";
import { ApiKeysPage } from "../views/ApiKeysPage";
import { RbacPage } from "../views/RbacPage";
import { SettingsPage } from "../views/SettingsPage";
import { ApiDocsPage } from "../views/ApiDocsPage";
import { JobsPageView } from "../views/JobsPageView";
import { SecurityPage } from "../views/SecurityPage";

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("api_key"),
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
      const accessToken = auth.getAccessToken()?.trim() || null;
      const apiStatus = await app.api
        .getHealth()
        .then(() => "ok" as const)
        .catch(() => "error" as const);
      const mcpStatus = await probeProtectedEndpoint(
        withPath(cfg.API_BASE_URL, "/api/v1/tools"),
        () => accessToken
      );
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
  }, [app.apiKey]);

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
        { label: "Search Retrieve", path: "/ingest-search", icon: navIcon(Search) },
        { label: "Retention Delete", path: "/retention-delete", icon: navIcon(Archive) },
        { label: "Observability", path: "/observability", icon: navIcon(Activity) },
      ],
    },
    {
      label: "Admin",
      path: "/admin/users",
      icon: navIcon(Users),
      children: [
        { label: "Security Overview", path: "/security", icon: navIcon(Shield) },
        { label: "Users", path: "/admin/users", icon: navIcon(Users) },
        { label: "Groups", path: "/admin/groups", icon: navIcon(Users) },
        { label: "API Keys", path: "/admin/api-keys", icon: navIcon(Key) },
        { label: "RBAC", path: "/admin/rbac", icon: navIcon(Shield) },
      ],
    },
    {
      label: "Developer",
      path: "/api-docs",
      icon: navIcon(Wrench),
      children: [
        { label: "API Docs", path: "/api-docs", icon: navIcon(FileText) },
        { label: "MCP Console", path: "/mcp-console", icon: navIcon(Terminal) },
        { label: "A2A Console", path: "/a2a-console", icon: navIcon(Radio) },
      ],
    },
    {
      label: "System",
      path: "/jobs",
      icon: navIcon(Activity),
      children: [
        { label: "Jobs", path: "/jobs", icon: navIcon(Layers) },
        { label: "Settings", path: "/settings", icon: navIcon(Settings) },
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
          onSettings: () => navigate("/settings"),
        }}
      >
        <div className="space-y-6">
          <ServiceStatusBar services={services} />

          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profiles" element={<ProfileCrudPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/groups" element={<GroupsPage />} />
            <Route path="/admin/api-keys" element={<ApiKeysPage />} />
            <Route path="/admin/rbac" element={<RbacPage />} />
            <Route path="/collections" element={<CollectionCrudPage />} />
            <Route path="/source-config" element={<SourceConfigPage />} />
            <Route path="/ingest-search" element={<IngestSearchPage />} />
            <Route path="/retention-delete" element={<RetentionDeletePage />} />
            <Route path="/jobs" element={<JobsPageView />} />
            <Route path="/observability" element={<ObservabilityPage />} />
            <Route path="/mcp-console" element={<McpConsolePage />} />
            <Route path="/a2a-console" element={<A2aConsolePage />} />
            <Route path="/api-docs" element={<ApiDocsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>

          <div className="flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground">Session timeout: {cfg.SESSION_TIMEOUT_MINUTES ?? 30}m</span>
              <span className="text-xs text-muted-foreground">Version {cfg.APP_VERSION ?? "0.1.0"}</span>
              <VersionInfo version={cfg.APP_VERSION} buildDate={cfg.BUILD_DATE} commitHash={cfg.GIT_COMMIT} />
              <DocLinks
                links={[
                  { label: "API Docs", url: "/api-docs" },
                  { label: "MCP Console", url: "/mcp-console" },
                  { label: "A2A Console", url: "/a2a-console" },
                  { label: "Settings", url: "/settings" },
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
