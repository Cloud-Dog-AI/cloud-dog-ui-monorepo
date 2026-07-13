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

// @cloud-dog/ui — Public barrel exports.

export { cn } from './utils/cn';
export {
  formatRelativeTime,
  formatMillis,
  formatBytes,
  formatSeconds,
} from './utils/formatRelativeTime';

export { ActionableError } from './actionable-error';
export type { ActionableErrorAction, ActionableErrorProps } from './actionable-error';
export { ConnectionPicker } from './connection-picker';
export type {
  ConnectionPickerOption,
  ConnectionPickerProps,
  ConnectionPickerTestResult,
} from './connection-picker';
export { DiscoveredMultiSelect } from './discovered-multi-select';
export type { DiscoveredMultiSelectProps, DiscoveredOption } from './discovered-multi-select';
export { MasterDetailLayout } from './master-detail-layout';
export type { MasterDetailLayoutProps } from './master-detail-layout';
export { SavedQueryControls } from './saved-query-controls';
export type { SavedQueryControlsProps, SavedQueryOption } from './saved-query-controls';
export { ScopeTestPanel } from './scope-test-panel';
export type {
  ScopeTestAccessibleItem,
  ScopeTestPanelProps,
  ScopeTestResult,
} from './scope-test-panel';

export { Button, buttonVariants } from './components/button';
export type { ButtonProps } from './components/button';

export {
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Switch,
  Label,
  FieldHelp,
  Combobox,
  MultiSelect,
  DatePicker,
  DateRangePicker,
  toISODate,
  fromISODate,
} from './components/input';
export type {
  SwitchProps,
  ComboboxOption,
  ComboboxProps,
  MultiSelectOption,
  MultiSelectProps,
  DatePickerProps,
  DateRangePickerProps,
  DateRange,
} from './components/input';

export { Card, CardHeader, CardContent, CardFooter } from './components/card';

export { Dialog, ConfirmDialog, Sheet } from './components/dialog';
export type { DialogProps, ConfirmDialogProps, SheetProps } from './components/dialog';

export { Popover, Tooltip, HelpTip, DropdownMenu } from './components/popover';
export type { HelpTipProps } from './components/popover';
export type { DropdownItem } from './components/popover';

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  DataTable,
  DataTableActionCell,
  createDataTableActionColumn,
  statusColumn,
} from './components/table';
export type {
  DataColumn,
  DataTableProps,
  BulkAction,
  DataTableAction,
  StatusColumnOptions,
} from './components/table';

export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/tabs';

export { Alert, ToastProvider, useToast, Toaster, Progress, Spinner } from './components/feedback';
export type { ToastItem, ToastVariant } from './components/feedback';

export {
  Separator,
  Badge,
  Avatar,
  Skeleton,
  StatusBadge,
  detectTone,
  toneSortWeight,
} from './components/layout';
export type { StatusBadgeTone, StatusBadgeProps } from './components/layout';

export { useFocusTrap } from './hooks/useFocusTrap';
export { useKeyboardNav } from './hooks/useKeyboardNav';
export type { KeyboardNavOptions } from './hooks/useKeyboardNav';
export { useReducedMotion } from './hooks/useReducedMotion';
export { useAuditLink, parseAuditLinkParams, getAuditLinkProps } from './hooks/useAuditLink';
export type {
  AuditLink,
  AuditLinkExtras,
  AuditFilters,
  AuditLinkProps,
} from './hooks/useAuditLink';

export {
  CrudPage,
  StatusCard,
  LogViewer,
  ChatMessage,
  ChatTimeline,
  MessageList,
  ToolCallPanel,
  JsonBlock,
  JsonExplorer,
  StructuredView,
  EntityForm,
  MetadataEditor,
  EntityDialog,
  ComposeDialog,
  RelatedItemsPanel,
  SessionsHistoryPanel,
  sessionsHistoryStatusTone,
  RelationshipGraph,
  FileArtifactCard,
  FileBrowser,
  FolderTree,
  FileDropZone,
  McpConsole,
  A2aConsole,
  Ps72McpConsole,
  Ps72A2aConsole,
  Ps72ApiKeyField,
  Ps72HealthBadge,
  Ps72ResultMeta,
  formatDuration,
  lifecycleTone,
  SettingsPanel,
  SettingGroup,
  SettingControl,
  AuditPanel,
  LogTablePanel,
  LogStream,
  ResourceMetrics,
  DiagnosticsHealthPanel,
  RelativeTime,
  HealthWidget,
  MetricCard,
  QuickActionBar,
  ToolBrowser,
  ApiDocsPanel,
  AdminUsersPage,
  AdminGroupsPage,
  AdminApiKeysPage,
  AdminRbacPage,
  JobsPage,
  DocumentViewer,
  CodeEditor,
  CodeViewer,
  DiffViewer,
  SearchPanel,
  PromptEditor,
  PromptVersionPicker,
  PromptTestRunner,
  WorkedExamplePopup,
  SelectionCriteriaPanel,
  loadPersistedSelection,
  CRUD_ACTION_LABELS,
  CRUD_TABLE_MESSAGES,
  CRUD_EXTENSION_SLOT_TEST_ID,
  crudDialogTitle,
  crudRequiredMessage,
  crudDeleteConfirmation,
  singularizeEntityName,
} from './patterns';
export type { WorkedExampleProps } from './patterns/WorkedExamplePopup';
export type {
  CrudColumn,
  CrudBulkAction,
  CrudPageProps,
  CrudActionMode,
  StatusCardProps,
  StatusTone,
  LogViewerProps,
  ChatMessageProps,
  ChatRole,
  ChatTimelineProps,
  TimelineMessage,
  MessageListProps,
  MessageItem,
  MessageBulkAction,
  ToolCallPanelProps,
  JsonBlockProps,
  JsonExplorerProps,
  JsonExplorerSource,
  JsonExplorerSourceMap,
  StructuredViewProps,
  EntityFormProps,
  EntityFieldDef,
  EntityFormMode,
  MetadataEditorProps,
  MetadataFieldSpec,
  MetadataFieldType,
  EntityDialogProps,
  EntityDialogFormProps,
  EntityDialogBodyProps,
  EntityDialogRelatedPanel,
  ComposeDialogProps,
  ComposeChannelOption,
  ComposeTemplate,
  ComposedMessage,
  RelatedItemsPanelProps,
  RelatedItem,
  SessionsHistoryPanelProps,
  SessionsHistoryRow,
  SessionsHistoryAction,
  SessionsHistoryConfirmConfig,
  SessionsHistoryDetailItem,
  SessionsHistoryTimestamp,
  SessionsHistoryVariant,
  SessionsHistoryStatusTone,
  RelationshipGraphProps,
  RelationshipNode,
  RelationshipEdge,
  RelationshipGraphDirection,
  FileArtifactCardProps,
  FileArtifactPreview,
  FileArtifactAction,
  FileBrowserProps,
  FileItem,
  FolderTreeProps,
  FolderNode,
  FileDropZoneProps,
  McpConsoleProps,
  McpToolDef,
  A2aConsoleProps,
  Ps72McpConsoleProps,
  Ps72McpTool,
  Ps72A2aConsoleProps,
  Ps72A2aEvent,
  Ps72LifecycleState,
  Ps72HealthState,
  Ps72Meta,
  Ps72ExecuteResult,
  SettingsPanelProps,
  SettingsPanelServerTab,
  SettingsPanelStatus,
  SettingGroupDef,
  SettingGroupProps,
  SettingControlProps,
  SettingDef,
  AuditPanelProps,
  LogTablePanelProps,
  LogApiAdapter,
  LogsResponse,
  LogSurface,
  AuditLogEntry,
  LogStreamProps,
  LogEntry,
  ResourceMetricsProps,
  MetricItem,
  DiagnosticsHealthPanelProps,
  DiagnosticsHealthItem,
  DiagnosticsMetricCardItem,
  RelativeTimeProps,
  HealthWidgetProps,
  HealthStatus,
  MetricCardProps,
  MetricTrend,
  QuickActionBarProps,
  QuickAction,
  ToolBrowserProps,
  ToolDef,
  ApiDocsPanelProps,
  ApiDocLink,
  ApiDocsMode,
  McpToolDoc,
  A2aSkillDoc,
  ApiDocsExtraTab,
  AdminUsersPageProps,
  AdminGroupsPageProps,
  AdminApiKeysPageProps,
  AdminRbacPageProps,
  RbacBinding,
  RbacUser,
  RoleDef,
  JobsPageProps,
  JobItem,
  JobStatus,
  DocumentViewerProps,
  CodeEditorProps,
  CodeViewerProps,
  DiffViewerProps,
  SearchPanelProps,
  SearchFilterDef,
  SearchFilterOption,
  SearchFilterValue,
  SearchFilterValues,
  PromptEditorProps,
  PromptTemplateValues,
  PromptVersionPickerProps,
  PromptVersion,
  PromptTestRunnerProps,
  PromptTestCase,
  PromptTestResult,
  PromptTestStatus,
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
} from './patterns';

export { formatRelative } from './components/time/RelativeTimeUtils';

// Multimodal components (W28F-948) — inline image/video/audio/PDF, drag-drop
// upload, live entity-graph + convergence-cluster, output-language toggle.
// Shared in @cloud-dog/ui for reuse across chat-client + search-mcp WebUI.
export {
  ImagePreview,
  VideoPlayer,
  AudioPlayer,
  PDFViewer,
  DragDropUpload,
  DEFAULT_MULTIMODAL_ACCEPT,
  fileMatchesAccept,
  EntityGraphLive,
  reduceEntityGraph,
  ConvergenceClusterLive,
  reduceConvergence,
  LanguageToggle,
  DEFAULT_OUTPUT_LANGUAGES,
  OUTPUT_LANGUAGE_LABELS,
  RTL_LANGUAGES,
  buildStoragePathReference,
  buildUrlReference,
  isInlineDataUrl,
  normaliseAssetReference,
  tryNormaliseAssetReference,
  formatTimecode,
} from './multimodal';
export type {
  ImagePreviewProps,
  VideoPlayerProps,
  AudioPlayerProps,
  PDFViewerProps,
  DragDropUploadProps,
  EntityGraphLiveProps,
  ConvergenceClusterLiveProps,
  LanguageToggleProps,
  TranscriptCue,
  MediaTranscript,
  Waveform,
  EntityGraphEvent,
  ConvergenceCluster,
  ConvergenceSource,
  ConvergenceEvent,
  OutputLanguage,
  AssetReference,
  NormaliseAssetReferenceOptions,
} from './multimodal';

// lucide-react icons should be imported directly by apps, not re-exported here
// (re-exporting causes Vite TDZ "Cannot access 'X' before initialization" errors)

// W28E-1870-F — cross-service change-watch component set (PS-102 §10).
export {
  ChangeWatchPanel,
  WatchJournalTable,
  CriteriaBuilder,
  WatchStatusBadge,
  watchStateTone,
} from './change-watch';
export type {
  ChangeWatchPanelProps,
  WatchJournalTableProps,
  CriteriaBuilderProps,
  WatchStatusBadgeProps,
  WatchState,
  WatchRow,
  WatchEventRow,
  WatchCriteria,
  WatchCriterion,
  CriterionKind,
} from './change-watch';
