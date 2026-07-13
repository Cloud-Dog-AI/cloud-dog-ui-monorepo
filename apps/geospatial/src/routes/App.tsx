// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import * as React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { z } from "zod";
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from "@cloud-dog/config";
import { AuthProvider, LoginPage, SessionTimeoutProvider, useAuth } from "@cloud-dog/auth";
import {
  ShellLayout,
  operationalConsolePreset,
  AboutDialog,
  AboutPage,
  DocLinks,
  ServiceStatusBar,
  CopyrightFooter,
} from "@cloud-dog/shell";
import type { NavItemType, ServiceStatus } from "@cloud-dog/shell";
import {
  Database,
  FileText,
  FolderOpen,
  Globe,
  Image,
  Info,
  Key,
  Layers,
  LayoutDashboard,
  Map as MapIcon,
  MapPin,
  Radio,
  ScrollText,
  Search,
  Server,
  Settings,
  Shield,
  Terminal,
  Users,
} from "lucide-react";
import { Spinner } from "@cloud-dog/ui";
import {
  IdamUsersPage,
  IdamGroupsPage,
  IdamApiKeysPage,
  IdamRolesPage,
  IdamRbacPage,
  setIdamTransportAuth,
} from "@cloud-dog/idam";
import { manifest } from "./manifest";
import { AppStateProvider, useGeoState } from "../state/AppState";
import { DashboardPage } from "../views/DashboardPage";
import { MapPage } from "../views/MapPage";
import { GeocodePage } from "../views/GeocodePage";
import { FeaturesPage } from "../views/FeaturesPage";
import { ImageryPage } from "../views/ImageryPage";
import { ProfilesPage } from "../views/ProfilesPage";
import { SessionsPage } from "../views/SessionsPage";
import { ProvidersPage } from "../views/ProvidersPage";
import { AssetsPage } from "../views/AssetsPage";
import { ReportsPage } from "../views/ReportsPage";
import { AuditPage } from "../views/AuditPage";
import { JobsPage } from "../views/JobsPage";
import { SettingsPage } from "../views/SettingsPage";
import { EgressPage } from "../views/EgressPage";
import { ApiDocsPage } from "../views/ApiDocsPage";
import { McpConsolePage } from "../views/McpConsolePage";
import { A2aConsolePage } from "../views/A2aConsolePage";
import { visibleNavItems } from "./role-visibility";

// The shared @cloud-dog/idam admin pages call `${apiBaseUrl}/v1/admin/*` and
// `${apiBaseUrl}/idam/v1/*`; the geospatial web tier proxies /api -> API tier
// (stripping /api) which mounts those at /v1/admin/* and /idam/v1/*. So
// apiBaseUrl = "/api".
const IDAM_API_BASE = "/api";

// AUTH_MODE is cookie-only for geospatial — the SPA never sets X-API-Key (the
// web tier bridges the cookie to the principal's identity headers server-side).
const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("cookie"),
  APP_VERSION: z.string().optional(),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

// W28E-1863 fix-wave-c (WSC-014 / PS-30 UI-R7.3): build identity for the About page.
// The geospatial web tier serves a same-origin `/version` that emits source_commit +
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
  // Feed the active token into the shared IDAM transport. In cookie mode
  // getAccessToken() is null, so the IDAM pages fall back to the session cookie.
  setIdamTransportAuth({ apiKey: auth.getAccessToken?.() ?? null });
  const cfg = useConfig<AppRuntimeConfig>();
  const app = useGeoState();
  const api = app.api;
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
      const probeOne = async (idx: number, path: string) => {
        const ok = await api.serviceHealth(path);
        next[idx] = { ...next[idx], status: ok ? "ok" : "error" };
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
  }, [api, cfg.API_BASE_URL, auth.isAuthenticated]);

  const rawNavItems: NavItemType[] = [
    {
      label: "Geospatial",
      path: "/",
      icon: navIcon(Globe),
      children: [
        { label: "Dashboard", path: "/", icon: navIcon(LayoutDashboard) },
        { label: "Map", path: "/map", icon: navIcon(MapIcon) },
        { label: "Geocode", path: "/geocode", icon: navIcon(MapPin) },
        { label: "Search", path: "/search", icon: navIcon(Search) },
        { label: "Imagery", path: "/imagery", icon: navIcon(Image) },
        { label: "Profiles", path: "/profiles", icon: navIcon(FolderOpen) },
        { label: "Sessions", path: "/sessions", icon: navIcon(Layers) },
        { label: "Providers", path: "/providers", icon: navIcon(Server) },
        { label: "Assets", path: "/assets", icon: navIcon(Database) },
        { label: "Reports", path: "/reports", icon: navIcon(FileText) },
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
      icon: navIcon(FileText),
      children: [
        { label: "API Docs", path: "/developer/api-docs", icon: navIcon(FileText) },
        { label: "MCP Console", path: "/developer/mcp-console", icon: navIcon(Terminal) },
        { label: "A2A Console", path: "/developer/a2a-console", icon: navIcon(Radio) },
      ],
    },
    {
      label: "System",
      path: "/system/jobs",
      icon: navIcon(Layers),
      children: [
        { label: "Jobs", path: "/system/jobs", icon: navIcon(Layers) },
        { label: "Audit Log", path: "/audit-log", icon: navIcon(ScrollText) },
        { label: "Egress", path: "/system/egress", icon: navIcon(Radio) },
        { label: "Settings", path: "/system/settings", icon: navIcon(Settings) },
        { label: "About", path: "/system/about", icon: navIcon(Info) },
      ],
    },
  ];
  // Filter the menu by the user's roles. Routes themselves are always mounted so
  // deep-link access is gated by API 403 (UI hide is a UX hint, never an auth
  // boundary).
  const navItems: NavItemType[] = visibleNavItems(rawNavItems, auth.user?.roles);

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
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/geocode" element={<GeocodePage />} />
        <Route path="/search" element={<FeaturesPage />} />
        <Route path="/features" element={<Navigate to="/search" replace />} />
        <Route path="/imagery" element={<ImageryPage />} />
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/source-connections" element={<Navigate to="/providers" replace />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        {/* canonical /audit-log; /audit kept as a back-compat alias for local dev. */}
        <Route path="/audit-log" element={<AuditPage />} />
        <Route path="/audit" element={<Navigate to="/audit-log" replace />} />
        <Route path="/diagnostics-audit" element={<Navigate to="/audit-log" replace />} />
        <Route path="/observability" element={<Navigate to="/audit-log" replace />} />
        <Route path="/logs" element={<Navigate to="/audit-log" replace />} />
        {/* PS-71 canonical admin routes — shared @cloud-dog/idam components (no forks). */}
        <Route path="/admin/users" element={<IdamUsersPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/groups" element={<IdamGroupsPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/api-keys" element={<IdamApiKeysPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/roles" element={<IdamRolesPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/rbac" element={<IdamRbacPage apiBaseUrl={IDAM_API_BASE} />} />
        {/* /idam/* aliases mount the same shared components for local dev; the web tier 308s them. */}
        <Route path="/idam/users" element={<IdamUsersPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/idam/groups" element={<IdamGroupsPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/idam/api-keys" element={<IdamApiKeysPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/idam/roles" element={<IdamRolesPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/idam/rbac" element={<IdamRbacPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/system/jobs" element={<JobsPage />} />
        <Route path="/jobs" element={<Navigate to="/system/jobs" replace />} />
        <Route path="/system/egress" element={<EgressPage />} />
        <Route path="/egress" element={<Navigate to="/system/egress" replace />} />
        <Route path="/system/settings" element={<SettingsPage />} />
        <Route path="/settings" element={<Navigate to="/system/settings" replace />} />
        <Route path="/about" element={<Navigate to="/system/about" replace />} />
        <Route
          path="/system/about"
          element={
            <AboutPage
              productName={manifest.appName}
              description="Governed geospatial evidence foundation across API, MCP, A2A and WebUI."
              version={app.appVersion}
              commitHash={buildIdentity.commitHash}
              buildDate={buildIdentity.buildDate}
              serviceProfile={
                <div className="space-y-3 text-sm">
                  <p>
                    Geospatial MCP is the Cloud-Dog AI geospatial evidence service. It supports open-provider discovery,
                    geocoding, map rendering, imagery search, evidence bundles, report export, and governed assets across
                    API, MCP, A2A and WebUI surfaces.
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>Providers: keyless open geocoding, feature discovery, and STAC-style imagery source catalogues.</li>
                    <li>Deterministic report and map outputs with source attribution, provenance, and asset lifecycle controls.</li>
                    <li>Identity, RBAC, persistence, storage, cache, jobs and audit via the Cloud-Dog platform packages.</li>
                  </ul>
                </div>
              }
              docLinks={
                <div className="flex flex-wrap gap-3 pt-2">
                  <a href="/developer/api-docs" className="text-primary underline">API Docs</a>
                  <a href="/developer/mcp-console" className="text-primary underline">MCP Console</a>
                  <a href="/developer/a2a-console" className="text-primary underline">A2A Console</a>
                </div>
              }
            />
          }
        />
        <Route path="/developer/api-docs" element={<ApiDocsPage />} />
        <Route path="/api-docs" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/docs" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/openapi" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/developer/mcp-console" element={<McpConsolePage />} />
        <Route path="/mcp-console" element={<Navigate to="/developer/mcp-console" replace />} />
        <Route path="/developer/a2a-console" element={<A2aConsolePage />} />
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
        description="Governed geospatial evidence foundation across API, MCP, A2A and WebUI."
        version={app.appVersion}
      />
      <CopyrightFooter />
      <p className="px-3 pb-1 text-[10px] text-muted-foreground">Session timeout: 30 min</p>
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
