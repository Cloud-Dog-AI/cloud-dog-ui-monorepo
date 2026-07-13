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

// @cloud-dog/ui — Multimodal component exports (W28F-948).

export { ImagePreview } from "./ImagePreview";
export type { ImagePreviewProps } from "./ImagePreview";

export { VideoPlayer } from "./VideoPlayer";
export type { VideoPlayerProps } from "./VideoPlayer";

export { AudioPlayer } from "./AudioPlayer";
export type { AudioPlayerProps } from "./AudioPlayer";

export { PDFViewer } from "./PDFViewer";
export type { PDFViewerProps } from "./PDFViewer";

export { DragDropUpload, DEFAULT_MULTIMODAL_ACCEPT, fileMatchesAccept } from "./DragDropUpload";
export type { DragDropUploadProps } from "./DragDropUpload";

export {
  buildStoragePathReference,
  buildUrlReference,
  isInlineDataUrl,
  normaliseAssetReference,
  tryNormaliseAssetReference,
} from "./assetReference";
export type { AssetReference, NormaliseAssetReferenceOptions } from "./assetReference";

export { EntityGraphLive, reduceEntityGraph } from "./EntityGraphLive";
export type { EntityGraphLiveProps } from "./EntityGraphLive";

export { ConvergenceClusterLive, reduceConvergence } from "./ConvergenceClusterLive";
export type { ConvergenceClusterLiveProps } from "./ConvergenceClusterLive";

export { LanguageToggle, DEFAULT_OUTPUT_LANGUAGES } from "./LanguageToggle";
export type { LanguageToggleProps } from "./LanguageToggle";

export {
  OUTPUT_LANGUAGE_LABELS,
  RTL_LANGUAGES,
  formatTimecode,
} from "./types";
export type {
  TranscriptCue,
  MediaTranscript,
  Waveform,
  EntityGraphEvent,
  ConvergenceCluster,
  ConvergenceSource,
  ConvergenceEvent,
  OutputLanguage,
} from "./types";
