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

// @vitest-environment jsdom
//
// AT for the W28F-948 §9.4.6 chat-client inline multimodal gate at the
// component level: drag-drop image upload → research round-trip → progressive
// SSE render (synthesis + entity-graph + convergence + media) → language toggle
// re-synthesis. The live preprod Playwright AT is the deferred integration gate.

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// jsdom does not implement object URLs; the component only needs them to render
// an in-memory image preview, so a stub is sufficient for this unit AT.
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

type StreamHandlers = { onDelta: (d: string) => void; onEvent?: (e: unknown) => void };

const mocks = vi.hoisted(() => {
  const scriptedEvents = [
    { type: "entity_node", id: "a", label: "Anthropic", entity_type: "org" },
    { type: "entity_node", id: "b", label: "Claude" },
    { type: "entity_edge", source: "a", target: "b", relation: "makes" },
    { type: "convergence_cluster", cluster: { id: "c1", claim: "Model released", sources: [{ id: "s1", title: "Reuters", url: "https://r" }] } },
    { type: "media", media: { media_type: "image", url: "https://i/result.png", mime_type: "image/png", caption: "diagram" } },
    { type: "done" },
  ];
  const uploadFile = vi.fn(async (_sessionId: string, args: { file: File; path: string }) => ({ path: args.path, serverIndex: null, toolResult: {} }));
  const streamMessage = vi.fn(async (_sessionId: string, content: string, _timeout: number, handlers: StreamHandlers) => {
    handlers.onDelta("Synthesised answer. ");
    for (const ev of scriptedEvents) handlers.onEvent?.(ev);
    return "Synthesised answer. ";
  });
  const downloadFileContent = vi.fn();
  return {
    streamMessage,
    uploadFile,
    downloadFileContent,
    createSession: vi.fn(async () => "sess-1"),
    auth: { user: { id: "u1", username: "gary", roles: ["admin"], permissions: ["*"] } },
  };
});

vi.mock("../state/AppState", () => ({
  useAppState: () => ({
    api: { streamMessage: mocks.streamMessage, uploadFile: mocks.uploadFile, downloadFileContent: mocks.downloadFileContent },
    activeSessionId: null,
    createSession: mocks.createSession,
  }),
}));

vi.mock("@cloud-dog/auth", () => ({ useAuth: () => mocks.auth }));

import { ResearchRoute } from "./research";

afterEach(() => {
  cleanup();
  mocks.streamMessage.mockClear();
  mocks.uploadFile.mockClear();
  mocks.createSession.mockClear();
});

function selectImage() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([new Uint8Array(16)], "photo.png", { type: "image/png" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
  return file;
}

describe("ResearchRoute (§9.4.6 AT)", () => {
  it("uploads a drag-dropped image, runs research, and renders progressive results", async () => {
    render(<ResearchRoute />);
    // Drag-drop image → preview rendered inline.
    selectImage();
    expect(await screen.findByTestId("research-image-preview")).toBeInTheDocument();

    // Type query + submit.
    fireEvent.change(screen.getByTestId("research-query"), { target: { value: "What is in this image?" } });
    fireEvent.click(screen.getByTestId("research-submit"));

    // Image uploaded via file-mcp proxy → artefact-ref passed to research.
    await waitFor(() => expect(mocks.uploadFile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.streamMessage).toHaveBeenCalledTimes(1));
    const content = mocks.streamMessage.mock.calls[0][1] as string;
    expect(content).toContain("image_url: research-uploads/16-photo.png");
    expect(content).toContain("synthesise_in: en");

    // Progressive render: synthesis text + entity graph + convergence + media inline.
    expect(await screen.findByTestId("research-synthesis")).toHaveTextContent("Synthesised answer.");
    await waitFor(() => expect(screen.getByTestId("mm-entity-graph-live-count")).toHaveTextContent("2 entities, 1 link"));
    expect(screen.getByTestId("mm-convergence-live-cluster-c1-count")).toHaveTextContent("1 source");
    expect(screen.getByTestId("media-inline-image")).toBeInTheDocument();
  });

  it("re-synthesises in the selected language when the language toggle changes", async () => {
    render(<ResearchRoute />);
    fireEvent.change(screen.getByTestId("research-query"), { target: { value: "NATO air policing" } });
    fireEvent.click(screen.getByTestId("research-submit"));
    await waitFor(() => expect(mocks.streamMessage).toHaveBeenCalledTimes(1));

    // Change output language → prior run re-synthesised in the new language.
    fireEvent.change(screen.getByTestId("mm-language-toggle-select"), { target: { value: "fr" } });
    await waitFor(() => expect(mocks.streamMessage).toHaveBeenCalledTimes(2));
    const secondContent = mocks.streamMessage.mock.calls[1][1] as string;
    expect(secondContent).toContain("synthesise_in: fr");
    expect(secondContent).toContain("NATO air policing");
  });
});
