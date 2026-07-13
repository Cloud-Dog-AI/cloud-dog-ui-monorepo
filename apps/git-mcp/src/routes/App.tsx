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

// @cloud-dog/app-git-mcp — App routes and top-level providers.

import * as React from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  Activity,
  ClipboardList,
  Eye,
  FileText,
  FolderOpen,
  GitBranch,
  Info,
  Key,
  Layers,
  LayoutDashboard,
  Radio,
  RefreshCcw,
  Settings,
  Shield,
  Tag,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from "@cloud-dog/config";
import { AuthProvider, LoginPage, SessionTimeoutProvider, useAuth } from "@cloud-dog/auth";
import { AboutDialog, AboutPage, CopyrightFooter, ServiceStatusBar, ShellLayout } from "@cloud-dog/shell";
import type { NavItemType } from "@cloud-dog/shell";
import {
  Card,
  CardContent,
  CardHeader,
  Spinner,
} from "@cloud-dog/ui";
import { manifest } from "./manifest";
import { AppStateProvider, useGitMcpState } from "../state/AppState";
import { getGitRoleAccess } from "../lib/rbac";
import { DashboardPage } from "../views/DashboardPage";
import { ProfilesPage } from "../views/ProfilesPage";
// IDAM Users/Groups/API-Keys/Roles/RBAC are served exclusively by the shared
// @cloud-dog/idam components (mounted on /idam/* and /admin/* below). The former
// bespoke forks were removed in W28A-886 (§1.4 dead-fork cleanup).
import { WorkspacesPage } from "../views/WorkspacesPage";
import { WorkspaceDiagnosticsPage } from "../views/WorkspaceDiagnosticsPage";
import { RecoveryPage } from "../views/RecoveryPage";
import { McpToolsPage } from "../views/McpToolsPage";
import { SettingsPage } from "../views/SettingsPage";
import { A2aConsolePage } from "../views/A2aConsolePage";
import { ApiDocsPage } from "../views/ApiDocsPage";
import { JobsPageView } from "../views/JobsPageView";
import { AuditLogPage } from "../views/AuditLogPage";
import { RepositoryBrowserPage } from "../views/RepositoryBrowserPage";
import { CommitLogPage } from "../views/CommitLogPage";
import { DiffViewerPage } from "../views/DiffViewerPage";
import { BranchManagerPage } from "../views/BranchManagerPage";
import { MergePage } from "../views/MergePage";
import { TagManagerPage } from "../views/TagManagerPage";
import { WatchesPage } from "../views/WatchesPage";
import { StashManagerPage } from "../views/StashManagerPage";
import {
  IdamUsersPage,
  IdamGroupsPage,
  IdamApiKeysPage,
  IdamRolesPage,
  IdamRbacPage,
  setIdamTransportAuth,
} from "@cloud-dog/idam";

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("api_key"),
  MCP_BASE_URL: z.string(),
  A2A_BASE_URL: z.string().optional(),
  DEFAULT_PROFILE: z.string().optional(),
  REMOTE_REPO_URL: z.string().optional(),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().default(30),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

function RestrictedPage(props: Readonly<{ title: string; description: string }>) {
  return (
    <Card>
      <CardHeader>
        <h1 className="text-2xl font-bold">{props.title}</h1>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </CardContent>
    </Card>
  );
}

function ShellApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  // W28A-876: feed the active API key into the shared IDAM transport (api_key mode).
  setIdamTransportAuth({ apiKey: auth.getAccessToken?.() ?? null });
  const cfg = useConfig<AppRuntimeConfig>();
  const app = useGitMcpState();

  const [loginDraft, setLoginDraft] = React.useState(app.apiKey);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [services, setServices] = React.useState<{ name: string; url: string; status: "ok" | "warning" | "error" | "unknown" }[]>([]);
  const [versionInfo, setVersionInfo] = React.useState<{ version?: string; buildDate?: string; commitHash?: string }>({});
  const access = React.useMemo(() => getGitRoleAccess(auth.user?.roles), [auth.user?.roles]);
  const awaitingSavedApiKeySession = !auth.isAuthenticated && !auth.isLoading && app.apiKey.trim().length > 0 && !app.authError;

  React.useEffect(() => {
    document.title = manifest.appName;
  }, []);

  // W28E-1845: the "About" nav points at the navigable canonical /system/about page route
  // (shared @cloud-dog/shell AboutPage); /about 308-redirects there. The AboutDialog modal is
  // retained as a supplementary quick-view (opened via setAboutOpen, not via the /about route).

  React.useEffect(() => {
    setLoginDraft(app.apiKey);
  }, [app.apiKey]);

  React.useEffect(() => {
    if (!auth.isAuthenticated) {
      setServices([]);
      setVersionInfo({});
      return;
    }
    let cancelled = false;
    const loadChromeData = async () => {
      try {
        const [status, version] = await Promise.all([
          app.api.getUiStatus(app.apiKey),
          app.api.getUiVersion(app.apiKey),
        ]);
        if (cancelled) return;
        setServices(status.services);
        setVersionInfo({
          version: version.version,
          buildDate: version.build_date,
          commitHash: version.commit_hash,
        });
      } catch {
        if (cancelled) return;
        setServices([]);
        setVersionInfo({});
      }
    };
    void loadChromeData();
    return () => {
      cancelled = true;
    };
  }, [app.api, app.apiKey, auth.isAuthenticated, location.pathname]);

  const gitChildren: NavItemType[] = [
    { label: "Dashboard", path: "/", icon: navIcon(LayoutDashboard) },
    ...(access.canManageProfiles ? [{ label: "Profiles", path: "/profiles", icon: navIcon(FolderOpen) }] : []),
    { label: "Workspaces", path: "/workspaces", icon: navIcon(Layers) },
    { label: "Workspace", path: "/workspace", icon: navIcon(GitBranch) },
    { label: "Catalogue", path: "/catalogue", icon: navIcon(FolderOpen) },
    { label: "Commits", path: "/history", icon: navIcon(ClipboardList) },
    { label: "Diff", path: "/diff", icon: navIcon(Activity) },
    { label: "Branches", path: "/branches", icon: navIcon(GitBranch) },
    { label: "Merge", path: "/merge", icon: navIcon(RefreshCcw) },
    { label: "Tags", path: "/tags", icon: navIcon(Tag) },
    { label: "Stashes", path: "/stashes", icon: navIcon(Layers) },
    { label: "Recovery", path: "/recovery", icon: navIcon(RefreshCcw) },
    { label: "Audit Log", path: "/audit-log", icon: navIcon(ClipboardList) },
  ];

  const navItems: NavItemType[] = [
    {
      label: "Git MCP",
      path: "/",
      icon: navIcon(GitBranch),
      children: gitChildren,
    },
    ...(access.canAccessAdminPages ? [{
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
    }] : []),
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
        { label: "Change Watches", path: "/system/watches", icon: navIcon(Eye) },
        { label: "Settings", path: "/system/settings", icon: navIcon(Settings) },
        { label: "About", path: "/system/about", icon: navIcon(Info) },
      ],
    },
  ];

  const onLogin = async (apiKey: string) => {
    await app.signIn(apiKey);
    if (location.pathname === "/login") navigate("/");
  };

  const onLogout = async () => {
    await app.signOut();
    navigate("/login");
  };

  if (auth.isLoading || awaitingSavedApiKeySession) {
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
    <ShellLayout
      appName={manifest.appName}
      navItems={navItems}
      homePath="/"
      userMenu={{
        displayName: auth.user?.displayName ?? "API key",
        email: auth.user?.email,
        onLogout,
        onSettings: () => navigate("/system/settings"),
      }}
    >
      <div className="space-y-6">
        <span className="sr-only" aria-label="Session timeout active">Session timeout active</span>
        <ServiceStatusBar services={services} />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/profiles" element={access.canManageProfiles ? <ProfilesPage /> : <RestrictedPage title="Profiles" description="This role cannot manage repository profiles." />} />
          {/* PS-71 v2.2 canonical IDAM routes — shared @cloud-dog/idam components (W28E-1838-STD-F03: /admin/* canonical) */}
          <Route path="/admin/users" element={access.canAccessAdminPages ? <IdamUsersPage apiBaseUrl="/api" /> : <RestrictedPage title="Users" description="Admin pages are hidden for this role." />} />
          <Route path="/admin/groups" element={access.canAccessAdminPages ? <IdamGroupsPage apiBaseUrl="/api" /> : <RestrictedPage title="Groups" description="Admin pages are hidden for this role." />} />
          <Route path="/admin/api-keys" element={access.canAccessAdminPages ? <IdamApiKeysPage apiBaseUrl="/api" /> : <RestrictedPage title="API Keys" description="Admin pages are hidden for this role." />} />
          <Route path="/admin/roles" element={access.canAccessAdminPages ? <IdamRolesPage apiBaseUrl="/api" /> : <RestrictedPage title="Roles" description="Admin pages are hidden for this role." />} />
          <Route path="/admin/rbac" element={access.canAccessAdminPages ? <IdamRbacPage apiBaseUrl="/api" /> : <RestrictedPage title="RBAC" description="Admin pages are hidden for this role." />} />
          {/* legacy /idam/* (and /apikeys,/api-keys,/rbac) aliases -> 308/redirect to canonical /admin/* (PS-WEBUI-URL-CANONICAL WURL-ADMIN-*) */}
          <Route path="/idam/users" element={<Navigate to="/admin/users" replace />} />
          <Route path="/idam/groups" element={<Navigate to="/admin/groups" replace />} />
          <Route path="/idam/api-keys" element={<Navigate to="/admin/api-keys" replace />} />
          <Route path="/idam/roles" element={<Navigate to="/admin/roles" replace />} />
          <Route path="/idam/rbac" element={<Navigate to="/admin/rbac" replace />} />
          <Route path="/apikeys" element={<Navigate to="/admin/api-keys" replace />} />
          <Route path="/api-keys" element={<Navigate to="/admin/api-keys" replace />} />
          <Route path="/rbac" element={<Navigate to="/admin/rbac" replace />} />
          {/* W28J: new first-class Workspaces page (conceptual-model surfacing) */}
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/source-connections" element={<Navigate to="/workspaces" replace />} />
          <Route path="/workspace" element={<WorkspaceDiagnosticsPage />} />
          <Route path="/catalogue" element={<RepositoryBrowserPage />} />
          <Route path="/repository" element={<Navigate to="/catalogue" replace />} />
          <Route path="/browser" element={<Navigate to="/catalogue" replace />} />
          <Route path="/files" element={<Navigate to="/catalogue" replace />} />
          <Route path="/history" element={<CommitLogPage />} />
          <Route path="/log" element={<Navigate to="/history" replace />} />
          <Route path="/commits" element={<Navigate to="/history" replace />} />
          <Route path="/diff" element={<DiffViewerPage />} />
          <Route path="/branches" element={<BranchManagerPage />} />
          <Route path="/merge" element={<MergePage />} />
          <Route path="/tags" element={<TagManagerPage />} />
          <Route path="/stashes" element={<StashManagerPage />} />
          <Route path="/recovery" element={<RecoveryPage />} />
          <Route path="/audit-recovery" element={<Navigate to="/recovery" replace />} />
          <Route path="/developer/mcp-console" element={<McpToolsPage />} />
          <Route path="/mcp-console" element={<Navigate to="/developer/mcp-console" replace />} />
          <Route path="/developer/a2a-console" element={<A2aConsolePage />} />
          <Route path="/a2a-console" element={<Navigate to="/developer/a2a-console" replace />} />
          <Route path="/developer/api-docs" element={<ApiDocsPage />} />
          <Route path="/api-docs" element={<Navigate to="/developer/api-docs" replace />} />
          <Route path="/docs" element={<Navigate to="/developer/api-docs" replace />} />
          <Route path="/openapi" element={<Navigate to="/developer/api-docs" replace />} />
          <Route path="/system/jobs" element={<JobsPageView />} />
          <Route path="/jobs" element={<Navigate to="/system/jobs" replace />} />
          {/* W28E-1870-C: git change-watch page (PS-102 §10). Canonical /system/watches;
              /watches -> canonical redirect (PS-WEBUI-URL-CANONICAL). */}
          <Route path="/system/watches" element={<WatchesPage />} />
          <Route path="/watches" element={<Navigate to="/system/watches" replace />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="/audit" element={<Navigate to="/audit-log" replace />} />
          <Route path="/diagnostics-audit" element={<Navigate to="/audit-log" replace />} />
          <Route path="/observability" element={<Navigate to="/audit-log" replace />} />
          <Route path="/logs" element={<Navigate to="/audit-log" replace />} />
          <Route path="/system/settings" element={<SettingsPage />} />
          <Route path="/settings" element={<Navigate to="/system/settings" replace />} />
          {/* W28E-1845 / PS-WEBUI-URL-CANONICAL §11: canonical /system/about renders the
              shared @cloud-dog/shell AboutPage; the About copy from the AboutDialog modal is
              preserved here verbatim (no-loss). The /about alias 308-redirects below; the
              AboutDialog modal is retained as a supplementary quick-view. */}
          <Route
            path="/system/about"
            element={
              <AboutPage
                productName={manifest.appName}
                description="Git repository administration, MCP tooling, and operational audit console."
                companyName="Viewdeck Engineering Limited"
                websiteUrl="https://cloud-dog.net"
                version={versionInfo.version}
                buildDate={versionInfo.buildDate}
                commitHash={versionInfo.commitHash}
              />
            }
          />
          <Route path="/about" element={<Navigate to="/system/about" replace />} />
          <Route path="/admin" element={<Navigate to={access.canAccessAdminPages ? "/admin/rbac" : "/"} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CopyrightFooter />
        <AboutDialog
          open={aboutOpen}
          onOpenChange={setAboutOpen}
          productName={manifest.appName}
          description="Git repository administration, MCP tooling, and operational audit console."
          companyName="Viewdeck Engineering Limited"
          websiteUrl="https://cloud-dog.net"
          version={versionInfo.version}
        />
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
        apiKey: { roles: ["admin"], permissions: ["*"] },
        cookie: { loginPath: "/auth/login", mePath: "/auth/me", logoutPath: "/auth/logout" },
      }}
    >
      <SessionTimeoutProvider timeoutMinutes={cfg.SESSION_TIMEOUT_MINUTES} warningMinutes={5}>
        <AppStateProvider>
          <ShellApp />
        </AppStateProvider>
      </SessionTimeoutProvider>
    </AuthProvider>
  );
}
