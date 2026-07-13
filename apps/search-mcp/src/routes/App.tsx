// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { z } from "zod";
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from "@cloud-dog/config";
import { AuthProvider, LoginPage, SessionTimeoutProvider, useAuth } from "@cloud-dog/auth";
import {
  AboutDialog,
  CopyrightFooter,
  DocLinks,
  ServiceStatusBar,
  ShellLayout,
  operationalConsolePreset,
} from "@cloud-dog/shell";
import type { NavItemType, ServiceStatus } from "@cloud-dog/shell";
import {
  Activity,
  BarChart3,
  ClipboardList,
  Eye,
  FileText,
  Gauge,
  Info,
  Key,
  Layers,
  LayoutDashboard,
  PackageSearch,
  Radio,
  Search,
  Server,
  Settings,
  Shield,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import { Spinner } from "@cloud-dog/ui";
import {
  IdamApiKeysPage,
  IdamGroupsPage,
  IdamRbacPage,
  IdamRolesPage,
  IdamUsersPage,
  setIdamTransportAuth,
} from "@cloud-dog/idam";
import { manifest } from "./manifest";
import { AppStateProvider, useSearchState } from "../state/AppState";
import { DashboardPage } from "../views/DashboardPage";
import { ResearchPage } from "../views/ResearchPage";
import { ResearchReportPage } from "../views/ResearchReportPage";
import { WatchesPage } from "../views/WatchesPage";
import { WatchEventsPage } from "../views/WatchEventsPage";
import { BackendsPage } from "../views/BackendsPage";
import { QualityPage } from "../views/QualityPage";
import { EvalPage } from "../views/EvalPage";
import { AuditPage } from "../views/AuditPage";
import { JobsPage } from "../views/JobsPage";
import { SettingsPage } from "../views/SettingsPage";
import { AdminSettingsPage } from "../views/AdminSettingsPage";
import { AboutPage } from "../views/AboutPage";
import { ApiDocsPage } from "../views/ApiDocsPage";
import { McpConsolePage } from "../views/McpConsolePage";
import { A2aConsolePage } from "../views/A2aConsolePage";

// The shared @cloud-dog/idam admin pages call `${apiBaseUrl}/v1/admin/*` and
// `${apiBaseUrl}/v1/idam/v1/*`. The search-mcp web tier serves /v1 on the same
// origin (single app), so apiBaseUrl = "" -> the pages hit /v1/admin/* directly.
const IDAM_API_BASE = "";

// W28L-1503: API_KEY_HEADER intentionally omitted — AUTH_MODE="cookie" only; the
// SPA never sets X-API-Key (the web tier handles auth server-side).
const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("cookie"),
  APP_VERSION: z.string().optional(),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

function ShellApp() {
  const navigate = useNavigate();
  const auth = useAuth();
  setIdamTransportAuth({ apiKey: auth.getAccessToken?.() ?? null });
  const cfg = useConfig<AppRuntimeConfig>();
  const app = useSearchState();
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [services, setServices] = React.useState<ServiceStatus[]>(() => [
    { name: "API", url: cfg.API_BASE_URL, status: "unknown" },
    { name: "MCP", url: `${window.location.origin}/mcp`, status: "unknown" },
    { name: "A2A", url: `${window.location.origin}/a2a`, status: "unknown" },
  ]);

  React.useEffect(() => {
    document.title = manifest.appName;
  }, []);

  React.useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    const probe = async () => {
      const origin = window.location.origin;
      const next: ServiceStatus[] = [
        { name: "API", url: cfg.API_BASE_URL, status: "warning" },
        { name: "MCP", url: `${origin}/mcp`, status: "warning" },
        { name: "A2A", url: `${origin}/a2a`, status: "warning" },
      ];
      const probeOne = async (idx: number, path: string) => {
        try {
          await app.api.health(path);
          next[idx] = { ...next[idx], status: "ok" };
        } catch {
          next[idx] = { ...next[idx], status: "error" };
        }
      };
      await Promise.all([probeOne(0, "/health"), probeOne(1, "/mcp/health"), probeOne(2, "/a2a/health")]);
      if (!cancelled) setServices(next);
    };
    void probe();
    const timer = window.setInterval(() => void probe(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [app.api, cfg.API_BASE_URL, auth.isAuthenticated]);

  const navItems: NavItemType[] = [
    {
      label: "Search MCP",
      path: "/",
      icon: navIcon(PackageSearch),
      children: [
        { label: "Dashboard", path: "/", icon: navIcon(LayoutDashboard) },
        { label: "Research", path: "/research", icon: navIcon(Search) },
        { label: "Watches", path: "/watches", icon: navIcon(Eye) },
        { label: "Backends", path: "/backends", icon: navIcon(Server) },
        { label: "Quality", path: "/quality", icon: navIcon(Gauge) },
        { label: "Eval", path: "/eval", icon: navIcon(BarChart3) },
        { label: "Audit Log", path: "/audit-log", icon: navIcon(ClipboardList) },
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
        { label: "Settings", path: "/system/settings", icon: navIcon(Settings) },
        { label: "About", path: "/system/about", icon: navIcon(Info) },
      ],
    },
  ];

  if (auth.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-5 w-5" /> Loading session…
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LoginPage appName={manifest.appName} mode="cookie" error={auth.error} />;
  }

  return (
    <ShellLayout
      appName={manifest.appName}
      navItems={navItems}
      preset={operationalConsolePreset}
      userMenu={{
        displayName: auth.user?.displayName ?? "admin",
        email: auth.user?.email,
        onProfile: () => setAboutOpen(true),
        onSettings: () => navigate("/system/settings"),
        onLogout: () => {
          void auth.logout().then(() => navigate("/"));
        },
      }}
    >
      <ServiceStatusBar services={services} />
      <div
        className="min-w-0 max-w-full overflow-x-auto"
        role="region"
        aria-label="Main content"
        tabIndex={0}
      >
        <Routes>
          {/* service-specific */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/research/:jobId" element={<ResearchReportPage />} />
          <Route path="/watches" element={<WatchesPage />} />
          <Route path="/watches/:watchId/events" element={<WatchEventsPage />} />
          <Route path="/backends" element={<BackendsPage />} />
          <Route path="/quality" element={<QualityPage />} />
          <Route path="/eval" element={<EvalPage />} />
          {/* audit log + SPA defence-in-depth aliases (backend serves 308) */}
          <Route path="/audit-log" element={<AuditPage />} />
          <Route path="/audit" element={<Navigate to="/audit-log" replace />} />
          <Route path="/diagnostics-audit" element={<Navigate to="/audit-log" replace />} />
          <Route path="/observability" element={<Navigate to="/audit-log" replace />} />
          <Route path="/logs" element={<Navigate to="/audit-log" replace />} />
          {/* canonical /admin/* IDAM — shared @cloud-dog/idam (no forks) */}
          <Route path="/admin/users" element={<IdamUsersPage apiBaseUrl={IDAM_API_BASE} />} />
          <Route path="/admin/groups" element={<IdamGroupsPage apiBaseUrl={IDAM_API_BASE} />} />
          <Route path="/admin/api-keys" element={<IdamApiKeysPage apiBaseUrl={IDAM_API_BASE} />} />
          <Route path="/admin/roles" element={<IdamRolesPage apiBaseUrl={IDAM_API_BASE} />} />
          <Route path="/admin/rbac" element={<IdamRbacPage apiBaseUrl={IDAM_API_BASE} />} />
          <Route path="/admin/settings" element={<Navigate to="/system/settings" replace />} />
          <Route path="/admin/tenant" element={<AdminSettingsPage />} />
          {/* canonical /developer/* */}
          <Route path="/developer/api-docs" element={<ApiDocsPage />} />
          <Route path="/api-docs" element={<Navigate to="/developer/api-docs" replace />} />
          <Route path="/docs" element={<Navigate to="/developer/api-docs" replace />} />
          <Route path="/openapi" element={<Navigate to="/developer/api-docs" replace />} />
          <Route path="/developer/mcp-console" element={<McpConsolePage />} />
          <Route path="/mcp-console" element={<Navigate to="/developer/mcp-console" replace />} />
          <Route path="/developer/a2a-console" element={<A2aConsolePage />} />
          <Route path="/a2a-console" element={<Navigate to="/developer/a2a-console" replace />} />
          {/* canonical /system/* */}
          <Route path="/system/jobs" element={<JobsPage />} />
          <Route path="/jobs" element={<Navigate to="/system/jobs" replace />} />
          <Route path="/system/settings" element={<SettingsPage />} />
          <Route path="/settings" element={<Navigate to="/system/settings" replace />} />
          <Route path="/system/about" element={<AboutPage />} />
          <Route path="/about" element={<Navigate to="/system/about" replace />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <DocLinks
        links={[
          { label: "API Docs", url: "/developer/api-docs" },
          { label: "MCP Console", url: "/developer/mcp-console" },
          { label: "A2A Console", url: "/developer/a2a-console" },
        ]}
      />
      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        productName={manifest.appName}
        description="Smart Search Agent — multi-backend, LLM-orchestrated research across API, MCP, A2A and WebUI."
        version={app.appVersion}
      />
      <CopyrightFooter />
      <p className="px-3 pb-1 text-xs text-muted-foreground">Session timeout: 30 min</p>
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
        mode: "cookie",
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
