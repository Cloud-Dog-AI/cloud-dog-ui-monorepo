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
import { AboutDialog, CopyrightFooter, ServiceStatusBar, ShellLayout, VersionInfo } from "@cloud-dog/shell";
import type { NavItemType } from "@cloud-dog/shell";
import {
  Button,
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
import { UsersPage } from "../views/UsersPage";
import { GroupsPage } from "../views/GroupsPage";
import { ApiKeysPage } from "../views/ApiKeysPage";
import { RbacBindingsPage } from "../views/RbacBindingsPage";
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
import { StashManagerPage } from "../views/StashManagerPage";

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
    { label: "Workspace", path: "/workspace", icon: navIcon(GitBranch) },
    { label: "Browser", path: "/repository", icon: navIcon(FolderOpen) },
    { label: "Commits", path: "/history", icon: navIcon(ClipboardList) },
    { label: "Diff", path: "/diff", icon: navIcon(Activity) },
    { label: "Branches", path: "/branches", icon: navIcon(GitBranch) },
    { label: "Merge", path: "/merge", icon: navIcon(RefreshCcw) },
    { label: "Tags", path: "/tags", icon: navIcon(Tag) },
    { label: "Stashes", path: "/stashes", icon: navIcon(Layers) },
    { label: "Recovery", path: "/recovery", icon: navIcon(RefreshCcw) },
    { label: "Audit Log", path: "/audit", icon: navIcon(ClipboardList) },
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
        { label: "RBAC", path: "/admin/rbac", icon: navIcon(Shield) },
      ],
    }] : []),
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
        onSettings: () => navigate("/settings"),
      }}
    >
      <div className="space-y-6">
        <span className="sr-only" aria-label="Session timeout active">Session timeout active</span>
        <ServiceStatusBar services={services} />
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/90 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <VersionInfo
            version={versionInfo.version}
            buildDate={versionInfo.buildDate}
            commitHash={versionInfo.commitHash}
          />
          <Button variant="secondary" size="sm" onClick={() => setAboutOpen(true)}>
            About
          </Button>
        </div>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/profiles" element={access.canManageProfiles ? <ProfilesPage /> : <RestrictedPage title="Profiles" description="This role cannot manage repository profiles." />} />
          <Route path="/admin/users" element={access.canAccessAdminPages ? <UsersPage /> : <RestrictedPage title="Users" description="Admin pages are hidden for this role." />} />
          <Route path="/admin/groups" element={access.canAccessAdminPages ? <GroupsPage /> : <RestrictedPage title="Groups" description="Admin pages are hidden for this role." />} />
          <Route path="/admin/api-keys" element={access.canAccessAdminPages ? <ApiKeysPage /> : <RestrictedPage title="API Keys" description="Admin pages are hidden for this role." />} />
          <Route path="/admin/rbac" element={access.canAccessAdminPages ? <RbacBindingsPage /> : <RestrictedPage title="RBAC" description="Admin pages are hidden for this role." />} />
          <Route path="/workspace" element={<WorkspaceDiagnosticsPage />} />
          <Route path="/repository" element={<RepositoryBrowserPage />} />
          <Route path="/browser" element={<Navigate to="/repository" replace />} />
          <Route path="/files" element={<Navigate to="/repository" replace />} />
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
          <Route path="/mcp-console" element={<McpToolsPage />} />
          <Route path="/a2a-console" element={<A2aConsolePage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route path="/jobs" element={<JobsPageView />} />
          <Route path="/audit" element={<AuditLogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<Navigate to={access.canAccessAdminPages ? "/admin/rbac" : "/"} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CopyrightFooter />
        <p className="text-xs text-muted-foreground">
          Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
        </p>
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
