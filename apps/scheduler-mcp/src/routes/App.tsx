// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// scheduler-mcp app shell — W28K-1421 + W28K-1422 + W28K-1423.
// Uses ONLY shared @cloud-dog/* packages (RULES §1.6 platform-first).

import * as React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { z } from "zod";
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from "@cloud-dog/config";
import { AuthProvider, LoginPage, SessionTimeoutProvider, useAuth } from "@cloud-dog/auth";
import {
  AboutDialog,
  AboutPage,
  CopyrightFooter,
  DocLinks,
  ServiceStatusBar,
  ShellLayout,
  operationalConsolePreset,
} from "@cloud-dog/shell";
import type { NavItemType, ServiceStatus } from "@cloud-dog/shell";
import {
  Activity,
  CalendarClock,
  ClipboardList,
  Database,
  FileText,
  Info,
  Key,
  Layers,
  LayoutDashboard,
  ListChecks,
  Radio,
  Settings,
  Shield,
  Terminal,
  Users,
  Wrench,
  Workflow,
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
import { AppStateProvider, useAppState } from "../state/AppState";
import { DashboardPage } from "../views/DashboardPage";
import { SchedulesPage } from "../views/SchedulesPage";
import { ChainsPage } from "../views/ChainsPage";
import { RunsPage } from "../views/RunsPage";
import { ContextPage } from "../views/ContextPage";
import { RegistryPage } from "../views/RegistryPage";
import { AuditLogPage } from "../views/AuditLogPage";
import { SettingsPage } from "../views/SettingsPage";
import { ApiDocsPage } from "../views/ApiDocsPage";
import { McpConsolePage } from "../views/McpConsolePage";
import { A2aConsolePage } from "../views/A2aConsolePage";
import { JobsPage } from "../views/JobsPage";

const IDAM_API_BASE = "/api";

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("cookie"),
  API_KEY_HEADER: z.string().default("X-API-Key"),
  APP_VERSION: z.string().optional(),
});
type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

// W28E-1863 fix-wave-c (WSC-014 / PS-30 UI-R7.3): build identity for the About page.
// The scheduler web tier serves a same-origin `/version` that emits source_commit +
// build_date (config-routed from the container build). The static inline runtime
// config only carries a hard-coded APP_VERSION, so per-build provenance is fetched
// here and passed to the shared @cloud-dog/shell AboutPage (which already renders
// commitHash/buildDate) — no fork of the shared component.
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
  const navigate = useNavigate();
  const auth = useAuth();
  setIdamTransportAuth({ apiKey: auth.getAccessToken?.() ?? null });
  const cfg = useConfig<AppRuntimeConfig>();
  const app = useAppState();
  const buildIdentity = useBuildIdentity();
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [loginDraft, setLoginDraft] = React.useState("");
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const onApiKeyLogin = React.useCallback(async (apiKey: string) => {
    setLoginError(null);
    try {
      await auth.login({ apiKey });
      try { sessionStorage.setItem("scheduler-mcp.apikey", apiKey); } catch { /* ignore */ }
    } catch (e: any) { setLoginError(e?.message ?? "Login failed"); }
  }, [auth]);
  // Restore the api-key session from sessionStorage on mount so a full-page
  // reload (or a test using page.goto) doesn't drop the user back to /login.
  React.useEffect(() => {
    if (auth.isAuthenticated || cfg.AUTH_MODE !== "api_key") return;
    let saved: string | null = null;
    try { saved = sessionStorage.getItem("scheduler-mcp.apikey"); } catch { saved = null; }
    if (saved) {
      void auth.login({ apiKey: saved }).catch(() => {
        try { sessionStorage.removeItem("scheduler-mcp.apikey"); } catch { /* ignore */ }
      });
    }
  }, [auth, cfg.AUTH_MODE]);
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
      const probeOne = async (idx: number, url: string) => {
        try {
          const res = await fetch(url, { credentials: "include" });
          next[idx] = { ...next[idx], status: res.ok ? "ok" : "error" };
        } catch {
          next[idx] = { ...next[idx], status: "error" };
        }
      };
      await Promise.all([
        probeOne(0, `${cfg.API_BASE_URL}/health`),
        probeOne(1, `${origin}/mcp/health`),
        probeOne(2, `${origin}/a2a/health`),
      ]);
      if (!cancelled) setServices(next);
    };
    void probe();
    const timer = window.setInterval(() => {
      void probe();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cfg.API_BASE_URL, auth.isAuthenticated]);

  const navItems: NavItemType[] = [
    {
      label: "Scheduler",
      path: "/",
      icon: navIcon(CalendarClock),
      children: [
        { label: "Dashboard", path: "/", icon: navIcon(LayoutDashboard) },
        { label: "Schedules", path: "/schedules", icon: navIcon(CalendarClock) },
        { label: "Chains", path: "/chains", icon: navIcon(Workflow) },
        { label: "Runs", path: "/runs", icon: navIcon(ListChecks) },
        { label: "Context", path: "/context", icon: navIcon(Database) },
        { label: "Registry", path: "/registry", icon: navIcon(Layers) },
        { label: "Audit Log", path: "/audit-log", icon: navIcon(FileText) },
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
        { label: "Jobs", path: "/system/jobs", icon: navIcon(ClipboardList) },
        { label: "Settings", path: "/system/settings", icon: navIcon(Settings) },
        { label: "About", path: "/system/about", icon: navIcon(Info) },
      ],
    },
  ];

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
        mode={cfg.AUTH_MODE}
        apiKeyValue={loginDraft}
        onApiKeyChange={setLoginDraft}
        onApiKeySubmit={({ apiKey }) => onApiKeyLogin(apiKey)}
        error={loginError ?? auth.error}
      />
    );
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
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/schedules" element={<SchedulesPage />} />
        <Route path="/chains" element={<ChainsPage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/context" element={<ContextPage />} />
        <Route path="/registry" element={<RegistryPage />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="/admin/users" element={<IdamUsersPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/groups" element={<IdamGroupsPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/api-keys" element={<IdamApiKeysPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/roles" element={<IdamRolesPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/rbac" element={<IdamRbacPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/developer/api-docs" element={<ApiDocsPage />} />
        <Route path="/developer/mcp-console" element={<McpConsolePage />} />
        <Route path="/developer/a2a-console" element={<A2aConsolePage />} />
        <Route path="/system/jobs" element={<JobsPage />} />
        <Route path="/system/settings" element={<SettingsPage />} />
        {/* W28E-1845 / PS-WEBUI-URL-CANONICAL §11: canonical /system/about renders
            the shared @cloud-dog/shell AboutPage; service profile copy preserved
            via the serviceProfile extension slot (no-loss). /about 308s below. */}
        <Route
          path="/system/about"
          element={
            <AboutPage
              productName={manifest.appName}
              description="Scheduler MCP — schedules, chains, runs on cloud_dog_jobs."
              version={app.appVersion}
              commitHash={buildIdentity.commitHash}
              buildDate={buildIdentity.buildDate}
              serviceProfile="Scheduler / chains / runs control plane. Backed by cloud_dog_jobs, cloud_dog_db, cloud_dog_cache, cloud_dog_storage, cloud_dog_idam, cloud_dog_logging."
            />
          }
        />
        <Route path="/audit" element={<Navigate to="/audit-log" replace />} />
        <Route path="/diagnostics-audit" element={<Navigate to="/audit-log" replace />} />
        <Route path="/observability" element={<Navigate to="/audit-log" replace />} />
        <Route path="/logs" element={<Navigate to="/audit-log" replace />} />
        <Route path="/idam/users" element={<Navigate to="/admin/users" replace />} />
        <Route path="/idam/groups" element={<Navigate to="/admin/groups" replace />} />
        <Route path="/idam/api-keys" element={<Navigate to="/admin/api-keys" replace />} />
        <Route path="/idam/roles" element={<Navigate to="/admin/roles" replace />} />
        <Route path="/idam/rbac" element={<Navigate to="/admin/rbac" replace />} />
        <Route path="/jobs" element={<Navigate to="/system/jobs" replace />} />
        <Route path="/settings" element={<Navigate to="/system/settings" replace />} />
        <Route path="/about" element={<Navigate to="/system/about" replace />} />
        <Route path="/api-docs" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/docs" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/openapi" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/mcp-console" element={<Navigate to="/developer/mcp-console" replace />} />
        <Route path="/a2a-console" element={<Navigate to="/developer/a2a-console" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
        description="Scheduler MCP — schedules, chains, runs on cloud_dog_jobs."
        version={app.appVersion}
      />
      <CopyrightFooter />
      {/* W28K-1408 F-1408-9 — AA contrast: muted-foreground/50 @10px failed axe
          (2.14:1). neutral-600/-400 @12px clears the 4.5:1 normal-text threshold. */}
      <p className="px-3 pb-1 text-xs text-neutral-600 dark:text-neutral-400">Session timeout: 30 min</p>
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
        mode: cfg.AUTH_MODE,
        apiBaseUrl: cfg.API_BASE_URL,
        cookie: { loginPath: "/v1/auth/login", mePath: "/v1/auth/me", logoutPath: "/v1/auth/logout" },
        apiKey: { username: "admin", displayName: "Admin" },
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
