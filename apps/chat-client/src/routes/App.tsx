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

// @cloud-dog/app-chat-client — App routes and top-level providers.

import * as React from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  FileText,
  FolderOpen,
  Info,
  Key,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Server,
  Settings,
  Shield,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import { z } from "zod";
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from "@cloud-dog/config";
import { AuthProvider, LoginPage, SessionTimeoutProvider, useAuth } from "@cloud-dog/auth";
import {
  AboutDialog,
  RightDrawer,
  ServiceStatusBar,
  ShellLayout,
  chatLayoutPreset,
} from "@cloud-dog/shell";
import type { NavItemType, ServiceStatus } from "@cloud-dog/shell";
import { BRAND_NAME } from "@cloud-dog/tokens";
import {
  LogViewer,
  ToolCallPanel,
  formatRelative,
} from "@cloud-dog/ui";
import { manifest } from "./manifest";
import { AppStateProvider, useAppState } from "../state/AppState";
import { SessionsPage } from "../views/SessionsPage";
import { ChatPage } from "../views/ChatPage";
import { McpHealthPage } from "../views/McpHealthPage";
import { ToolsPage } from "../views/ToolsPage";
import { SettingsPage } from "../views/SettingsPage";
import { UsersPage } from "../views/UsersPage";
import { GroupsPage } from "../views/GroupsPage";
import { ApiKeysPage } from "../views/ApiKeysPage";
import { AdminPage } from "../views/AdminPage";
import { McpConsolePage } from "../views/McpConsolePage";
import { A2aConsolePage } from "../views/A2aConsolePage";
import { MonitoringPage } from "../views/MonitoringPage";
import { DashboardPage } from "../views/DashboardPage";
import { DocsPage } from "../views/DocsPage";
import { JobsPageView } from "../views/JobsPageView";
import { FileBrowserPage } from "../views/FileBrowserPage";
import { ProfilesPage } from "../views/ProfilesPage";
import { isAdminUser } from "../lib/rbac";

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  AUTH_MODE: z.enum(["api_key", "cookie", "oidc"]).default("api_key"),
  API_KEY_HEADER: z.string().default("X-API-Key"),
  APP_VERSION: z.string().optional(),
  MCP_BASE_URL: z.string().default("/mcp"),
  A2A_EVENTS_URL: z.string().default("/a2a/events"),
  A2A_WS_URL: z.string().default("/a2a/ws"),
  SESSION_TIMEOUT_MINUTES: z.number().default(30),
  SESSION_WARNING_MINUTES: z.number().default(5),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

const navIcon = (Icon: React.ElementType) => <Icon aria-hidden="true" className="h-4 w-4" />;
const ACTIVITY_EVENTS_TIMER = ["mousemove", "keydown", "scroll", "click", "touchstart"] as const;

function appUrl(baseUrl: string, path: string): string {
  const base = (baseUrl || window.location.origin).endsWith("/")
    ? (baseUrl || window.location.origin)
    : `${baseUrl || window.location.origin}/`;
  return new URL(path.replace(/^\/+/, ""), base).toString();
}

function useSessionCountdown(timeoutMinutes: number): string {
  const totalSeconds = Math.max(1, Math.round(timeoutMinutes * 60));
  const [secondsLeft, setSecondsLeft] = React.useState(totalSeconds);
  const lastActivityRef = React.useRef(Date.now());

  React.useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    for (const ev of ACTIVITY_EVENTS_TIMER) {
      document.addEventListener(ev, onActivity, { passive: true });
    }
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      setSecondsLeft(Math.max(0, totalSeconds - elapsed));
    }, 1000);
    return () => {
      window.clearInterval(interval);
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
      className="rounded border border-border px-2 py-1 font-mono text-xs text-muted-foreground"
      aria-label={`Session expires in ${countdown}`}
      title="Session timeout countdown"
    >
      Session: {countdown}
    </span>
  );
}

function ActivityDrawer() {
  const { toolResults, mcpHealth } = useAppState();

  const logLines = toolResults.map((item) => {
    return `${formatRelative(new Date(item.timestamp))} | server:${item.serverIndex} | tool:${item.toolName}`;
  });

  return (
    <RightDrawer>
      <div className="w-[22rem] max-w-[85vw] space-y-3">
        <h2 className="text-lg font-semibold">Activity</h2>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">External service health</h3>
        {mcpHealth.length === 0 ? (
          <p className="text-xs text-muted-foreground">No external service health data yet.</p>
        ) : (
            mcpHealth.map((item) => (
              <p key={item.index} className="text-xs">
                {item.index}: {item.name} - {item.ok ? "GREEN" : "RED"}
                {typeof item.latency_ms === "number" ? ` (${item.latency_ms}ms)` : ""}
              </p>
            ))
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Tool results</h3>
          {toolResults.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tool executions yet.</p>
          ) : (
            toolResults.slice(0, 3).map((item) => (
              <ToolCallPanel
                key={`${item.timestamp}-${item.serverIndex}-${item.toolName}`}
                toolName={`${item.serverIndex}:${item.toolName}`}
                args={item.arguments}
                result={item.result}
                defaultOpen={false}
              />
            ))
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Recent log lines</h3>
          <LogViewer lines={logLines.slice(0, 40)} defaultPaused={true} />
        </div>
      </div>
    </RightDrawer>
  );
}

function ShellApp() {
  const loc = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const cfg = useConfig<AppRuntimeConfig>();
  const { api, apiKey, setApiKey } = useAppState();
  const isAdmin = isAdminUser(auth.user);

  const [loginDraft, setLoginDraft] = React.useState(apiKey);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [versionLabel, setVersionLabel] = React.useState(cfg.APP_VERSION ?? "");
  const [serviceStatuses, setServiceStatuses] = React.useState<ServiceStatus[]>([
    { name: "API", url: `${cfg.API_BASE_URL}/health`, status: "unknown" },
    { name: "MCP", url: `${cfg.MCP_BASE_URL}/health`, status: "unknown" },
    { name: "A2A", url: cfg.A2A_EVENTS_URL.replace(/\/events$/, "/health"), status: "unknown" },
  ]);

  React.useEffect(() => {
    document.title = `${BRAND_NAME} : ${manifest.appName}`;
  }, []);

  React.useEffect(() => {
    setLoginDraft(apiKey);
  }, [apiKey]);

  React.useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;

    const loadVersion = async () => {
      try {
        const info = await api.getVersionInfo();
        if (!cancelled) setVersionLabel(info.version || cfg.APP_VERSION || "");
      } catch {
        if (!cancelled) setVersionLabel(cfg.APP_VERSION || "");
      }
    };

    const probe = async () => {
      const targets: Array<{ name: string; url: string }> = [
        { name: "API", url: `${cfg.API_BASE_URL}/health` },
        { name: "MCP", url: `${cfg.MCP_BASE_URL}/health` },
        { name: "A2A", url: cfg.A2A_EVENTS_URL.replace(/\/events$/, "/health") },
      ];
      const next: ServiceStatus[] = [];
      for (const target of targets) {
        try {
          const resp = await fetch(target.url, { credentials: "include" });
          next.push({ name: target.name, url: target.url, status: resp.ok ? "ok" : "error" });
        } catch {
          next.push({ name: target.name, url: target.url, status: "error" });
        }
      }
      if (!cancelled) setServiceStatuses(next);
    };

    void loadVersion();
    void probe();
    const timer = window.setInterval(() => void probe(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [api, auth.isAuthenticated, cfg.A2A_EVENTS_URL, cfg.API_BASE_URL, cfg.APP_VERSION, cfg.MCP_BASE_URL]);

  const navItems: NavItemType[] = [
    {
      label: "Chat Client",
      path: "/",
      icon: navIcon(MessageSquare),
      children: [
        { label: "Dashboard", path: "/", icon: navIcon(LayoutDashboard) },
        { label: "Chat", path: "/chat", icon: navIcon(MessageSquare) },
        { label: "Sessions", path: "/sessions", icon: navIcon(Activity) },
        { label: "Profiles", path: "/profiles", icon: navIcon(Layers) },
        { label: "External Services", path: "/mcp-servers", icon: navIcon(Server) },
        { label: "Tools", path: "/tools", icon: navIcon(Wrench) },
        { label: "File Browser", path: "/files", icon: navIcon(FolderOpen) },
        { label: "Monitoring", path: "/monitoring", icon: navIcon(Activity) },
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
    ...(isAdmin
        ? [{
          label: "Admin",
          path: "/admin/users",
          icon: navIcon(Users),
          children: [
            { label: "Users", path: "/admin/users", icon: navIcon(Users) },
            { label: "Groups", path: "/admin/groups", icon: navIcon(Users) },
            { label: "API Keys", path: "/admin/api-keys", icon: navIcon(Key) },
            { label: "RBAC", path: "/admin/rbac", icon: navIcon(Shield) },
          ],
        }]
      : []),
  ];

  const onLogin = async (value: string) => {
    setLoginError(null);
    const apiKey = value.trim();
    try {
      // W28A-798: in api-key AUTH_MODE the WebUI authenticates via the api-key
      // header path (api-client sends the configured key on every request), not
      // the cookie-exchange endpoint. The /login/session cookie exchange is only
      // used in cookie AUTH_MODE.
      if (cfg.AUTH_MODE === "api_key") {
        // Validate the key server-side via the canonical login endpoint (the local
        // api-key adapter does not validate). /login/session returns 401 for an
        // invalid key (so it stays on login with an error) and 200 for a valid one.
        // On success the SPA also uses the api-key header for subsequent requests.
        const probe = await fetch(appUrl(cfg.API_BASE_URL, "/login/session"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: apiKey }),
        });
        if (!probe.ok) {
          let detail = "Invalid API key";
          try {
            const body = (await probe.json()) as { detail?: unknown };
            if (typeof body.detail === "string" && body.detail.trim()) detail = body.detail;
          } catch {
            // keep default
          }
          throw new Error(detail);
        }
        setApiKey(apiKey);
        await auth.login({ apiKey });
        setLoginDraft("");
        if (loc.pathname === "/login") navigate("/chat");
        return;
      }
      const response = await fetch(appUrl(cfg.API_BASE_URL, "/login/session"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      if (!response.ok) {
        let detail = "Sign-in failed";
        try {
          const body = (await response.json()) as { detail?: unknown };
          if (typeof body.detail === "string" && body.detail.trim()) detail = body.detail;
        } catch {
          // Keep the generic message when the response is not JSON.
        }
        throw new Error(detail);
      }
      setApiKey("");
      setLoginDraft("");
      await auth.refresh();
      if (loc.pathname === "/login") navigate("/chat");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Sign-in failed");
      setApiKey("");
    }
  };

  const onLogout = async () => {
    setApiKey("");
    await auth.logout();
    navigate("/login");
  };

  if (!auth.isAuthenticated) {
    return (
      <LoginPage
        appName={manifest.appName}
        mode="api_key"
        apiKeyValue={loginDraft}
        onApiKeyChange={setLoginDraft}
        onApiKeySubmit={({ apiKey }) => onLogin(apiKey)}
        error={loginError ?? auth.error}
      />
    );
  }

  return (
    <SessionTimeoutProvider
      timeoutMinutes={cfg.SESSION_TIMEOUT_MINUTES}
      warningMinutes={cfg.SESSION_WARNING_MINUTES}
    >
      <ShellLayout
        appName={manifest.appName}
        homePath="/"
        navItems={navItems}
        preset={chatLayoutPreset}
        userMenu={{
          displayName: auth.user?.displayName ?? "admin",
          email: auth.user?.email,
          onSettings: () => navigate("/settings"),
          onLogout,
        }}
      >
        <div className="space-y-4">
          <ServiceStatusBar services={serviceStatuses} />
          <div>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/dashboard" element={<Navigate to="/" replace />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/sessions" element={<SessionsPage />} />
                <Route path="/mcp-servers" element={<McpHealthPage />} />
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="/mcp-console" element={<McpConsolePage />} />
                <Route path="/a2a-console" element={<A2aConsolePage />} />
                <Route path="/monitoring" element={<MonitoringPage />} />
                <Route path="/jobs" element={<JobsPageView />} />
                <Route path="/files" element={<FileBrowserPage />} />
                <Route path="/docs" element={<Navigate to="/api-docs" replace />} />
                <Route path="/api-docs" element={<DocsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/profiles" element={<ProfilesPage />} />
                <Route path="/admin" element={<Navigate to={isAdmin ? "/admin/rbac" : "/"} replace />} />
                <Route path="/admin/rbac" element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
                <Route path="/admin/users" element={isAdmin ? <UsersPage /> : <Navigate to="/" replace />} />
                <Route path="/admin/groups" element={isAdmin ? <GroupsPage /> : <Navigate to="/" replace />} />
                <Route path="/admin/api-keys" element={isAdmin ? <ApiKeysPage /> : <Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited</span>
              <span>Version {versionLabel || cfg.APP_VERSION || "unknown"}</span>
            </div>
            <SessionTimerDisplay timeoutMinutes={cfg.SESSION_TIMEOUT_MINUTES} />
          </div>
          <AboutDialog
            open={aboutOpen}
            onOpenChange={setAboutOpen}
            productName={manifest.appName}
            description="Cloud-Dog chat-client orchestrates LLM, MCP, and A2A workflows through a shared operational UI shell."
            version={versionLabel}
          />
        </div>
        <ActivityDrawer />
      </ShellLayout>
    </SessionTimeoutProvider>
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
      <AppStateProvider>
        <ShellApp />
      </AppStateProvider>
    </AuthProvider>
  );
}
