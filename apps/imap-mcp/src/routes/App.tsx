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

// @cloud-dog/app-imap-mcp — App routes and top-level providers.

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
import { AboutDialog, CopyrightFooter, ProfileDialog, ServiceStatusBar, ShellLayout } from "@cloud-dog/shell";
import type { NavItemType, ServiceStatus } from "@cloud-dog/shell";
import { manifest } from "./manifest";
import { AppStateProvider, useImapMcpState } from "../state/AppState";
import { TopBarActions } from "../components/TopBarActions";
import { DashboardPage } from "../views/DashboardPage";
import { ProfilesPage } from "../views/StorageProfilesPage";
import { SearchRetrievePage } from "../views/SearchPage";
import { McpToolsPage } from "../views/McpToolsPage";
import { A2aConsolePage } from "../views/A2aConsolePage";
import { DiagnosticsAuditPage } from "../views/AuditLogPage";
import { SettingsPage } from "../views/SettingsPage";
import { AdminUsersPage } from "../views/AdminUsersPage";
import { AdminGroupsPage } from "../views/AdminGroupsPage";
import { AdminApiKeysPage } from "../views/AdminApiKeysPage";
import { AdminRbacPage } from "../views/AdminRbacPage";
import { JobsPage } from "../views/JobsPage";
import { ApiDocsPage } from "../views/ApiDocsPage";
import { MailboxWorkspacePage } from "../views/FileBrowserPage";
import { GmailSettingsPage } from "../views/GmailSettingsPage";

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("cookie"),
  MCP_BASE_URL: z.string().url().optional(),
  A2A_BASE_URL: z.string().url().optional(),
  UI_BASE_PATH: z.string().default("/ui"),
  CLOUD_DOG_SESSION_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(30),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

function ShellApp() {
  const loc = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const cfg = useConfig<AppRuntimeConfig>();
  const app = useImapMcpState();

  const [loginDraft, setLoginDraft] = React.useState(app.apiKey);
  const [version, setVersion] = React.useState("");
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [services, setServices] = React.useState<ServiceStatus[]>(() => [
    { name: "API", url: cfg.API_BASE_URL, status: "unknown" },
    { name: "MCP", url: cfg.MCP_BASE_URL || "", status: "unknown" },
    { name: "A2A", url: cfg.A2A_BASE_URL || "", status: "unknown" },
  ]);

  React.useEffect(() => {
    document.title = manifest.appName;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const next: ServiceStatus[] = [
        { name: "API", url: cfg.API_BASE_URL, status: "warning" },
        { name: "MCP", url: cfg.MCP_BASE_URL || "", status: "warning" },
        { name: "A2A", url: cfg.A2A_BASE_URL || "", status: "warning" },
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
      } else { next[1] = { ...next[1], status: "warning" }; }
      const a2aBase = cfg.A2A_BASE_URL || "";
      if (a2aBase) {
        try {
          const res = await fetch(`${a2aBase}/health`, { credentials: "same-origin" });
          next[2] = { ...next[2], status: res.ok ? "ok" : "error" };
        } catch { next[2] = { ...next[2], status: "error" }; }
      } else { next[2] = { ...next[2], status: "warning" }; }
      if (!cancelled) setServices(next);
    };
    void probe();
    const id = window.setInterval(() => { void probe(); }, 15000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [cfg.API_BASE_URL, cfg.MCP_BASE_URL, cfg.A2A_BASE_URL]);

  React.useEffect(() => {
    setLoginDraft(app.apiKey);
  }, [app.apiKey]);

  React.useEffect(() => {
    const loadVersion = async () => {
      if (!auth.isAuthenticated) {
        setVersion("");
        return;
      }
      const result = await app.api.getVersion();
      if (!result.ok || !result.data) return;
      setVersion(String(result.data.version ?? result.data.app_version ?? ""));
    };
    void loadVersion();
  }, [app.api, auth.isAuthenticated]);

  const navItems: NavItemType[] = [
    {
      label: "IMAP MCP",
      path: "/",
      icon: navIcon(Folder),
      children: [
        { label: "Dashboard", path: "/", icon: navIcon(LayoutDashboard) },
        { label: "Channels", path: "/profiles", icon: navIcon(HardDrive) },
        { label: "Mailbox Workspace", path: "/mailbox-workspace", icon: navIcon(Folder) },
        { label: "Mailbox", path: "/search-retrieve", icon: navIcon(Search) },
        { label: "Audit & Log", path: "/diagnostics-audit", icon: navIcon(ClipboardList) },
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
        { label: "Gmail Settings", path: "/gmail-settings", icon: navIcon(Key) },
        { label: "About", path: "#about", icon: navIcon(Info), onSelect: () => setAboutOpen(true) },
      ],
    },
  ];

  const onLogin = async (apiKey: string) => {
    await app.signIn(apiKey, app.role);
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
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
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
    <ShellLayout
      appName={manifest.appName}
      navItems={navItems}
      homePath="/"
      onHomeNavigate={(path) => navigate(path)}
      userMenu={{
        displayName: auth.user?.displayName ? `${auth.user.displayName} (${app.role})` : app.role,
        email: auth.user?.email,
        onProfile: () => setProfileOpen(true),
        onLogout,
        onSettings: () => navigate("/settings"),
      }}
    >
      <TopBarActions version={version} onLogout={onLogout} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        productName={manifest.appName}
        version={version}
      />
      <ServiceStatusBar services={services} />
      <div className="space-y-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route path="/mailbox-workspace" element={<MailboxWorkspacePage />} />
          <Route path="/search-retrieve" element={<SearchRetrievePage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/mcp-console" element={<McpToolsPage />} />
          <Route path="/a2a-console" element={<A2aConsolePage />} />
          <Route path="/diagnostics-audit" element={<DiagnosticsAuditPage />} />
          <Route path="/audit-log" element={<DiagnosticsAuditPage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/groups" element={<AdminGroupsPage />} />
          <Route path="/admin/api-keys" element={<AdminApiKeysPage />} />
          <Route path="/admin/rbac" element={<AdminRbacPage />} />
          <Route path="/admin-control" element={<Navigate to="/admin/users" replace />} />
          <Route path="/legacy-diagnostics" element={<Navigate to="/diagnostics-audit" replace />} />
          <Route path="/mutation-gating" element={<Navigate to="/" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/gmail-settings" element={<GmailSettingsPage />} />
          <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CopyrightFooter />
      </div>
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
        idleTimeoutMs: 0,
        cookie: { loginPath: "/auth/login", mePath: "/auth/me", logoutPath: "/auth/logout" },
      }}
    >
      <AppStateProvider>
        <SessionAwareShell />
      </AppStateProvider>
    </AuthProvider>
  );
}

function SessionAwareShell() {
  const cfg = useConfig<AppRuntimeConfig>();
  const navigate = useNavigate();
  const app = useImapMcpState();

  return (
    <SessionTimeoutProvider
      timeoutMinutes={cfg.CLOUD_DOG_SESSION_TIMEOUT_MINUTES}
      warningMinutes={5}
      onTimeout={() => {
        void app.signOut().finally(() => {
          navigate("/login", { replace: true });
        });
      }}
    >
      <ShellApp />
    </SessionTimeoutProvider>
  );
}
