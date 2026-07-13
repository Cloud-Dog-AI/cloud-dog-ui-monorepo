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

// @cloud-dog/ui — Pattern exports.

export { CrudPage } from "./CrudPage";
export type { CrudColumn, CrudBulkAction, CrudPageProps } from "./CrudPage";
export {
  CRUD_ACTION_LABELS,
  CRUD_TABLE_MESSAGES,
  CRUD_EXTENSION_SLOT_TEST_ID,
  crudDialogTitle,
  crudRequiredMessage,
  crudDeleteConfirmation,
  singularizeEntityName,
} from "./CrudVocabulary";
export type { CrudActionMode } from "./CrudVocabulary";

export { StatusCard } from "./StatusCard";
export type { StatusCardProps, StatusTone } from "./StatusCard";

export { LogViewer } from "./LogViewer";
export type { LogViewerProps } from "./LogViewer";

export { ChatMessage } from "./ChatMessage";
export type { ChatMessageProps, ChatRole } from "./ChatMessage";

export { ChatTimeline } from "./ChatTimeline";
export type { ChatTimelineProps, TimelineMessage } from "./ChatTimeline";

export { MessageList } from "./MessageList";
export type { MessageListProps, MessageItem, MessageBulkAction } from "./MessageList";

export { ToolCallPanel } from "./ToolCallPanel";
export type { ToolCallPanelProps } from "./ToolCallPanel";

export { JsonBlock } from "./JsonBlock";
export type { JsonBlockProps } from "./JsonBlock";

export { JsonExplorer } from "./JsonExplorer";
export type { JsonExplorerProps, JsonExplorerSource, JsonExplorerSourceMap } from "./JsonExplorer";

export { WorkedExamplePopup } from "./WorkedExamplePopup";
export type { WorkedExampleProps } from "./WorkedExamplePopup";

export { StructuredView } from "./StructuredView";
export type { StructuredViewProps } from "./StructuredView";

export { EntityForm } from "./EntityForm";
export type { EntityFormProps, EntityFieldDef, EntityFormMode } from "./EntityForm";

export { MetadataEditor } from "./MetadataEditor";
export type { MetadataEditorProps, MetadataFieldSpec, MetadataFieldType } from "./MetadataEditor";

export { EntityDialog } from "./EntityDialog";
export type {
  EntityDialogProps,
  EntityDialogFormProps,
  EntityDialogBodyProps,
  EntityDialogRelatedPanel,
} from "./EntityDialog";

export { ComposeDialog } from "./ComposeDialog";
export type {
  ComposeDialogProps,
  ComposeChannelOption,
  ComposeTemplate,
  ComposedMessage,
} from "./ComposeDialog";

export { RelatedItemsPanel } from "./RelatedItemsPanel";
export type { RelatedItemsPanelProps, RelatedItem } from "./RelatedItemsPanel";

export { SessionsHistoryPanel, sessionsHistoryStatusTone } from "./SessionsHistoryPanel";
export type {
  SessionsHistoryPanelProps,
  SessionsHistoryRow,
  SessionsHistoryAction,
  SessionsHistoryConfirmConfig,
  SessionsHistoryDetailItem,
  SessionsHistoryTimestamp,
  SessionsHistoryVariant,
  SessionsHistoryStatusTone,
} from "./SessionsHistoryPanel";

export { RelationshipGraph } from "./RelationshipGraph";
export type {
  RelationshipGraphProps,
  RelationshipNode,
  RelationshipEdge,
  RelationshipGraphDirection,
} from "./RelationshipGraph";

export { FileBrowser } from "./FileBrowser";
export type { FileBrowserProps, FileItem } from "./FileBrowser";

export { FolderTree } from "./FolderTree";
export type { FolderTreeProps, FolderNode } from "./FolderTree";

export { FileArtifactCard } from "./FileArtifactCard";
export type { FileArtifactCardProps, FileArtifactPreview, FileArtifactAction } from "./FileArtifactCard";

export { FileDropZone } from "./FileDropZone";
export type { FileDropZoneProps } from "./FileDropZone";

export { McpConsole } from "./McpConsole";
export type { McpConsoleProps, McpToolDef } from "./McpConsole";

export { A2aConsole } from "./A2aConsole";
export type { A2aConsoleProps } from "./A2aConsole";

export { SettingsPanel } from "./SettingsPanel";
export type { SettingsPanelProps, SettingsPanelServerTab, SettingsPanelStatus, SettingGroupDef } from "./SettingsPanel";

export { SettingGroup } from "./SettingGroup";
export type { SettingGroupProps } from "./SettingGroup";

export { SettingControl } from "./SettingControl";
export type { SettingControlProps, SettingDef } from "./SettingControl";

export { AuditPanel } from "./AuditPanel";
export type { AuditPanelProps } from "./AuditPanel";

export { LogStream } from "./LogStream";
export type { LogStreamProps, LogEntry } from "./LogStream";

export { ResourceMetrics } from "./ResourceMetrics";
export type { ResourceMetricsProps, MetricItem } from "./ResourceMetrics";

// PS-WEBUI-STYLE-COMPONENTS §10 / W28E-1851 (STD-F16): canonical diagnostics /
// health / resource-metrics panel composition.
export { DiagnosticsHealthPanel } from "./DiagnosticsHealthPanel";
export type {
  DiagnosticsHealthPanelProps,
  DiagnosticsHealthItem,
  DiagnosticsMetricCardItem,
} from "./DiagnosticsHealthPanel";

export { RelativeTime } from "./RelativeTime";
export type { RelativeTimeProps } from "./RelativeTime";

export { HealthWidget } from "./HealthWidget";
export type { HealthWidgetProps, HealthStatus } from "./HealthWidget";

export { MetricCard } from "./MetricCard";
export type { MetricCardProps, MetricTrend } from "./MetricCard";

export { QuickActionBar } from "./QuickActionBar";
export type { QuickActionBarProps, QuickAction } from "./QuickActionBar";

export { ToolBrowser } from "./ToolBrowser";
export type { ToolBrowserProps, ToolDef } from "./ToolBrowser";

export { ApiDocsPanel } from "./ApiDocsPanel";
export type {
  ApiDocsPanelProps,
  ApiDocLink,
  ApiDocsMode,
  McpToolDoc,
  A2aSkillDoc,
  ApiDocsExtraTab,
} from "./ApiDocsPanel";

export { AdminUsersPage } from "./AdminUsersPage";
export type { AdminUsersPageProps } from "./AdminUsersPage";

export { AdminGroupsPage } from "./AdminGroupsPage";
export type { AdminGroupsPageProps } from "./AdminGroupsPage";

export { AdminApiKeysPage } from "./AdminApiKeysPage";
export type { AdminApiKeysPageProps } from "./AdminApiKeysPage";

export { JobsPage } from "./JobsPage";
export type { JobsPageProps, JobItem, JobStatus } from "./JobsPage";

export { AdminRbacPage } from "./AdminRbacPage";
export type { AdminRbacPageProps, RbacBinding, RbacUser, RoleDef } from "./AdminRbacPage";

export { LogTablePanel } from "./LogTablePanel";
export type {
  LogTablePanelProps,
  LogApiAdapter,
  LogsResponse,
  LogSurface,
  AuditLogEntry,
} from "./LogTablePanel";

export { DocumentViewer } from "./DocumentViewer";
export type { DocumentViewerProps } from "./DocumentViewer";

export { CodeEditor } from "./CodeEditor";
export type { CodeEditorProps } from "./CodeEditor";

export { CodeViewer } from "./CodeViewer";
export type { CodeViewerProps } from "./CodeViewer";

export { DiffViewer } from "./DiffViewer";
export type { DiffViewerProps } from "./DiffViewer";

export { SelectionCriteriaPanel, loadPersistedSelection } from "./SelectionCriteriaPanel";
export type {
  SelectionCriteriaPanelProps,
  SelectionCriteria,
  SelectionCriteriaField,
  SelectionCriteriaSources,
  SelectionOption,
  ProfileOption,
  WorkspaceOption,
  RefOption,
  PathOption,
  AuthorOption,
  StashOption,
  RefType,
} from "./SelectionCriteriaPanel";

export { SearchPanel } from "./SearchPanel";
export type {
  SearchPanelProps,
  SearchFilterDef,
  SearchFilterOption,
  SearchFilterValue,
  SearchFilterValues,
} from "./SearchPanel";

// W28B-319: prompt-engineering (AGENTIC D5) presentation components.
export { PromptEditor } from "./PromptEditor";
export type { PromptEditorProps, PromptTemplateValues } from "./PromptEditor";

export { PromptVersionPicker } from "./PromptVersionPicker";
export type { PromptVersionPickerProps, PromptVersion } from "./PromptVersionPicker";

export { PromptTestRunner } from "./PromptTestRunner";
export type {
  PromptTestRunnerProps,
  PromptTestCase,
  PromptTestResult,
  PromptTestStatus,
} from "./PromptTestRunner";

// PS-72 v2 MCP/A2A console components (promoted from W28A-774 under W28A-773).
export { Ps72McpConsole } from "./ps72/Ps72McpConsole";
export type { Ps72McpConsoleProps, Ps72McpTool } from "./ps72/Ps72McpConsole";
export { Ps72A2aConsole } from "./ps72/Ps72A2aConsole";
export type { Ps72A2aConsoleProps, Ps72A2aEvent } from "./ps72/Ps72A2aConsole";
export { Ps72ApiKeyField, Ps72HealthBadge, Ps72ResultMeta } from "./ps72/Ps72Parts";
export { formatDuration, lifecycleTone } from "./ps72/metaTypes";
export type {
  Ps72LifecycleState,
  Ps72HealthState,
  Ps72Meta,
  Ps72ExecuteResult,
} from "./ps72/metaTypes";
