# @cloud-dog/ui

Reusable React UI components built on Cloud-Dog tokens.

## Install

```bash
npm install @cloud-dog/ui
```

## Usage

Import shared controls, panels, and display primitives from this package rather than duplicating component implementations across apps.

## Asset References

Multimodal consumers should use the exported asset-reference helpers (`normaliseAssetReference`,
`buildStoragePathReference`, `buildUrlReference`) when rendering or forwarding generated media. The helpers normalise
`storage_path`/`storagePath` and `url`/`asset_url` fields and reject inline `data:` URLs by default, keeping large image
payloads out of chat, MCP, A2A, and notification tool arguments.
