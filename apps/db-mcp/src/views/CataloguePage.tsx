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
import { Link } from "react-router-dom";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, type DataColumn } from "@cloud-dog/ui";
import { ProfileSelect } from "../components/ProfileSelect";
import { useDbMcpState } from "../state/AppState";
import type { EntityItem, NamespaceItem } from "../lib/types";

type NamespaceRow = NamespaceItem & Readonly<{ entityCount: number | null }>;

export function CataloguePage() {
  const { api, currentProfile } = useDbMcpState();
  const currentProfileId = currentProfile?.profile_id ?? "";
  const [namespaces, setNamespaces] = React.useState<NamespaceRow[]>([]);
  const [entities, setEntities] = React.useState<EntityItem[]>([]);
  const [selectedNamespace, setSelectedNamespace] = React.useState("");
  const [namespacePage, setNamespacePage] = React.useState(1);
  const [entityPage, setEntityPage] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const lastLoadedProfileIdRef = React.useRef("");
  const activeLoadIdRef = React.useRef(0);
  const catalogueLoadAbortRef = React.useRef<AbortController | null>(null);
  const entityLoadAbortRef = React.useRef<AbortController | null>(null);

  const applyEntityCount = React.useCallback((namespace: string, entityCount: number) => {
    setNamespaces((current) =>
      current.map((item) => (item.name === namespace ? { ...item, entityCount } : item))
    );
  }, []);

  const loadEntities = React.useCallback(async (namespace: string) => {
    if (!currentProfileId || !namespace) {
      entityLoadAbortRef.current?.abort();
      entityLoadAbortRef.current = null;
      setEntities([]);
      return;
    }
    entityLoadAbortRef.current?.abort();
    const controller = new AbortController();
    entityLoadAbortRef.current = controller;
    setSelectedNamespace(namespace);
    setEntityPage(1);
    const items = await api.listEntities(currentProfileId, namespace, { signal: controller.signal });
    if (controller.signal.aborted) return;
    setEntities(items);
    applyEntityCount(namespace, items.length);
  }, [api, applyEntityCount, currentProfileId]);

  const loadCatalogue = React.useCallback(async (force = false) => {
    if (!currentProfileId) {
      catalogueLoadAbortRef.current?.abort();
      catalogueLoadAbortRef.current = null;
      entityLoadAbortRef.current?.abort();
      entityLoadAbortRef.current = null;
      activeLoadIdRef.current += 1;
      lastLoadedProfileIdRef.current = "";
      setNamespaces([]);
      setEntities([]);
      setSelectedNamespace("");
      return;
    }
    if (!force && lastLoadedProfileIdRef.current === currentProfileId) {
      return;
    }
    catalogueLoadAbortRef.current?.abort();
    entityLoadAbortRef.current?.abort();
    const controller = new AbortController();
    catalogueLoadAbortRef.current = controller;
    const loadId = activeLoadIdRef.current + 1;
    activeLoadIdRef.current = loadId;
    setError(null);
    try {
      const namespaceItems = await api.listNamespaces(currentProfileId, { signal: controller.signal });
      if (controller.signal.aborted || activeLoadIdRef.current !== loadId) return;
      const namespaceRows = namespaceItems.map((item) => ({
        ...item,
        entityCount: null,
      }));
      lastLoadedProfileIdRef.current = currentProfileId;
      setNamespaces(namespaceRows);
      const initialNamespace = namespaceRows[0]?.name ?? "";
      setSelectedNamespace(initialNamespace);
      if (initialNamespace) {
        const initialEntities = await api.listEntities(currentProfileId, initialNamespace, { signal: controller.signal });
        if (controller.signal.aborted || activeLoadIdRef.current !== loadId) return;
        setEntities(initialEntities);
        applyEntityCount(initialNamespace, initialEntities.length);
      } else {
        setEntities([]);
      }
    } catch (loadError) {
      if (controller.signal.aborted || activeLoadIdRef.current !== loadId) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load catalogue.");
    }
  }, [api, applyEntityCount, currentProfileId]);

  React.useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  React.useEffect(() => {
    return () => {
      catalogueLoadAbortRef.current?.abort();
      entityLoadAbortRef.current?.abort();
    };
  }, []);

  const namespaceColumns: DataColumn<NamespaceRow>[] = [
    {
      id: "name",
      header: "Namespace",
      cell: (item) => (
        <div className="flex items-center gap-2">
          <span>{item.name}</span>
          {item.name === selectedNamespace ? <Badge>Active</Badge> : null}
        </div>
      ),
      sortable: true,
      sortValue: (item) => item.name,
    },
    { id: "type", header: "Type", cell: (item) => item.type ?? "namespace", sortable: true, sortValue: (item) => item.type ?? "namespace" },
    {
      id: "count",
      header: "Entity count",
      cell: (item) => (item.entityCount ?? "\u2014"),
      sortable: true,
      sortValue: (item) => item.entityCount ?? -1,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (item) => <Button size="sm" variant="secondary" onClick={() => void loadEntities(item.name)}>Browse</Button>,
    },
  ];

  const entityColumns: DataColumn<EntityItem>[] = [
    { id: "name", header: "Entity", cell: (item) => item.name, sortable: true, sortValue: (item) => item.name },
    { id: "type", header: "Type", cell: (item) => item.type ?? "collection", sortable: true, sortValue: (item) => item.type ?? "collection" },
    {
      id: "actions",
      header: "Actions",
      cell: (item) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" asChild>
            <Link to={`/catalogue/${encodeURIComponent(selectedNamespace)}/${encodeURIComponent(item.name)}`}>Schema</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to={`/data/${encodeURIComponent(selectedNamespace)}/${encodeURIComponent(item.name)}`}>Data</Link>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Catalogue</h1>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              lastLoadedProfileIdRef.current = "";
              void loadCatalogue(true);
            }}
          >
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Browse database namespaces and entities. Select a profile on the left to scope the catalogue.
          Entities are read-only references — use the Data Browser or Schema pages to make changes.
        </p>
      </header>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Profile scope</h2></CardHeader>
          <CardContent className="space-y-4">
            <ProfileSelect />
            <div className="rounded-lg border px-3 py-3 text-sm text-muted-foreground">
              <p>Allowed namespaces: {currentProfile?.namespaces.join(", ") || "all returned by the profile"}</p>
              <p>Allowed entities: {currentProfile?.entities.join(", ") || "all returned by the profile"}</p>
            </div>
            <DataTable
              columns={namespaceColumns}
              rows={namespaces}
              emptyMessage="No namespaces available for the selected profile."
              page={namespacePage}
              pageSize={8}
              onPageChange={setNamespacePage}
              selectable
              columnPickerEnabled
              tableId="db-mcp-catalogue-namespaces"
              getRowId={(item) => item.name}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Entities in {selectedNamespace || "selected namespace"}</h2></CardHeader>
          <CardContent>
            <DataTable
              columns={entityColumns}
              rows={entities}
              emptyMessage="Select a namespace to browse entities."
              page={entityPage}
              pageSize={10}
              onPageChange={setEntityPage}
              selectable
              columnPickerEnabled
              tableId="db-mcp-catalogue-entities"
              getRowId={(item) => item.name}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
