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

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MediaInline, MediaResultList } from "./MediaInline";
import type { MediaResult } from "../lib/media";

afterEach(() => cleanup());

const image: MediaResult = { id: "i1", kind: "image", src: "https://i/p.png", caption: "a cat" };
const video: MediaResult = { id: "v1", kind: "video", src: "https://v/c.mp4", title: "Clip", transcript: { cues: [{ start: 0, text: "Hi" }] } };
const pdf: MediaResult = { id: "p1", kind: "pdf", src: "doc.pdf", title: "Doc", downloadPath: "uploads/doc.pdf" };

describe("MediaInline", () => {
  it("renders an image result", () => {
    render(<MediaInline media={image} />);
    expect(screen.getByTestId("media-inline-image")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "a cat" })).toBeInTheDocument();
  });

  it("renders a video result with the transcript", () => {
    render(<MediaInline media={video} />);
    expect(screen.getByTestId("mm-video-player-video")).toBeInTheDocument();
    expect(screen.getByTestId("mm-video-player-cue-0")).toBeInTheDocument();
  });

  it("uses the proxy download when a downloadPath + handler are supplied", () => {
    const onDownload = vi.fn();
    render(<MediaInline media={pdf} onDownload={onDownload} />);
    fireEvent.click(screen.getByTestId("media-inline-pdf-download"));
    expect(onDownload).toHaveBeenCalledWith(pdf);
  });

  it("falls back to a download anchor when no proxy handler", () => {
    render(<MediaInline media={image} />);
    const link = screen.getByTestId("media-inline-image-download");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://i/p.png");
  });
});

describe("MediaResultList", () => {
  it("renders nothing when empty and one entry per item otherwise", () => {
    const { container, rerender } = render(<MediaResultList items={[]} />);
    expect(container.querySelector('[data-testid="media-result-list"]')).toBeNull();
    rerender(<MediaResultList items={[image, video]} />);
    expect(screen.getByTestId("media-inline-image")).toBeInTheDocument();
    expect(screen.getByTestId("media-inline-video")).toBeInTheDocument();
  });
});
