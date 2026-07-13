// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { useConfig } from "@cloud-dog/config";
import { buildApi, type SbomApi } from "../lib/api";

interface AppCfg {
  API_BASE_URL: string;
  APP_VERSION?: string;
}

interface SbomState {
  tenant: string;
  selectedScanId: string | null;
  setSelectedScanId: (id: string | null) => void;
  api: SbomApi;
  appVersion: string;
}

const Ctx = React.createContext<SbomState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const cfg = useConfig<AppCfg>();
  const [selectedScanId, setSelectedScanId] = React.useState<string | null>(null);
  const api = React.useMemo(() => buildApi(cfg.API_BASE_URL), [cfg.API_BASE_URL]);
  const value = React.useMemo<SbomState>(
    () => ({
      tenant: "tenant-default",
      selectedScanId,
      setSelectedScanId,
      api,
      appVersion: cfg.APP_VERSION ?? "0.1.0",
    }),
    [selectedScanId, api, cfg.APP_VERSION]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSbomState(): SbomState {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useSbomState must be used inside AppStateProvider");
  return v;
}
