// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License").
// See the LICENSE file for the specific language governing permissions.

// W28E-1878 (CC-18 / IR-39) — the index-retriever metadata standard.
//
// These schemas bind the shared @cloud-dog/ui MetadataEditor to the metadata keys
// index-retriever actually understands, giving a schema-aware editor instead of a
// bespoke free-text JSON textarea. Unknown/connector-specific keys are still
// permitted (allowAdditionalKeys), so the editor stays flexible.

import type { MetadataFieldSpec } from "@cloud-dog/ui";

/**
 * Collection metadata standard — indexing override keys inherited from the parent
 * profile (chunking strategy, embedding model, LLM model, chunk size, max tokens,
 * MinerU / Marker / OCR). Overrides take precedence over inherited profile settings
 * at indexing time.
 */
export const COLLECTION_METADATA_SCHEMA: MetadataFieldSpec[] = [
  { key: "chunk_size", label: "Chunk size", type: "number", description: "Tokens per chunk (overrides the profile default).", placeholder: "1024" },
  { key: "chunk_overlap", label: "Chunk overlap", type: "number", description: "Overlapping tokens between adjacent chunks." },
  { key: "chunking_strategy", label: "Chunking strategy", type: "select", options: ["token", "sentence", "recursive", "semantic"] },
  { key: "embedding_model", label: "Embedding model", type: "string", placeholder: "nomic-embed-text" },
  { key: "llm_model", label: "LLM model", type: "string", placeholder: "gpt-4o" },
  { key: "max_tokens", label: "Max tokens", type: "number", description: "Maximum tokens per LLM enrichment call." },
  { key: "mineru", label: "MinerU", type: "boolean", description: "Use the MinerU document parser." },
  { key: "marker", label: "Marker", type: "boolean", description: "Use the Marker PDF parser." },
  { key: "ocr", label: "OCR", type: "boolean", description: "Enable OCR for scanned documents." },
];

/**
 * Source-config (connector) metadata standard — document/source descriptors applied
 * to ingested content. Connector-specific keys beyond this set are still allowed.
 */
export const SOURCE_METADATA_SCHEMA: MetadataFieldSpec[] = [
  { key: "title", label: "Title", type: "string", description: "Human-readable document/source title." },
  { key: "source", label: "Source", type: "string", description: "Originating system or dataset name." },
  { key: "author", label: "Author", type: "string" },
  { key: "language", label: "Language", type: "string", placeholder: "en" },
  { key: "category", label: "Category", type: "string" },
  { key: "tags", label: "Tags", type: "string", description: "Comma-separated tags." },
];
