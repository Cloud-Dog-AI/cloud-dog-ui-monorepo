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
  Activity,
  BarChart3,
  ClipboardList,
  Database,
  Edit3,
  Eye,
  FileText,
  FileType,
  FolderOpen,
  GitBranch,
  Globe,
  Image,
  Info,
  Key,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Palette,
  PieChart,
  Radio,
  RefreshCw,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Shapes,
  Sparkles,
  Table2,
  Terminal,
  Users,
  Wrench,
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
import { AppStateProvider, useChartState } from "../state/AppState";
import { ChartWorkflowProvider } from "../state/ChartWorkflow";
import { DashboardPage } from "../views/DashboardPage";
import { ProfilesPage } from "../views/ProfilesPage";
import { SessionsPage } from "../views/SessionsPage";
import { RendersPage } from "../views/RendersPage";
import { AssetsPage } from "../views/AssetsPage";
import { StylePacksPage } from "../views/StylePacksPage";
import { RendererHealthPage } from "../views/RendererHealthPage";
import { RecommendationsPage } from "../views/RecommendationsPage";
import { AuditPage } from "../views/AuditPage";
import { JobsPage } from "../views/JobsPage";
import { SettingsPage } from "../views/SettingsPage";
import { ApiDocsPage } from "../views/ApiDocsPage";
import { McpConsolePage } from "../views/McpConsolePage";
import { A2aConsolePage } from "../views/A2aConsolePage";
// W28F-931 — the 9 missing FR1.40 page kinds (data workflow + lifecycle + licence).
import { DataInputPage } from "../views/DataInputPage";
import { DataPreviewPage } from "../views/DataPreviewPage";
import { FieldMappingPage } from "../views/FieldMappingPage";
import { ChartSpecEditorPage } from "../views/ChartSpecEditorPage";
import { StyleSelectorPage } from "../views/StyleSelectorPage";
import { LocaleSelectorPage } from "../views/LocaleSelectorPage";
import { RenderPreviewPage } from "../views/RenderPreviewPage";
import { LifecycleCachePage } from "../views/LifecycleCachePage";
import { LicenceStatusPage } from "../views/LicenceStatusPage";
import { ClipartThemingPanelPage, DiagramPanelPage, MathDocumentPanelPage } from "../views/VisualRenderingPanels";
import { visibleNavItems } from "./role-visibility";

// The shared @cloud-dog/idam admin pages call `${apiBaseUrl}/v1/admin/*` and
// `${apiBaseUrl}/v1/idam/v1/*`; the chart web tier proxies /api -> API tier which
// mounts those at /api/v1/admin/* and /api/v1/idam/v1/*. So apiBaseUrl = "/api".
const IDAM_API_BASE = "/api";

// W28F-910-R1: API_KEY_HEADER schema entry intentionally removed. The chart-mcp
// WebUI runs in AUTH_MODE="cookie" only — the SPA never sets X-API-Key itself
// (the web tier proxies cookie -> API key server-side). Keeping the schema entry
// with .default("X-API-Key") meant the @cloud-dog/config secret heuristic saw a
// "KEY"-substring value on every page-load and emitted a console warning that
// the operator's close-gate refuses to allow-list. Mirrors the chat-client
// drop-API_KEY_HEADER pattern landed in W28A-727-R5 (commit b5defd9).
const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("cookie"),
  APP_VERSION: z.string().optional(),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;

// W28E-1863 fix-wave-c (WSC-014 / PS-30 UI-R7.3): build identity for the About page.
// The chart-mcp web tier serves a same-origin `/version` that emits source_commit +
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
  // W28A-876: feed the active token into the shared IDAM transport. In cookie mode
  // getAccessToken() is null, so the IDAM pages fall back to the session cookie.
  setIdamTransportAuth({ apiKey: auth.getAccessToken?.() ?? null });
  const cfg = useConfig<AppRuntimeConfig>();
  const app = useChartState();
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
      const probeOne = async (idx: number, run: () => Promise<unknown>) => {
        try {
          await run();
          next[idx] = { ...next[idx], status: "ok" };
        } catch {
          next[idx] = { ...next[idx], status: "error" };
        }
      };
      await Promise.all([
        probeOne(0, () => app.api.health()),
        probeOne(1, () => app.api.mcpHealth()),
        probeOne(2, () => app.api.a2aHealth()),
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

  const rawNavItems: NavItemType[] = [
    {
      label: "Chart MCP",
      path: "/",
      icon: navIcon(BarChart3),
      children: [
        { label: "Dashboard", path: "/", icon: navIcon(LayoutDashboard) },
        { label: "Profiles", path: "/profiles", icon: navIcon(FolderOpen) },
        { label: "Sessions", path: "/sessions", icon: navIcon(Layers) },
        { label: "Renders", path: "/renders", icon: navIcon(BarChart3) },
        { label: "Assets", path: "/render-assets", icon: navIcon(Image) },
        { label: "Renderer Health", path: "/renderer-health", icon: navIcon(Sparkles) },
        { label: "Audit Log", path: "/audit-log", icon: navIcon(ClipboardList) },
      ],
    },
    {
      // W28F-931 — chart authoring workflow: data -> preview -> mapping -> spec -> style -> locale -> render preview.
      label: "Workflow",
      path: "/data-input",
      icon: navIcon(PieChart),
      children: [
        { label: "Data Input", path: "/data-input", icon: navIcon(Database) },
        { label: "Data Preview", path: "/data-preview", icon: navIcon(Eye) },
        { label: "Recommendations", path: "/recommendations", icon: navIcon(Lightbulb) },
        { label: "Field Mapping", path: "/field-mapping", icon: navIcon(Table2) },
        { label: "ChartSpec Editor", path: "/chartspec-editor", icon: navIcon(Edit3) },
        { label: "Style Selector", path: "/style-selector", icon: navIcon(Palette) },
        { label: "Style Packs", path: "/style-packs", icon: navIcon(Palette) },
        { label: "Locale Selector", path: "/locale-selector", icon: navIcon(Globe) },
        { label: "Diagram Panel", path: "/diagram-panel", icon: navIcon(GitBranch) },
        { label: "Math / Document", path: "/document-panel", icon: navIcon(FileType) },
        { label: "Clipart / Theming", path: "/clipart-theming", icon: navIcon(Shapes) },
        { label: "Render Preview", path: "/render-preview", icon: navIcon(BarChart3) },
      ],
    },
    {
      // W28F-931 — operator / admin lifecycle + licence views.
      label: "Policy",
      path: "/licence-status",
      icon: navIcon(ShieldCheck),
      children: [
        { label: "Licence Status", path: "/licence-status", icon: navIcon(ScrollText) },
        { label: "Lifecycle / Cache", path: "/lifecycle-cache", icon: navIcon(RefreshCw) },
      ],
    },
    {
      // PS-WEBUI-URL-CANONICAL v1.0 (W28E-1810C): /admin/* is the canonical IDAM
      // namespace; /idam/* remains a 308 alias (backend canonical_webui_redirects).
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
      // PS-WEBUI-URL-CANONICAL v1.0 (W28E-1810C): canonical /developer/* group.
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
      // PS-WEBUI-URL-CANONICAL v1.0 (W28E-1810C): canonical /system/* group.
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
  // W28F-931 — filter the menu by the user's roles. Routes themselves are always
  // mounted so deep-link access is gated by API 403 (UI hide is a UX hint, never
  // an auth boundary).
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
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/renders" element={<RendersPage />} />
        {/* /assets is reserved by the web tier static mount; use /render-assets for the SPA route. */}
        <Route path="/render-assets" element={<AssetsPage />} />
        <Route path="/assets" element={<Navigate to="/render-assets" replace />} />
        <Route path="/style-packs" element={<StylePacksPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/renderer-health" element={<RendererHealthPage />} />
        {/* W28F-931 — 9 missing FR1.40 page kinds (data workflow + lifecycle + licence). */}
        <Route path="/data-input" element={<DataInputPage />} />
        <Route path="/data-preview" element={<DataPreviewPage />} />
        <Route path="/field-mapping" element={<FieldMappingPage />} />
        <Route path="/chartspec-editor" element={<ChartSpecEditorPage />} />
        <Route path="/style-selector" element={<StyleSelectorPage />} />
        <Route path="/locale-selector" element={<LocaleSelectorPage />} />
        <Route path="/diagram-panel" element={<DiagramPanelPage />} />
        <Route path="/document-panel" element={<MathDocumentPanelPage />} />
        <Route path="/clipart-theming" element={<ClipartThemingPanelPage />} />
        <Route path="/render-preview" element={<RenderPreviewPage />} />
        <Route path="/lifecycle-cache" element={<LifecycleCachePage />} />
        <Route path="/licence-status" element={<LicenceStatusPage />} />
        {/* W28F-907 D-935 (GAP A): canonical /audit-log; /audit kept as a back-compat alias. */}
        <Route path="/audit-log" element={<AuditPage />} />
        <Route path="/audit" element={<Navigate to="/audit-log" replace />} />
        <Route path="/diagnostics-audit" element={<Navigate to="/audit-log" replace />} />
        <Route path="/observability" element={<Navigate to="/audit-log" replace />} />
        <Route path="/logs" element={<Navigate to="/audit-log" replace />} />
        {/* PS-71 canonical IDAM routes — shared @cloud-dog/idam components (W28A-876, no forks). */}
        <Route path="/idam/users" element={<IdamUsersPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/idam/groups" element={<IdamGroupsPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/idam/api-keys" element={<IdamApiKeysPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/idam/roles" element={<IdamRolesPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/idam/rbac" element={<IdamRbacPage apiBaseUrl={IDAM_API_BASE} />} />
        {/* /admin/* aliases mount the SAME shared components. */}
        <Route path="/admin/users" element={<IdamUsersPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/groups" element={<IdamGroupsPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/api-keys" element={<IdamApiKeysPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/roles" element={<IdamRolesPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/rbac" element={<IdamRbacPage apiBaseUrl={IDAM_API_BASE} />} />
        {/* PS-WEBUI-URL-CANONICAL: canonical /developer/* + /system/* routes serve the
            page; legacy API-doc aliases redirect here for in-app transitions. */}
        <Route path="/developer/api-docs" element={<ApiDocsPage />} />
        <Route path="/developer/mcp-console" element={<McpConsolePage />} />
        <Route path="/developer/a2a-console" element={<A2aConsolePage />} />
        <Route path="/system/jobs" element={<JobsPage />} />
        <Route path="/system/settings" element={<SettingsPage />} />
        {/* W28E-1845 / PS-WEBUI-URL-CANONICAL §11: canonical /system/about renders the
            shared @cloud-dog/shell AboutPage; the bespoke chart About copy + doc links
            are preserved via the serviceProfile/docLinks extension slots (no-loss). */}
        <Route
          path="/system/about"
          element={
            <AboutPage
              productName={manifest.appName}
              description="Self-hosted, licence-safe chart and table rendering across API, MCP, A2A and WebUI."
              version={app.appVersion}
              commitHash={buildIdentity.commitHash}
              buildDate={buildIdentity.buildDate}
              serviceProfile={
                <div className="space-y-3 text-left">
                  <p>
                    Chart MCP is the Cloud-Dog AI chart rendering service. It accepts structured data, recommends and
                    validates chart specifications deterministically, renders licence-safe chart and table output, and
                    governs temporary assets across API, MCP, A2A and WebUI surfaces.
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Renderers: Vega-Lite (default), Matplotlib (static fallback), Great Tables (styled tables).</li>
                    <li>Licence-first, offline-capable, no proprietary browser runtimes.</li>
                    <li>Identity, RBAC, persistence, storage, cache, jobs and audit via the Cloud-Dog platform packages.</li>
                  </ul>
                </div>
              }
              docLinks={
                <div className="flex flex-wrap gap-3">
                  <a href="/developer/api-docs" className="text-primary underline">API Docs</a>
                  <a href="/developer/mcp-console" className="text-primary underline">MCP Console</a>
                  <a href="/developer/a2a-console" className="text-primary underline">A2A Console</a>
                </div>
              }
            />
          }
        />
        {/* legacy alias: Jobs is canonical at /system/jobs; /jobs 308-redirects (PS-76 JW13.1 / PS-WEBUI-URL-CANONICAL §8). */}
        <Route path="/jobs" element={<Navigate to="/system/jobs" replace />} />
        <Route path="/settings" element={<Navigate to="/system/settings" replace />} />
        {/* W28E-1845: /about is a legacy alias → 308/redirect to canonical /system/about (was dual-render). */}
        <Route path="/about" element={<Navigate to="/system/about" replace />} />
        <Route path="/docs-browser" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/docs" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/openapi" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/api-docs" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/mcp-console" element={<McpConsolePage />} />
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
        description="Self-hosted, licence-safe chart and table rendering across API, MCP, A2A and WebUI."
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
          <ChartWorkflowProvider>
            <ShellApp />
          </ChartWorkflowProvider>
        </AppStateProvider>
      </SessionTimeoutProvider>
    </AuthProvider>
  );
}
