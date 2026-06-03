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
import { ShellLayout, operationalConsolePreset, AboutDialog, DocLinks, ServiceStatusBar, CopyrightFooter } from "@cloud-dog/shell";
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
  Spinner,
} from "@cloud-dog/ui";
import { manifest } from "./manifest";
import { AppStateProvider, useDbMcpState } from "../state/AppState";
import { DashboardPage } from "../views/DashboardPage";
import { ProfilesPage } from "../views/ProfilesPage";
import { UsersPage } from "../views/UsersPage";
import { GroupsPage } from "../views/GroupsPage";
import { ApiKeysPage } from "../views/ApiKeysPage";
import { RbacPage } from "../views/RbacPage";
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

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("api_key"),
  API_KEY_HEADER: z.string().default("X-API-Key"),
  MCP_BASE_URL: z.string().url().optional(),
  APP_VERSION: z.string().optional(),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

const PENDING_PATH_STORAGE_KEY = "db-mcp.pending-path";

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

function ShellApp() {
  const loc = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const cfg = useConfig<AppRuntimeConfig>();
  const app = useDbMcpState();
  const [loginDraft, setLoginDraft] = React.useState(app.apiKey);
  const [aboutOpen, setAboutOpen] = React.useState(false);
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
    if (auth.isAuthenticated && loc.pathname === "/login") {
      const pendingPath = safeStorageGet(PENDING_PATH_STORAGE_KEY);
      safeStorageRemove(PENDING_PATH_STORAGE_KEY);
      navigate(pendingPath || "/");
      return;
    }
    if (!auth.isAuthenticated && loc.pathname !== "/login") {
      safeStorageSet(PENDING_PATH_STORAGE_KEY, `${loc.pathname}${loc.search}`);
      navigate("/login");
    }
  }, [auth.isAuthenticated, loc.pathname, loc.search, navigate]);

  const navItems: NavItemType[] = [
    {
      label: "DB MCP",
      path: "/",
      icon: navIcon(Database),
      children: [
        { label: "Dashboard", path: "/", icon: navIcon(LayoutDashboard) },
        { label: "Profiles", path: "/admin/profiles", icon: navIcon(FolderOpen) },
        { label: "Catalogue", path: "/catalogue", icon: navIcon(Database) },
        { label: "Data Browser", path: "/data-browser", icon: navIcon(Database) },
        { label: "Search", path: "/search", icon: navIcon(Search) },
        { label: "Relationships", path: "/relationships", icon: navIcon(GitBranch) },
        { label: "Schema", path: "/schema", icon: navIcon(Wrench) },
        { label: "Audit", path: "/audit", icon: navIcon(ClipboardList) },
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
        { label: "About", path: "/about", icon: navIcon(Info) },
      ],
    },
  ];

  const onLogin = async (apiKey: string) => {
    await app.signIn(apiKey);
    if (loc.pathname === "/login") {
      const pendingPath = safeStorageGet(PENDING_PATH_STORAGE_KEY);
      safeStorageRemove(PENDING_PATH_STORAGE_KEY);
      navigate(pendingPath || "/");
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
        onProfile: () => setAboutOpen(true),
        onSettings: () => navigate("/settings"),
        onLogout: () => app.signOut().then(() => navigate("/login")),
      }}
    >
      <ServiceStatusBar services={services} />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/admin/profiles" element={<ProfilesPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/groups" element={<GroupsPage />} />
        <Route path="/admin/api-keys" element={<ApiKeysPage />} />
        <Route path="/admin/rbac" element={<RbacPage />} />
        <Route path="/catalogue" element={<CataloguePage />} />
        <Route path="/catalogue/:ns/:entity" element={<EntityDetailPage />} />
        <Route path="/data-browser" element={<DataBrowserPage />} />
        <Route path="/data/:ns/:entity" element={<DataBrowserPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/relationships" element={<RelationshipsPage />} />
        <Route path="/schema" element={<SchemaPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/mcp-console" element={<McpConsolePage />} />
        <Route path="/a2a-console" element={<A2aConsolePage />} />
        <Route path="/docs-browser" element={<Navigate to="/api-docs" replace />} />
        <Route path="/api-docs" element={<ApiDocsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DocLinks links={[
        { label: "API Docs", url: "/api-docs" },
        { label: "MCP Console", url: "/mcp-console" },
        { label: "A2A Console", url: "/a2a-console" },
      ]} />
      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        productName={manifest.appName}
        description="Database discovery, governance and MCP tooling."
        version={app.appVersion}
      />
      <CopyrightFooter />
      <p className="px-3 pb-1 text-[10px] text-muted-foreground/50">Session timeout: 30 min</p>
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
      <SessionTimeoutProvider timeoutMinutes={30} warningMinutes={5}>
        <AppStateProvider>
          <ShellApp />
        </AppStateProvider>
      </SessionTimeoutProvider>
    </AuthProvider>
  );
}
