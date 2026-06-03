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
import { AboutDialog, CopyrightFooter, DocLinks, ProfileDialog, ShellLayout } from "@cloud-dog/shell";
import type { NavItemType } from "@cloud-dog/shell";
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
import { AdminIdentityPage } from "../views/AdminIdentityPage";
import { AdminUsersPage } from "../views/AdminUsersPage";
import { AdminGroupsPage } from "../views/AdminGroupsPage";
import { AdminApiKeysPage } from "../views/AdminApiKeysPage";
import { AdminRbacPageView } from "../views/AdminRbacPage";
import { GoogleDriveSettingsPage } from "../views/GoogleDriveSettingsPage";
import { McpConsolePage } from "../views/McpConsolePage";
import { A2aConsolePage } from "../views/A2aConsolePage";
import { ApiDocsPage } from "../views/ApiDocsPage";
import { JobsPage } from "../views/JobsPage";

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
  PRODUCT_NAME: z.string().optional(),
  PRODUCT_DESCRIPTION: z.string().optional(),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

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

  const [loginDraft, setLoginDraft] = React.useState(app.apiKey);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const canAccessGoogleDrive = canManageGoogleDriveSettings(app.currentUser ?? auth.user);

  React.useEffect(() => {
    document.title = manifest.appName;
  }, []);

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
        { label: "File Browser", path: "/file-browser", icon: navIcon(Folder) },
        { label: "Storage Profiles", path: "/storage-profiles", icon: navIcon(HardDrive) },
        { label: "Search", path: "/search", icon: navIcon(Search) },
        { label: "Audit Log", path: "/audit-log", icon: navIcon(ClipboardList) },
        ...(canAccessGoogleDrive
          ? [{ label: "Google Drive", path: "/google-drive-settings", icon: navIcon(HardDrive) }]
          : []),
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
          onSettings: () => navigate("/settings"),
          onProfile: () => setProfileOpen(true),
        }}
      >
        <div className="space-y-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/file-browser" element={<FileBrowserPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/storage-profiles" element={<StorageProfilesPage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/api-docs" element={<ApiDocsPage />} />
            <Route path="/admin-identity" element={<Navigate to="/admin/identity" replace />} />
            <Route path="/admin-rbac" element={<Navigate to="/admin/rbac" replace />} />
            <Route path="/admin/identity" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/groups" element={<AdminGroupsPage />} />
            <Route path="/admin/api-keys" element={<AdminApiKeysPage />} />
            <Route path="/admin/rbac" element={<AdminRbacPageView />} />
            <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
            <Route path="/google-drive-settings" element={<GoogleDriveSettingsPage />} />
            <Route path="/mcp-console" element={<McpConsolePage />} />
            <Route path="/a2a-console" element={<A2aConsolePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="/about"
              element={<AboutRoute onOpen={() => setAboutOpen(true)} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
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
                { label: "API Docs", url: "/api-docs" },
                { label: "MCP Console", url: "/mcp-console" },
                { label: "A2A Console", url: "/a2a-console" },
                { label: "Settings", url: "/settings" },
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

// Route stub: opens the canonical AboutDialog modal then redirects to home,
// preserving the historical `/about` URL while routing through the platform
// surface. The bespoke inline content was removed per W28A #38 (cross-service
// consistency: AboutDialog modal is the canonical About surface).
function AboutRoute({ onOpen }: { onOpen: () => void }) {
  React.useEffect(() => {
    onOpen();
  }, [onOpen]);
  return <Navigate to="/" replace />;
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
        <SessionTimeoutProvider timeoutMinutes={cfg.SESSION_TIMEOUT_MINUTES ?? 30} warningMinutes={5}>
          <AppStateProvider>
            <ShellApp />
          </AppStateProvider>
        </SessionTimeoutProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
