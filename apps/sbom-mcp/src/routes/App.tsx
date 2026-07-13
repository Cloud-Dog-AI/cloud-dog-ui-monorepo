// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

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
  FileSearch,
  FileText,
  Info,
  Key,
  Layers,
  LayoutDashboard,
  PackageSearch,
  Radio,
  ScanLine,
  Settings,
  Shield,
  ShieldCheck,
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
import { AppStateProvider, useSbomState } from "../state/AppState";
import { DashboardPage } from "../views/DashboardPage";
import { SubmitScanPage } from "../views/SubmitScanPage";
import { ScanHistoryPage } from "../views/ScanHistoryPage";
import { ScanDetailPage } from "../views/ScanDetailPage";
import { ScheduledScansPage } from "../views/ScheduledScansPage";
import { WaiversPage } from "../views/WaiversPage";
import { FindingsPage } from "../views/FindingsPage";
import { ReportFilesPage } from "../views/ReportFilesPage";
import { AuditPage } from "../views/AuditPage";
import { JobsPage } from "../views/JobsPage";
import { SettingsPage } from "../views/SettingsPage";
import { ApiDocsPage } from "../views/ApiDocsPage";
import { McpConsolePage } from "../views/McpConsolePage";
import { A2aConsolePage } from "../views/A2aConsolePage";
import { SessionsPage } from "../views/SessionsPage";

// The shared @cloud-dog/idam admin pages call `${apiBaseUrl}/v1/admin/*` and
// `${apiBaseUrl}/v1/idam/v1/*`; the sbom web tier proxies /api -> API tier which
// mounts those at /api/v1/admin/* and /api/v1/idam/v1/*. So apiBaseUrl = "/api".
const IDAM_API_BASE = "/api";

// W28L-1503: API_KEY_HEADER schema entry intentionally omitted. The sbom-mcp WebUI
// runs in AUTH_MODE="cookie" only — the SPA never sets X-API-Key itself (the web
// tier proxies cookie -> API key server-side). Mirrors the chat-client / chart-mcp
// drop-API_KEY_HEADER pattern landed in W28A-727-R5 (commit b5defd9).
const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("cookie"),
  APP_VERSION: z.string().optional(),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

// W28E-1863 fix-wave-d (WSC-014 / PS-30 UI-R7.3): build identity for the About page.
// The sbom-mcp server serves a same-origin `/version` that emits source_commit +
// build_date (config-routed from the container build). The static inline runtime
// config only carries a hard-coded APP_VERSION, so per-build provenance is fetched
// here and passed to the shared @cloud-dog/shell AboutPage (no shell fork).
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
  const app = useSbomState();
  const buildIdentity = useBuildIdentity();
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
      const probeOne = async (idx: number, url: string) => {
        try {
          await app.api.health(new URL(url).pathname);
          next[idx] = { ...next[idx], status: "ok" };
        } catch {
          next[idx] = { ...next[idx], status: "error" };
        }
      };
      await Promise.all([
        probeOne(0, `${origin}/health`),
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
  }, [app.api, cfg.API_BASE_URL, auth.isAuthenticated]);

  const navItems: NavItemType[] = [
    {
      label: "SBOM MCP",
      path: "/",
      icon: navIcon(PackageSearch),
      children: [
        { label: "Dashboard", path: "/", icon: navIcon(LayoutDashboard) },
        { label: "Submit Scan", path: "/scans/new", icon: navIcon(ScanLine) },
        { label: "Scan History", path: "/scans", icon: navIcon(Layers) },
        { label: "Scheduled Scans", path: "/scheduled-scans", icon: navIcon(CalendarClock) },
        { label: "Search", path: "/search", icon: navIcon(FileSearch) },
        { label: "Waivers", path: "/waivers", icon: navIcon(ShieldCheck) },
        { label: "Report Files", path: "/report-files", icon: navIcon(FileText) },
        { label: "Audit Log", path: "/audit-log", icon: navIcon(ClipboardList) },
      ],
    },
    {
      // PS-WEBUI-URL-CANONICAL v1.0 (W28E-1815C): canonical /admin/* namespace.
      // The shared @cloud-dog/idam pages mount under /admin/*; /idam/* remains a
      // server-side 308 alias only (WURL-004).
      label: "Admin",
      path: "/admin/users",
      icon: navIcon(Users),
      children: [
        { label: "Users", path: "/admin/users", icon: navIcon(Users) },
        { label: "Groups", path: "/admin/groups", icon: navIcon(Users) },
        { label: "API Keys", path: "/admin/api-keys", icon: navIcon(Key) },
        { label: "Roles", path: "/admin/roles", icon: navIcon(Shield) },
        { label: "RBAC", path: "/admin/rbac", icon: navIcon(Shield) },
        { label: "Tenant Settings", path: "/system/settings", icon: navIcon(Settings) },
      ],
    },
    {
      // Canonical /developer/* namespace (WURL-DEV-*); legacy /api-docs,
      // /mcp-console, /a2a-console are server-side 308 aliases only.
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
      // Canonical /system/* namespace (WURL-SYSTEM-*); legacy /jobs, /settings,
      // /about are server-side 308 aliases only. /sessions is service-specific.
      label: "System",
      path: "/system/jobs",
      icon: navIcon(Activity),
      children: [
        { label: "Jobs", path: "/system/jobs", icon: navIcon(Layers) },
        { label: "Sessions", path: "/sessions", icon: navIcon(Users) },
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
      {/* W28S-2006 Lane F (WSC-006): contain narrow-viewport horizontal overflow from
          data-dense routed pages (wide tables, shared IDAM admin toolbars, dev consoles)
          inside a page-content scroll region so the document never overflows and no text
          is clipped at mobile/tablet — app-local only, no shared-package edit. */}
      <div className="min-w-0 max-w-full overflow-x-auto">
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/scans" element={<ScanHistoryPage />} />
        <Route path="/scans/new" element={<SubmitScanPage />} />
        <Route path="/scans/:scanId" element={<ScanDetailPage />} />
        <Route path="/scheduled-scans" element={<ScheduledScansPage />} />
        <Route path="/search" element={<FindingsPage />} />
        <Route path="/findings" element={<Navigate to="/search" replace />} />
        <Route path="/scans/:scanId/findings" element={<FindingsPage />} />
        <Route path="/waivers" element={<WaiversPage />} />
        <Route path="/report-files" element={<ReportFilesPage />} />
        <Route path="/audit-log" element={<AuditPage />} />
        <Route path="/audit" element={<Navigate to="/audit-log" replace />} />
        <Route path="/diagnostics-audit" element={<Navigate to="/audit-log" replace />} />
        <Route path="/observability" element={<Navigate to="/audit-log" replace />} />
        <Route path="/logs" element={<Navigate to="/audit-log" replace />} />
        {/* PS-WEBUI-URL-CANONICAL v1.0 (W28E-1815C): canonical /admin/* IDAM
            routes — shared @cloud-dog/idam components (W28A-876, no forks).
            The legacy /idam/* and flat /jobs|/settings|/about|/api-docs|
            /mcp-console|/a2a-console|/audit paths are HTTP 308 server aliases
            (src/sbom_mcp/app.py _LEGACY_WEBUI_REDIRECTS); selected SPA aliases
            are also mounted below as in-app defense in depth. */}
        <Route path="/admin/users" element={<IdamUsersPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/groups" element={<IdamGroupsPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/api-keys" element={<IdamApiKeysPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/roles" element={<IdamRolesPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/rbac" element={<IdamRbacPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/settings" element={<Navigate to="/system/settings" replace />} />
        {/* Canonical /developer/* + /system/* routes render the expected page
            component for canonical deep-links (WURL-001). */}
        <Route path="/developer/api-docs" element={<ApiDocsPage />} />
        <Route path="/api-docs" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/docs" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/openapi" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/developer/mcp-console" element={<McpConsolePage />} />
        <Route path="/developer/a2a-console" element={<A2aConsolePage />} />
        <Route path="/system/jobs" element={<JobsPage />} />
        <Route path="/jobs" element={<Navigate to="/system/jobs" replace />} />
        <Route path="/system/settings" element={<SettingsPage />} />
        <Route path="/settings" element={<Navigate to="/system/settings" replace />} />
        {/* W28E-1845: /about is a legacy alias → redirect to canonical /system/about. */}
        <Route path="/about" element={<Navigate to="/system/about" replace />} />
        {/* W28E-1845 / PS-WEBUI-URL-CANONICAL §11: canonical /system/about renders the
            shared @cloud-dog/shell AboutPage; the bespoke sbom About copy, backend
            summary and doc links are preserved via the serviceProfile/docLinks
            extension slots (no-loss). */}
        <Route
          path="/system/about"
          element={
            <AboutPage
              productName={manifest.appName}
              description="Self-hosted SBOM generation, vulnerability scanning, and licence-aware verdicting across API, MCP, A2A and WebUI."
              version={app.appVersion}
              commitHash={buildIdentity.commitHash}
              buildDate={buildIdentity.buildDate}
              serviceProfile={
                <div className="space-y-3 text-left">
                  <p>
                    sbom-mcp-server is the Cloud-Dog AI software composition and supply-chain analysis
                    service. It queues scans against the platform sbomscanner0 container, normalises
                    grype/trivy/cyclonedx output into a finding index, applies waiver/policy rules, and
                    governs report artefacts across API, MCP, A2A and WebUI surfaces.
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Scanner: sbomscanner0 (syft + grype + trivy + gitleaks).</li>
                    <li>Target types: container images, git repositories, archive files.</li>
                    <li>Storage backends: file, S3, WebDAV, FTP.</li>
                    <li>Identity, RBAC, persistence, jobs and audit via the Cloud-Dog platform packages.</li>
                  </ul>
                </div>
              }
              docLinks={
                <div className="flex flex-wrap gap-3">
                  <a href="/api-docs" className="text-primary underline">API Docs</a>
                  <a href="/mcp-console" className="text-primary underline">MCP Console</a>
                  <a href="/a2a-console" className="text-primary underline">A2A Console</a>
                </div>
              }
            />
          }
        />
        <Route path="/sessions" element={<SessionsPage />} />
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
        description="Self-hosted SBOM generation, vulnerability scanning, and licence-aware verdicting across API, MCP, A2A and WebUI."
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
