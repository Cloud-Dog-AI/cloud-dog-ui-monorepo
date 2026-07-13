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

// @cloud-dog/app-chat-client — Research chat-action route (W28F-948 D3).
//
// Interactive multimodal research console: query + optional image upload (via
// the file-mcp proxy, PS-94), streaming SSE progress (live entity-graph +
// convergence-cluster + media results), an output-language toggle that drives
// `synthesise_in`, and per-attachment download. All rendering uses shared
// @cloud-dog/ui multimodal components — no bespoke media framework.

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  ConvergenceClusterLive,
  DragDropUpload,
  EntityGraphLive,
  ImagePreview,
  LanguageToggle,
  RTL_LANGUAGES,
  Spinner,
  Textarea,
} from "@cloud-dog/ui";
import type { OutputLanguage } from "@cloud-dog/ui";
import { useAppState } from "../state/AppState";
import { isReadOnlyUser } from "../lib/rbac";
import { useAuth } from "@cloud-dog/auth";
import {
  foldResearchEvent,
  initialResearchState,
  type MediaResult,
  type ResearchState,
} from "../lib/media";
import { buildResearchContent, buildResearchImagePath, RESEARCH_TIMEOUT_MS } from "../lib/research";
import { MediaResultList } from "../components/MediaInline";

const IMAGE_UPLOAD_ACCEPT = "image/*";
/** Client-side advisory image cap (50 MB); the authoritative gate is server-side. */
const IMAGE_MAX_BYTES = 50 * 1024 * 1024;

type PendingImage = Readonly<{ file: File; previewUrl: string; artefactRef?: string }>;

export function ResearchRoute() {
  const { api, activeSessionId, createSession } = useAppState();
  const auth = useAuth();
  const readOnly = isReadOnlyUser(auth.user);

  const [query, setQuery] = React.useState("");
  const [language, setLanguage] = React.useState<OutputLanguage>("en");
  const [pendingImage, setPendingImage] = React.useState<PendingImage | null>(null);
  const [research, setResearch] = React.useState<ResearchState>(() => initialResearchState("en"));
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const lastRunRef = React.useRef<{ query: string; imageUrl?: string } | null>(null);

  React.useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    };
  }, [pendingImage]);

  const onPickImage = React.useCallback((file: File) => {
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  }, []);

  const ensureSession = React.useCallback(async (): Promise<string | null> => {
    if (activeSessionId) return activeSessionId;
    return createSession("Research", { kind: "research" });
  }, [activeSessionId, createSession]);

  const runResearch = React.useCallback(
    async (lang: OutputLanguage, opts?: { reuseImageUrl?: string; reuseQuery?: string }) => {
      const effectiveQuery = (opts?.reuseQuery ?? query).trim();
      if (!effectiveQuery || readOnly) return;
      const sessionId = await ensureSession();
      if (!sessionId) {
        setResearch((s) => ({ ...s, status: "error", error: "Could not start a research session." }));
        return;
      }

      let imageUrl = opts?.reuseImageUrl;
      setResearch({ ...initialResearchState(lang), status: "running" });

      try {
        if (imageUrl === undefined && pendingImage) {
          if (pendingImage.artefactRef) {
            imageUrl = pendingImage.artefactRef;
          } else {
            const upload = await api.uploadFile(sessionId, {
              file: pendingImage.file,
              path: buildResearchImagePath(pendingImage.file),
            });
            imageUrl = upload.path;
            setPendingImage((prev) => (prev ? { ...prev, artefactRef: upload.path } : prev));
          }
        }

        lastRunRef.current = { query: effectiveQuery, imageUrl };

        await api.streamMessage(sessionId, buildResearchContent({ query: effectiveQuery, imageUrl, language: lang }), RESEARCH_TIMEOUT_MS, {
          onDelta: (delta) => setResearch((s) => ({ ...s, text: s.text + delta })),
          onEvent: (event) => setResearch((s) => foldResearchEvent(s, event)),
        });
        setResearch((s) => (s.status === "error" ? s : { ...s, status: "done" }));
      } catch (err) {
        setResearch((s) => ({ ...s, status: "error", error: err instanceof Error ? err.message : "Research failed." }));
      }
    },
    [api, ensureSession, pendingImage, query, readOnly],
  );

  const onSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void runResearch(language);
    },
    [language, runResearch],
  );

  const onLanguageChange = React.useCallback(
    (lang: OutputLanguage) => {
      setLanguage(lang);
      // Re-synthesise the prior run in the newly selected language (AT §9.4.6).
      const last = lastRunRef.current;
      if (last && research.status !== "running") {
        void runResearch(lang, { reuseQuery: last.query, reuseImageUrl: last.imageUrl });
      }
    },
    [research.status, runResearch],
  );

  const onDownload = React.useCallback(
    async (media: MediaResult) => {
      if (!activeSessionId || !media.downloadPath) return;
      setDownloadingId(media.id);
      try {
        const file = await api.downloadFileContent(activeSessionId, {
          path: media.downloadPath,
          serverIndex: media.serverIndex ?? null,
          downloadName: media.title,
        });
        const url = URL.createObjectURL(file.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.filename;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } finally {
        setDownloadingId(null);
      }
    },
    [activeSessionId, api],
  );

  const isRunning = research.status === "running";
  const dir = RTL_LANGUAGES.has(research.language) ? "rtl" : "ltr";

  return (
    <div className="flex flex-col gap-6" data-testid="research-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Research</h1>
        <LanguageToggle current={language} onChange={onLanguageChange} disabled={isRunning} />
      </header>

      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Ask a question. Attach an image to ground the research in a picture (it is captioned and searched). Output is
            synthesised in your selected language.
          </p>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={onSubmit} data-testid="research-form">
            <label htmlFor="research-query" className="text-sm font-medium">
              Research query
            </label>
            <Textarea
              id="research-query"
              value={query}
              disabled={readOnly}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. What are the latest developments in NATO air policing?"
              rows={3}
              data-testid="research-query"
            />

            <DragDropUpload
              onUpload={onPickImage}
              accept={IMAGE_UPLOAD_ACCEPT}
              maxSizeBytes={IMAGE_MAX_BYTES}
              disabled={readOnly || isRunning}
              label="Attach an image (optional)"
            />
            {pendingImage ? (
              <div data-testid="research-image-preview">
                <ImagePreview src={pendingImage.previewUrl} alt={pendingImage.file.name} caption={pendingImage.file.name} />
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={readOnly || isRunning || query.trim().length === 0} data-testid="research-submit">
                {isRunning ? "Researching…" : "Research"}
              </Button>
              {readOnly ? <span className="text-xs text-muted-foreground">Read-only role cannot start research.</span> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {isRunning ? (
        <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="research-loading">
          <Spinner className="h-5 w-5" /> Researching…
        </div>
      ) : null}
      {research.status === "error" ? (
        <p role="alert" className="text-sm text-destructive" data-testid="research-error">
          {research.error}
        </p>
      ) : null}

      {research.status !== "idle" ? (
        <section aria-live="polite" className="flex flex-col gap-6" data-testid="research-results">
          {research.text ? (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Synthesis</h2>
              </CardHeader>
              <CardContent>
                <p dir={dir} className="whitespace-pre-wrap text-sm text-foreground" data-testid="research-synthesis">
                  {research.text}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {research.media.length > 0 ? (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Media</h2>
              </CardHeader>
              <CardContent>
                <MediaResultList items={research.media} onDownload={onDownload} downloadingId={downloadingId} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Entity graph</h2>
            </CardHeader>
            <CardContent>
              <EntityGraphLive events={research.entityEvents} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Convergence</h2>
            </CardHeader>
            <CardContent>
              <ConvergenceClusterLive events={research.convergenceEvents} />
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
