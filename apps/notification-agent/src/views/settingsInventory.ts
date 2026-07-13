// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Generated for W28A-801 from notification-agent-mcp-server/defaults.yaml.
// Values are not embedded; this file carries key paths and PS-73 source metadata only.

import type { JsonExplorerSourceMap } from '@cloud-dog/ui';

export const SETTINGS_INVENTORY_KEYS = [
  "app.id",
  "app.version",
  "app.title",
  "app.description",
  "app.server_name",
  "app.server_id",
  "app.default_language",
  "app.certificate",
  "app.key",
  "app.env_write_enabled",
  "db.uri",
  "default_channel",
  "email.smtp.default.host",
  "email.smtp.default.port",
  "email.smtp.default.username",
  "email.smtp.default.password",
  "email.smtp.default.from_address",
  "email.smtp.default.use_tls",
  "email.smtp.default.use_starttls",
  "email.imap.default.host",
  "email.imap.default.port",
  "email.imap.default.username",
  "email.imap.default.password",
  "email.imap.default.use_tls",
  "email.imap.default.use_starttls",
  "email.imap.default.mailbox",
  "email.imap.default.poll_timeout_seconds",
  "email.imap.default.poll_interval_seconds",
  "api_server.enabled",
  "api_server.host",
  "api_server.port",
  "api_server.base_path",
  "api_server.base_url",
  "api_server.api_key",
  "api_server.cors_origins[0]",
  "api_server.request_timeout",
  "api_server.message_fetch_timeout",
  "api_server.max_request_size",
  "api_server.max_startup_retries",
  "api_server.http_client_timeout",
  "api_server.db_query_timeout",
  "api_server.db_query_timeout_short",
  "api_server.subprocess_timeout",
  "web_server.enabled",
  "web_server.host",
  "web_server.port",
  "web_server.base_path",
  "web_server.max_startup_retries",
  "web_server.username",
  "web_server.password",
  "web_server.base_url",
  "web_server.api_base_url",
  "web_server.session_max_age",
  "web_server.session_timeout",
  // web_server.cors_origins is `[]` (empty array) in defaults.yaml — the SOURCE OF
  // TRUTH — so it renders as a zero-leaf branch (ps81-branch with no ps81-node
  // children), contributing 0 leaves. It was previously listed here as if it were a
  // scalar leaf, inflating the expected leaf count to 363 while the deployed tree
  // renders 362. Removed to reconcile the inventory to defaults.yaml (api_server's
  // cors_origins keeps its `[0]` element key because that array is non-empty: ["*"]).
  "web_server.proxy_timeout_seconds",
  "web_server.status_refresh_interval",
  "web_server.jobs_refresh_interval",
  "web_server.connection_check_interval",
  "mcp_server.enabled",
  "mcp_server.transport",
  "mcp_server.base_url",
  "mcp_server.base_path",
  "mcp_server.port",
  "mcp_server.host",
  "mcp_server.protocol_version",
  "mcp_server.max_startup_retries",
  "mcp_server.name",
  "mcp_server.version",
  "mcp_server.tls",
  "mcp_server.api_base_url",
  "mcp_server.api_key",
  "mcp_server.request_timeout",
  "mcp_server.max_concurrent_requests",
  "mcp_server.client_api_key",
  "mcp_server.session_ttl_seconds",
  "mcp_server.streamable_http_path",
  "mcp_server.jsonrpc_path",
  "mcp_server.legacy_sse_path",
  "mcp_server.legacy_sse_message_path",
  "mcp_server.async_jobs_enabled",
  "mcp_server.async_jobs_status_path",
  "mcp_server.async_jobs_timeout_seconds",
  "mcp_server.async_jobs_poll_interval_seconds",
  "mcp_server.sync_budget_seconds",
  "mcp_server.sync_budget_progress_seconds",
  "resource_pools.llm-pool.max_running",
  "resource_pools.delivery-pool.max_running",
  "a2a_server.enabled",
  "a2a_server.port",
  "a2a_server.host",
  "a2a_server.base_path",
  "a2a_server.max_startup_retries",
  "a2a_server.base_url",
  "a2a_server.api_base_url",
  "a2a_server.websocket_url",
  "a2a_server.request_timeout",
  "api.timeout",
  "api.read_timeout",
  "api.connect_timeout",
  "queue.name",
  "queue.backend",
  "queue.sql_database_url",
  "queue.redis_url",
  "queue.redis_key_prefix",
  "queue.default_ttl_hours",
  "queue.max_retries",
  "queue.backoff_base_seconds",
  "queue.backoff_max_seconds",
  "queue.worker_poll_interval_seconds",
  "queue.worker_batch_size",
  "queue.sending_timeout_seconds",
  "queue.claim_timeout_seconds",
  "queue.run_timeout_ms",
  "queue.dead_letter_queue",
  "queue.watchdog.formatting_stuck_minutes_null_payload",
  "queue.watchdog.formatting_stuck_minutes_with_payload",
  "queue.watchdog.sending_stuck_minutes",
  "delivery.max_queued",
  "delivery_worker.enabled",
  "delivery_worker.host",
  "delivery_worker.port",
  "delivery_worker.base_url",
  "delivery_worker.poll_interval",
  "delivery_worker.batch_size",
  "delivery_worker.max_concurrent_deliveries",
  "rate_limit.per_channel_per_minute",
  "rate_limit.per_channel_per_hour",
  "rate_limit.per_channel_per_day",
  "rate_limit.per_destination_per_minute",
  "rate_limit.per_destination_per_hour",
  "circuit.soft_error_threshold",
  "circuit.hard_error_threshold",
  "circuit.cooldown_seconds",
  "llm.provider",
  "llm.base_url",
  "llm.model",
  "llm.temperature",
  "llm.ignore_tls",
  "llm.openai_api_key",
  "llm.anthropic_api_key",
  "llm.azure_openai_api_key",
  "llm.azure_openai_endpoint",
  "llm.azure_openai_api_version",
  "llm.google_api_key",
  "llm.aws_region",
  "llm.num_ctx",
  "llm.num_predict",
  "llm.max_tokens",
  "llm.token_estimate_chars_per_token",
  "llm.chunk_max_rounds",
  "llm.timeout",
  "llm.query_timeout",
  "llm.retry_attempts",
  "llm.retry_delay",
  "llm.auto_pull",
  "llm.model_load_timeout",
  "llm.startup_timeout",
  "llm.event_loop_init_timeout",
  "llm.top_p",
  "llm.top_k",
  "llm.repeat_penalty",
  "llm.seed",
  "llm.mirostat",
  "llm.mirostat_tau",
  "llm.mirostat_eta",
  "llm.translation_timeout",
  "llm.translation_chunk_chars",
  "llm.translation_chunk_parallelism",
  "llm.formatting_timeout",
  "llm.summarization_timeout",
  "llm.default_system_prompt",
  "llm.format_instructions.markdown",
  "llm.format_instructions.html",
  "llm.format_instructions.plain",
  "llm.language_instruction_template",
  "llm.summarization_prompt_template",
  "llm.post_processing.strip_english_boilerplate[0]",
  "llm.post_processing.strip_english_boilerplate[1]",
  "llm.post_processing.strip_english_boilerplate[2]",
  "llm.post_processing.strip_english_boilerplate[3]",
  "llm.post_processing.strip_english_boilerplate[4]",
  "llm.post_processing.strip_english_boilerplate[5]",
  "llm.post_processing.strip_english_boilerplate[6]",
  "llm.model_prompts.granite4_tiny_h.summarization_prompt_template",
  "llm.model_prompts.granite4_tiny_h.language_instruction_template",
  "channels.smtp.default.enabled",
  "channels.smtp.default.host",
  "channels.smtp.default.port",
  "channels.smtp.default.username",
  "channels.smtp.default.password",
  "channels.smtp.default.from_address",
  "channels.smtp.default.use_tls",
  "channels.smtp.demo27_transparent_borders.enabled",
  "channels.smtp.demo27_transparent_borders.host",
  "channels.smtp.demo27_transparent_borders.port",
  "channels.smtp.demo27_transparent_borders.username",
  "channels.smtp.demo27_transparent_borders.password",
  "channels.smtp.demo27_transparent_borders.from_address",
  "channels.smtp.demo27_transparent_borders.use_tls",
  "channels.sms.default.enabled",
  "channels.sms.default.provider",
  "channels.sms.default.api_key",
  "channels.sms.default.sender",
  "channels.sms.default.account_sid",
  "channels.sms.default.base_url",
  "channels.whatsapp.default.enabled",
  "channels.whatsapp.default.base_url",
  "channels.whatsapp.default.token",
  "channels.whatsapp.default.account_sid",
  "channels.whatsapp.default.from_number",
  "channels.chat_rest.default.enabled",
  "channels.chat_rest.default.endpoint",
  "channels.chat_rest.default.api_token",
  "channels.chat_rest.default.channel_id",
  "channels.chat_rest.transparentbordes.enabled",
  "channels.chat_rest.transparentbordes.endpoint",
  "channels.chat_rest.transparentbordes.is_channel_based",
  "channels.chat_rest.transparentbordes.auth_type",
  "channels.chat_rest.transparentbordes.format",
  "channels.chat_rest.transparentbordes.limits.rate_per_minute",
  "channels.chat_rest.transparentbordes.limits.rate_per_hour",
  "channels.chat_rest.transparentbordes.limits.max_length",
  "channels.chat_rest.transparentbordes.restrictions.max_length",
  "channels.chat_rest.transparentbordes.restrictions.allowed_formats[0]",
  "channels.chat_rest.transparentbordes.restrictions.link_strategy",
  "confirmations.signature.secret",
  "confirmations.signature.algorithm",
  "confirmations.polling.enabled",
  "confirmations.polling.interval_seconds",
  "log.level",
  "log.format",
  "log.console",
  "log.service_instance",
  "log.environment",
  "log.audit_log",
  "log.dump_config",
  "log.api_server_log",
  "log.web_server_log",
  "log.web_access_log",
  "log.mcp_server_log",
  "log.a2a_server_log",
  "log.delivery_worker_log",
  "log.enable_access_log",
  "log.max_bytes",
  "log.backup_count",
  "log.compress",
  "log.rotation_type",
  "log.retention_days",
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
  "log.rotation.compress",
  "auth.provider",
  "auth.jwt_secret",
  "auth.jwt_algorithm",
  "auth.jwt_expiry_minutes",
  "retention.messages_days",
  "retention.deliveries_days",
  "retention.receipts_days",
  "retention.logs_days",
  "retention.audit_events_days",
  "observability.metrics_enabled",
  "observability.tracing_enabled",
  "observability.health_check_interval_seconds",
  "messages.base_url",
  "messages.header_templates.default",
  "messages.header_templates.with_guid",
  "messages.header_templates.simple",
  "messages.link_labels.view_full_message",
  "messages.link_labels.view_source_message",
  "messages.link_labels.view_pdf",
  "messages.link_labels.view_message_center",
  "messages.link_labels.characters",
  "messages.link_labels.znak\u00f3w",
  "messages.link_labels.Zeichen",
  "messages.link_labels.\u5b57\u7b26",
  "messages.link_labels.\u0623\u062d\u0631\u0641",
  "storage.backend",
  "storage.local.base_path",
  "storage.local.base_url",
  "storage.filesystem.base_path",
  "storage.filesystem.create_subdirs",
  "storage.filesystem.subdir_pattern",
  "storage.filesystem.permissions",
  "storage.filesystem.dir_permissions",
  "storage.s3.endpoint",
  "storage.s3.bucket",
  "storage.s3.access_key",
  "storage.s3.secret_key",
  "storage.s3.region",
  "storage.webdav.url",
  "storage.webdav.username",
  "storage.webdav.password",
  "storage.ftp.host",
  "storage.ftp.port",
  "storage.ftp.username",
  "storage.ftp.password",
  "storage.ftp.passive_mode",
  "test.email_domain",
  "test.default_sms_channel",
  "test.media.image_url",
  "test.media.http_image_url",
  "test.media.https_image_url",
  "test.webhook.slack_url",
  "test.webhook.local_url",
  "test.webhook.example_url",
  "test.webhook.invalid_url",
  "test.webhook.invalid_scheme_url",
  "test.webhook.bearer_token",
  "test.performance.channel",
  "test.performance.iterations",
  "test.performance.p95_threshold_ms",
  "test.performance.inter_request_delay_ms",
  "test.performance.skip_sqlite",
  "test.at15.max_wait",
  "test.at15.poll_interval",
  "test.at15.subject_template",
  "test.at15.scenarios[0].source",
  "test.at15.scenarios[0].target",
  "test.at15.scenarios[0].size",
  "test.at15.scenarios[0].format",
  "test.at15.scenarios[0].id",
  "test.at15.negative.max_wait",
  "test.at15.negative.scenarios[0].id",
  "test.at15.negative.scenarios[0].description",
  "test.at15.negative.scenarios[0].remove_destination",
  "test.at15.negative.scenarios[0].expected_fails_at",
  "test.at15.negative.scenarios[0].expected_status",
  "test.at15.smtp_variants[0].id",
  "test.at15.smtp_variants[0].description",
  "test.at15.smtp_variants[0].port",
  "test.at15.smtp_variants[0].use_tls",
  "test.at15.smtp_variants[0].use_starttls",
  "test.at15.personalised.scenarios[0].language",
  "test.at15.personalised.scenarios[0].content_style",
  "test.at15.personalised.scenarios[0].description",
  "test.at14d.summary_size",
  "test.at14d.summary_tolerance",
  "test.at14d.max_wait",
  "test.at14d.pdf_min_size_ratio",
  "test.at14d.format",
  "test.at14d.generate_pdf",
  "test.at14g.summary_size",
  "test.at14g.summary_tolerance",
  "test.at14g.full_size_tolerance",
  "test.at14g.max_wait",
  "test.at14g.pdf_min_size_ratio",
  "test.at14g.format",
  "test.at14g.generate_pdf",
  "cache.enabled",
  "cache.backend",
  "cache.ttl_seconds",
  "cache.max_entries"
] as const;

export const SETTINGS_SECRET_KEYS = [
  "app.certificate",
  "app.key",
  "email.smtp.default.password",
  "email.imap.default.host",
  "email.imap.default.username",
  "email.imap.default.password",
  "api_server.api_key",
  "web_server.password",
  "mcp_server.api_key",
  "mcp_server.client_api_key",
  "llm.base_url",
  "llm.model",
  "llm.openai_api_key",
  "llm.anthropic_api_key",
  "llm.azure_openai_api_key",
  "llm.google_api_key",
  "llm.max_tokens",
  "llm.token_estimate_chars_per_token",
  "channels.smtp.default.host",
  "channels.smtp.default.port",
  "channels.smtp.default.username",
  "channels.smtp.default.password",
  "channels.smtp.default.from_address",
  "channels.smtp.demo27_transparent_borders.password",
  "channels.sms.default.api_key",
  "channels.whatsapp.default.token",
  "channels.chat_rest.default.api_token",
  "channels.chat_rest.transparentbordes.endpoint",
  "confirmations.signature.secret",
  "auth.jwt_secret",
  "storage.s3.secret_key",
  "storage.webdav.password",
  "storage.ftp.password",
  "test.webhook.slack_url",
  "test.webhook.bearer_token"
] as const;

export const SETTINGS_SOURCE_MAP: JsonExplorerSourceMap = {
  "app.id": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "app.version": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "app.title": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "app.description": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "app.server_name": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "app.server_id": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "app.default_language": {
    "source": "env",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "app.certificate": {
    "source": "default",
    "secret": true,
    "servers": [
      "shared"
    ]
  },
  "app.key": {
    "source": "default",
    "secret": true,
    "servers": [
      "shared"
    ]
  },
  "app.env_write_enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "db.uri": {
    "source": "env",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "default_channel": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "email.smtp.default.host": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "email.smtp.default.port": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "email.smtp.default.username": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "email.smtp.default.password": {
    "source": "env",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "email.smtp.default.from_address": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "email.smtp.default.use_tls": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "email.smtp.default.use_starttls": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "email.imap.default.host": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "email.imap.default.port": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "email.imap.default.username": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "email.imap.default.password": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "email.imap.default.use_tls": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "email.imap.default.use_starttls": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "email.imap.default.mailbox": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "email.imap.default.poll_timeout_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "email.imap.default.poll_interval_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.host": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.port": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.base_path": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.base_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.api_key": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "api_server.cors_origins[0]": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.request_timeout": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.message_fetch_timeout": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.max_request_size": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.max_startup_retries": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.http_client_timeout": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.db_query_timeout": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.db_query_timeout_short": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api_server.subprocess_timeout": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "web_server.enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.host": {
    "source": "env",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.port": {
    "source": "env",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.base_path": {
    "source": "default",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.max_startup_retries": {
    "source": "default",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.username": {
    "source": "env",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.password": {
    "source": "vault",
    "secret": true,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.base_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.api_base_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.session_max_age": {
    "source": "env",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.session_timeout": {
    "source": "default",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.proxy_timeout_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.status_refresh_interval": {
    "source": "default",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.jobs_refresh_interval": {
    "source": "default",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "web_server.connection_check_interval": {
    "source": "default",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "mcp_server.enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.transport": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.base_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.base_path": {
    "source": "default",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.port": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.host": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.protocol_version": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.max_startup_retries": {
    "source": "default",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.name": {
    "source": "default",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.version": {
    "source": "default",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.tls": {
    "source": "default",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.api_base_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.api_key": {
    "source": "vault",
    "secret": true,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.request_timeout": {
    "source": "default",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.max_concurrent_requests": {
    "source": "default",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.client_api_key": {
    "source": "default",
    "secret": true,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.session_ttl_seconds": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.streamable_http_path": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.jsonrpc_path": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.legacy_sse_path": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.legacy_sse_message_path": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.async_jobs_enabled": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.async_jobs_status_path": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.async_jobs_timeout_seconds": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.async_jobs_poll_interval_seconds": {
    "source": "env",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.sync_budget_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "mcp_server.sync_budget_progress_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "MCP"
    ]
  },
  "resource_pools.llm-pool.max_running": {
    "source": "env",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "resource_pools.delivery-pool.max_running": {
    "source": "env",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "a2a_server.enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "A2A"
    ]
  },
  "a2a_server.port": {
    "source": "env",
    "secret": false,
    "servers": [
      "A2A"
    ]
  },
  "a2a_server.host": {
    "source": "env",
    "secret": false,
    "servers": [
      "A2A"
    ]
  },
  "a2a_server.base_path": {
    "source": "default",
    "secret": false,
    "servers": [
      "A2A"
    ]
  },
  "a2a_server.max_startup_retries": {
    "source": "default",
    "secret": false,
    "servers": [
      "A2A"
    ]
  },
  "a2a_server.base_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "A2A"
    ]
  },
  "a2a_server.api_base_url": {
    "source": "default",
    "secret": false,
    "servers": [
      "A2A"
    ]
  },
  "a2a_server.websocket_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "A2A"
    ]
  },
  "a2a_server.request_timeout": {
    "source": "default",
    "secret": false,
    "servers": [
      "A2A"
    ]
  },
  "api.timeout": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api.read_timeout": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "api.connect_timeout": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.name": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.backend": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.sql_database_url": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.redis_url": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.redis_key_prefix": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.default_ttl_hours": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.max_retries": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.backoff_base_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.backoff_max_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.worker_poll_interval_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.worker_batch_size": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.sending_timeout_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.claim_timeout_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.run_timeout_ms": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.dead_letter_queue": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.watchdog.formatting_stuck_minutes_null_payload": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.watchdog.formatting_stuck_minutes_with_payload": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "queue.watchdog.sending_stuck_minutes": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "delivery.max_queued": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "delivery_worker.enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "delivery_worker.host": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "delivery_worker.port": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "delivery_worker.base_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "delivery_worker.poll_interval": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "delivery_worker.batch_size": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "delivery_worker.max_concurrent_deliveries": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "rate_limit.per_channel_per_minute": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "rate_limit.per_channel_per_hour": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "rate_limit.per_channel_per_day": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "rate_limit.per_destination_per_minute": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "rate_limit.per_destination_per_hour": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "circuit.soft_error_threshold": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "circuit.hard_error_threshold": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "circuit.cooldown_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.provider": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.base_url": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "llm.model": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "llm.temperature": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.ignore_tls": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.openai_api_key": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "llm.anthropic_api_key": {
    "source": "default",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "llm.azure_openai_api_key": {
    "source": "default",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "llm.azure_openai_endpoint": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.azure_openai_api_version": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.google_api_key": {
    "source": "default",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "llm.aws_region": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.num_ctx": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.num_predict": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.max_tokens": {
    "source": "env",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "llm.token_estimate_chars_per_token": {
    "source": "env",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "llm.chunk_max_rounds": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.timeout": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.query_timeout": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.retry_attempts": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.retry_delay": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.auto_pull": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.model_load_timeout": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.startup_timeout": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.event_loop_init_timeout": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.top_p": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.top_k": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.repeat_penalty": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.seed": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.mirostat": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.mirostat_tau": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.mirostat_eta": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.translation_timeout": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.translation_chunk_chars": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.translation_chunk_parallelism": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.formatting_timeout": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.summarization_timeout": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.default_system_prompt": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.format_instructions.markdown": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.format_instructions.html": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.format_instructions.plain": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.language_instruction_template": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.summarization_prompt_template": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.post_processing.strip_english_boilerplate[0]": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.post_processing.strip_english_boilerplate[1]": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.post_processing.strip_english_boilerplate[2]": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.post_processing.strip_english_boilerplate[3]": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.post_processing.strip_english_boilerplate[4]": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.post_processing.strip_english_boilerplate[5]": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.post_processing.strip_english_boilerplate[6]": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.model_prompts.granite4_tiny_h.summarization_prompt_template": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "llm.model_prompts.granite4_tiny_h.language_instruction_template": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.default.enabled": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.default.host": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.default.port": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.default.username": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.default.password": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.default.from_address": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.default.use_tls": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.demo27_transparent_borders.enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.demo27_transparent_borders.host": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.demo27_transparent_borders.port": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.demo27_transparent_borders.username": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.demo27_transparent_borders.password": {
    "source": "default",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.demo27_transparent_borders.from_address": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.smtp.demo27_transparent_borders.use_tls": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.sms.default.enabled": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.sms.default.provider": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.sms.default.api_key": {
    "source": "default",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "channels.sms.default.sender": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.sms.default.account_sid": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.sms.default.base_url": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.whatsapp.default.enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.whatsapp.default.base_url": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.whatsapp.default.token": {
    "source": "default",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "channels.whatsapp.default.account_sid": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.whatsapp.default.from_number": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.default.enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.default.endpoint": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.default.api_token": {
    "source": "default",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.default.channel_id": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.transparentbordes.enabled": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.transparentbordes.endpoint": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.transparentbordes.is_channel_based": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.transparentbordes.auth_type": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.transparentbordes.format": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.transparentbordes.limits.rate_per_minute": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.transparentbordes.limits.rate_per_hour": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.transparentbordes.limits.max_length": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.transparentbordes.restrictions.max_length": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.transparentbordes.restrictions.allowed_formats[0]": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "channels.chat_rest.transparentbordes.restrictions.link_strategy": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "confirmations.signature.secret": {
    "source": "default",
    "secret": true,
    "servers": [
      "shared"
    ]
  },
  "confirmations.signature.algorithm": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "confirmations.polling.enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "confirmations.polling.interval_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.level": {
    "source": "env",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.format": {
    "source": "env",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.console": {
    "source": "env",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.service_instance": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.environment": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.audit_log": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.dump_config": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.api_server_log": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.web_server_log": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.web_access_log": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.mcp_server_log": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.a2a_server_log": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.delivery_worker_log": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.enable_access_log": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.max_bytes": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.backup_count": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.compress": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.rotation_type": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.retention_days": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.retention.hot_days": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.retention.cold_days": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.retention.archive_format": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.integrity.enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.integrity.interval_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.integrity.log_file": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.integrity.hash_algorithm": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.rotation.mode": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.rotation.max_bytes": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.rotation.backup_count": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.rotation.when": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.rotation.interval": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "log.rotation.compress": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "auth.provider": {
    "source": "default",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "auth.jwt_secret": {
    "source": "vault",
    "secret": true,
    "servers": [
      "WebUI"
    ]
  },
  "auth.jwt_algorithm": {
    "source": "default",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "auth.jwt_expiry_minutes": {
    "source": "default",
    "secret": false,
    "servers": [
      "WebUI"
    ]
  },
  "retention.messages_days": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "retention.deliveries_days": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "retention.receipts_days": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "retention.logs_days": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "retention.audit_events_days": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "observability.metrics_enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "observability.tracing_enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "observability.health_check_interval_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "messages.base_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "messages.header_templates.default": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "messages.header_templates.with_guid": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "messages.header_templates.simple": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "messages.link_labels.view_full_message": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "messages.link_labels.view_source_message": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "messages.link_labels.view_pdf": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "messages.link_labels.view_message_center": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "messages.link_labels.characters": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "messages.link_labels.znak\u00f3w": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "messages.link_labels.Zeichen": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "messages.link_labels.\u5b57\u7b26": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "messages.link_labels.\u0623\u062d\u0631\u0641": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.backend": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.local.base_path": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.local.base_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.filesystem.base_path": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.filesystem.create_subdirs": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.filesystem.subdir_pattern": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.filesystem.permissions": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.filesystem.dir_permissions": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.s3.endpoint": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.s3.bucket": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.s3.access_key": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.s3.secret_key": {
    "source": "default",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "storage.s3.region": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.webdav.url": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.webdav.username": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.webdav.password": {
    "source": "default",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "storage.ftp.host": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.ftp.port": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.ftp.username": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "storage.ftp.password": {
    "source": "default",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "storage.ftp.passive_mode": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.email_domain": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.default_sms_channel": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.media.image_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.media.http_image_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.media.https_image_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.webhook.slack_url": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "test.webhook.local_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.webhook.example_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.webhook.invalid_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.webhook.invalid_scheme_url": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.webhook.bearer_token": {
    "source": "vault",
    "secret": true,
    "servers": [
      "API"
    ]
  },
  "test.performance.channel": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.performance.iterations": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.performance.p95_threshold_ms": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.performance.inter_request_delay_ms": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.performance.skip_sqlite": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.max_wait": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.poll_interval": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.subject_template": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.scenarios[0].source": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.scenarios[0].target": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.scenarios[0].size": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.scenarios[0].format": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.scenarios[0].id": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.negative.max_wait": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.negative.scenarios[0].id": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.negative.scenarios[0].description": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.negative.scenarios[0].remove_destination": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.negative.scenarios[0].expected_fails_at": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.negative.scenarios[0].expected_status": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.smtp_variants[0].id": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.smtp_variants[0].description": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.smtp_variants[0].port": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.smtp_variants[0].use_tls": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.smtp_variants[0].use_starttls": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.personalised.scenarios[0].language": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.personalised.scenarios[0].content_style": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at15.personalised.scenarios[0].description": {
    "source": "default",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14d.summary_size": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14d.summary_tolerance": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14d.max_wait": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14d.pdf_min_size_ratio": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14d.format": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14d.generate_pdf": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14g.summary_size": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14g.summary_tolerance": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14g.full_size_tolerance": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14g.max_wait": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14g.pdf_min_size_ratio": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14g.format": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "test.at14g.generate_pdf": {
    "source": "env",
    "secret": false,
    "servers": [
      "API"
    ]
  },
  "cache.enabled": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "cache.backend": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "cache.ttl_seconds": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  },
  "cache.max_entries": {
    "source": "default",
    "secret": false,
    "servers": [
      "shared"
    ]
  }
};

export const SETTINGS_SERVER_TABS = ['ALL', 'API', 'MCP', 'A2A', 'WebUI'] as const;
export type SettingsServerTab = typeof SETTINGS_SERVER_TABS[number];
