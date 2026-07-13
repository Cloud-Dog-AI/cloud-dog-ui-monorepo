// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
// Generated for W28A-805 from index-retriever-mcp-server/defaults.yaml.

import type { JsonExplorerSourceMap } from "@cloud-dog/ui";

export const SETTINGS_DEFAULT_CONFIG = {
  "a2a_server": {
    "base_path": "${CLOUD_DOG__INDEX_RETRIEVER__A2A_SERVER__BASE_PATH:/a2a}",
    "host": "0.0.0.0",
    "port": 8077
  },
  "api_server": {
    "api_key": "${CLOUD_DOG__INDEX__AUTH__ADMIN_API_KEY || ''}",
    "base_path": "${CLOUD_DOG__INDEX_RETRIEVER__API_SERVER__BASE_PATH:/api/v1}",
    "host": "0.0.0.0",
    "port": 8074
  },
  "auth": {
    "jwt": {
      "audience": "${JWT_AUDIENCE || ''}",
      "issuer": "${JWT_ISSUER || ''}",
      "public_keys_url": "${JWT_JWKS_URL || ''}"
    },
    "mode": "apikey+jwt"
  },
  "log": {
    "a2a_server_log": "logs/a2a_server.log",
    "api_server_log": "logs/api_server.log",
    "audit_log": "logs/audit.log.jsonl",
    "environment": "${CLOUD_DOG_ENVIRONMENT:dev}",
    "integrity": {
      "enabled": true,
      "hash_algorithm": "sha256",
      "interval_seconds": 300,
      "log_file": "logs/audit-integrity.log"
    },
    "mcp_server_log": "logs/mcp_server.log",
    "retention": {
      "archive_format": "gz",
      "cold_days": 60,
      "hot_days": 14
    },
    "rotation": {
      "backup_count": 10,
      "compress": true,
      "interval": 1,
      "max_bytes": 104857600,
      "mode": "size",
      "when": "midnight"
    },
    "service_instance": "${HOSTNAME:index-retriever-local}",
    "web_server_log": "logs/web_server.log"
  },
  "mcp_server": {
    "base_path": "${CLOUD_DOG__INDEX_RETRIEVER__MCP_SERVER__BASE_PATH:/mcp}",
    "host": "0.0.0.0",
    "port": 8076,
    "transport": "streamable-http"
  },
  "profiles": {
    "default": {
      "chunking": {
        "chunk_overlap": 100,
        "chunk_size": 800,
        "strategy": "token"
      },
      "embeddings": {
        "openai_compat": {
          "api_key": "${EMBED_API_KEY || ''}",
          "base_url": "${EMBED_BASE_URL:https://openrouter.ai/api/v1}",
          "model": "nomic-embed-text",
          "timeout_seconds": 60
        },
        "provider": "openai_compat"
      },
      "enabled": true,
      "ingestion": {
        "allowed_sources": [
          "upload",
          "text",
          "filesystem",
          "s3",
          "webdav",
          "gdrive"
        ],
        "dedupe": {
          "mode": "hash",
          "policy": "skip"
        },
        "filesystem": {
          "deny_globs": [
            "**/.git/**",
            "**/node_modules/**"
          ],
          "roots": [
            "${INGEST_ROOT:./uploads}"
          ]
        },
        "max_file_mb": 50
      },
      "search": {
        "score_threshold": 0,
        "top_k_default": 10
      },
      "vdb": {
        "chroma": {
          "collection": "default",
          "mode": "local",
          "path": "${CHROMA_PATH:./data/chroma}"
        },
        "type": "chroma"
      }
    }
  },
  "queue": {
    "backend": "${CLOUD_DOG__INDEX__QUEUE__BACKEND:sql}",
    "claim_timeout_seconds": 60,
    "database_url": "${INDEX_RETRIEVER_DB_URL:${DB_URL:sqlite+aiosqlite:///./data/index_retriever.db}}",
    "default_timeout_seconds": 1800,
    "max_concurrency": 8,
    "per_profile_concurrency": 2,
    "queue_wait_timeout_seconds": 1800,
    "redis": {
      "enabled": false,
      "url": "${REDIS_URL:redis://127.0.0.1:6379/0}"
    },
    "retry": {
      "backoff_seconds": 5,
      "max_attempts": 3
    },
    "server_id": "${INDEX_RETRIEVER_SERVER_ID:${HOSTNAME:index-retriever-local}}"
  },
  "rbac": {
    "default_deny": true,
    "enabled": true,
    "roles": {
      "admin": [
        "*"
      ],
      "maintainer": [
        "profiles_*",
        "collections_*",
        "ingest_*",
        "search",
        "retrieve",
        "delete_*",
        "retention_*",
        "reindex_*",
        "job_*",
        "queue_status",
        "backend_health_check",
        "embedding_health_check"
      ],
      "reader": [
        "profiles_list",
        "profile_get",
        "collections_list",
        "collection_get",
        "search",
        "retrieve",
        "search_explain",
        "job_get",
        "queue_status"
      ],
      "writer": [
        "ingest_*",
        "search",
        "retrieve",
        "job_list",
        "job_get",
        "job_wait",
        "job_stream",
        "queue_status"
      ]
    }
  },
  "storage": {
    "audit": {
      "path": "${AUDIT_LOG_PATH:./logs/audit.log}"
    },
    "db": {
      "url": "${DB_URL:sqlite+aiosqlite:///./data/index_retriever.db}"
    }
  },
  "web_login": {
    "password": "${CLOUD_DOG_WEB_LOGIN_PASSWORD || ''}",
    "username": "${CLOUD_DOG_WEB_LOGIN_USERNAME:admin}"
  },
  "web_server": {
    "base_path": "${CLOUD_DOG__INDEX_RETRIEVER__WEB_SERVER__BASE_PATH || ''}",
    "host": "0.0.0.0",
    "port": 8075
  }
} as Record<string, unknown>;

export const SETTINGS_SOURCE_MAP = {
  "a2a_server": {
    "secret": false,
    "servers": [
      "A2A"
    ],
    "source": "default"
  },
  "a2a_server.base_path": {
    "secret": false,
    "servers": [
      "A2A"
    ],
    "source": "env"
  },
  "a2a_server.host": {
    "secret": false,
    "servers": [
      "A2A"
    ],
    "source": "default"
  },
  "a2a_server.port": {
    "secret": false,
    "servers": [
      "A2A"
    ],
    "source": "default"
  },
  "api_server": {
    "secret": false,
    "servers": [
      "API"
    ],
    "source": "default"
  },
  "api_server.api_key": {
    "secret": true,
    "servers": [
      "API"
    ],
    "source": "env"
  },
  "api_server.base_path": {
    "secret": false,
    "servers": [
      "API"
    ],
    "source": "env"
  },
  "api_server.host": {
    "secret": false,
    "servers": [
      "API"
    ],
    "source": "default"
  },
  "api_server.port": {
    "secret": false,
    "servers": [
      "API"
    ],
    "source": "default"
  },
  "auth": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "auth.jwt": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "auth.jwt.audience": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "auth.jwt.issuer": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "auth.jwt.public_keys_url": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "auth.mode": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.a2a_server_log": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.api_server_log": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.audit_log": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.environment": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "log.integrity": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.integrity.enabled": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.integrity.hash_algorithm": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.integrity.interval_seconds": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.integrity.log_file": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.mcp_server_log": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.retention": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.retention.archive_format": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.retention.cold_days": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.retention.hot_days": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.rotation": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.rotation.backup_count": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.rotation.compress": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.rotation.interval": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.rotation.max_bytes": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.rotation.mode": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.rotation.when": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "log.service_instance": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "log.web_server_log": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "mcp_server": {
    "secret": false,
    "servers": [
      "MCP"
    ],
    "source": "default"
  },
  "mcp_server.base_path": {
    "secret": false,
    "servers": [
      "MCP"
    ],
    "source": "env"
  },
  "mcp_server.host": {
    "secret": false,
    "servers": [
      "MCP"
    ],
    "source": "default"
  },
  "mcp_server.port": {
    "secret": false,
    "servers": [
      "MCP"
    ],
    "source": "default"
  },
  "mcp_server.transport": {
    "secret": false,
    "servers": [
      "MCP"
    ],
    "source": "default"
  },
  "profiles": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.chunking": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.chunking.chunk_overlap": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.chunking.chunk_size": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.chunking.strategy": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.embeddings": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.embeddings.openai_compat": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.embeddings.openai_compat.api_key": {
    "secret": true,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "profiles.default.embeddings.openai_compat.base_url": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "profiles.default.embeddings.openai_compat.model": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.embeddings.openai_compat.timeout_seconds": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.embeddings.provider": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.enabled": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.allowed_sources": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.allowed_sources[0]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.allowed_sources[1]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.allowed_sources[2]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.allowed_sources[3]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.allowed_sources[4]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.allowed_sources[5]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.dedupe": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.dedupe.mode": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.dedupe.policy": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.filesystem": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.filesystem.deny_globs": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.filesystem.deny_globs[0]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.filesystem.deny_globs[1]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.filesystem.roots": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.ingestion.filesystem.roots[0]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "profiles.default.ingestion.max_file_mb": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.search": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.search.score_threshold": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.search.top_k_default": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.vdb": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.vdb.chroma": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.vdb.chroma.collection": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.vdb.chroma.mode": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "profiles.default.vdb.chroma.path": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "profiles.default.vdb.type": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "queue": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "queue.backend": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "queue.claim_timeout_seconds": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "queue.database_url": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "queue.default_timeout_seconds": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "queue.max_concurrency": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "queue.per_profile_concurrency": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "queue.queue_wait_timeout_seconds": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "queue.redis": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "queue.redis.enabled": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "queue.redis.url": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "queue.retry": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "queue.retry.backoff_seconds": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "queue.retry.max_attempts": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "queue.server_id": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "rbac": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.default_deny": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.enabled": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.admin": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.admin[0]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer[0]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer[10]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer[11]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer[1]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer[2]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer[3]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer[4]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer[5]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer[6]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer[7]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer[8]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.maintainer[9]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.reader": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.reader[0]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.reader[1]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.reader[2]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.reader[3]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.reader[4]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.reader[5]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.reader[6]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.reader[7]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.reader[8]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.writer": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.writer[0]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.writer[1]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.writer[2]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.writer[3]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.writer[4]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.writer[5]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.writer[6]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "rbac.roles.writer[7]": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "storage": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "storage.audit": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "storage.audit.path": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "storage.db": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "default"
  },
  "storage.db.url": {
    "secret": false,
    "servers": [
      "shared"
    ],
    "source": "env"
  },
  "web_login": {
    "secret": false,
    "servers": [
      "WebUI"
    ],
    "source": "default"
  },
  "web_login.password": {
    "secret": true,
    "servers": [
      "WebUI"
    ],
    "source": "env"
  },
  "web_login.username": {
    "secret": false,
    "servers": [
      "WebUI"
    ],
    "source": "env"
  },
  "web_server": {
    "secret": false,
    "servers": [
      "WebUI"
    ],
    "source": "default"
  },
  "web_server.base_path": {
    "secret": false,
    "servers": [
      "WebUI"
    ],
    "source": "env"
  },
  "web_server.host": {
    "secret": false,
    "servers": [
      "WebUI"
    ],
    "source": "default"
  },
  "web_server.port": {
    "secret": false,
    "servers": [
      "WebUI"
    ],
    "source": "default"
  }
} as JsonExplorerSourceMap;

export const SETTINGS_INVENTORY = {
  "branch_total": 35,
  "config_file_present": false,
  "defaults_total": 113,
  "effective_total": 113,
  "env_var_total": 22,
  "lane": "W28A-805",
  "per_server": {
    "API": 4,
    "WebUI": 5,
    "MCP": 4,
    "A2A": 3,
    "shared": 97
  },
  "rendered_leaf_total": 113,
  "secret_total": 3,
  "source_badge_expected_minimum": 113,
  "source_file": "index-retriever-mcp-server/defaults.yaml",
  "total": 113
} as const;

export const SETTINGS_SECRET_KEY_PATHS = [
  "api_server.api_key",
  "web_login.password",
  "profiles.default.embeddings.openai_compat.api_key"
] as const;

export const SETTINGS_LEAF_KEY_PATHS = [
  "api_server.host",
  "api_server.port",
  "api_server.base_path",
  "api_server.api_key",
  "web_server.host",
  "web_server.port",
  "web_server.base_path",
  "mcp_server.host",
  "mcp_server.port",
  "mcp_server.base_path",
  "mcp_server.transport",
  "a2a_server.host",
  "a2a_server.port",
  "a2a_server.base_path",
  "web_login.username",
  "web_login.password",
  "auth.mode",
  "auth.jwt.issuer",
  "auth.jwt.audience",
  "auth.jwt.public_keys_url",
  "storage.db.url",
  "storage.audit.path",
  "queue.backend",
  "queue.database_url",
  "queue.server_id",
  "queue.max_concurrency",
  "queue.per_profile_concurrency",
  "queue.queue_wait_timeout_seconds",
  "queue.default_timeout_seconds",
  "queue.claim_timeout_seconds",
  "queue.retry.max_attempts",
  "queue.retry.backoff_seconds",
  "queue.redis.enabled",
  "queue.redis.url",
  "profiles.default.enabled",
  "profiles.default.vdb.type",
  "profiles.default.vdb.chroma.mode",
  "profiles.default.vdb.chroma.path",
  "profiles.default.vdb.chroma.collection",
  "profiles.default.embeddings.provider",
  "profiles.default.embeddings.openai_compat.base_url",
  "profiles.default.embeddings.openai_compat.api_key",
  "profiles.default.embeddings.openai_compat.model",
  "profiles.default.embeddings.openai_compat.timeout_seconds",
  "profiles.default.ingestion.allowed_sources[0]",
  "profiles.default.ingestion.allowed_sources[1]",
  "profiles.default.ingestion.allowed_sources[2]",
  "profiles.default.ingestion.allowed_sources[3]",
  "profiles.default.ingestion.allowed_sources[4]",
  "profiles.default.ingestion.allowed_sources[5]",
  "profiles.default.ingestion.filesystem.roots[0]",
  "profiles.default.ingestion.filesystem.deny_globs[0]",
  "profiles.default.ingestion.filesystem.deny_globs[1]",
  "profiles.default.ingestion.max_file_mb",
  "profiles.default.ingestion.dedupe.mode",
  "profiles.default.ingestion.dedupe.policy",
  "profiles.default.chunking.strategy",
  "profiles.default.chunking.chunk_size",
  "profiles.default.chunking.chunk_overlap",
  "profiles.default.search.top_k_default",
  "profiles.default.search.score_threshold",
  "rbac.enabled",
  "rbac.default_deny",
  "rbac.roles.admin[0]",
  "rbac.roles.maintainer[0]",
  "rbac.roles.maintainer[1]",
  "rbac.roles.maintainer[2]",
  "rbac.roles.maintainer[3]",
  "rbac.roles.maintainer[4]",
  "rbac.roles.maintainer[5]",
  "rbac.roles.maintainer[6]",
  "rbac.roles.maintainer[7]",
  "rbac.roles.maintainer[8]",
  "rbac.roles.maintainer[9]",
  "rbac.roles.maintainer[10]",
  "rbac.roles.maintainer[11]",
  "rbac.roles.writer[0]",
  "rbac.roles.writer[1]",
  "rbac.roles.writer[2]",
  "rbac.roles.writer[3]",
  "rbac.roles.writer[4]",
  "rbac.roles.writer[5]",
  "rbac.roles.writer[6]",
  "rbac.roles.writer[7]",
  "rbac.roles.reader[0]",
  "rbac.roles.reader[1]",
  "rbac.roles.reader[2]",
  "rbac.roles.reader[3]",
  "rbac.roles.reader[4]",
  "rbac.roles.reader[5]",
  "rbac.roles.reader[6]",
  "rbac.roles.reader[7]",
  "rbac.roles.reader[8]",
  "log.service_instance",
  "log.environment",
  "log.api_server_log",
  "log.web_server_log",
  "log.mcp_server_log",
  "log.a2a_server_log",
  "log.audit_log",
  "log.retention.hot_days",
  "log.retention.cold_days",
  "log.retention.archive_format",
  "log.integrity.enabled",
  "log.integrity.interval_seconds",
  "log.integrity.log_file",
  "log.integrity.hash_algorithm",
  "log.rotation.mode",
  "log.rotation.max_bytes",
  "log.rotation.backup_count",
  "log.rotation.when",
  "log.rotation.interval",
  "log.rotation.compress"
] as const;
