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

export { cn } from "./utils/cn";

export { Button, buttonVariants } from "./components/button";
export type { ButtonProps } from "./components/button";

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
} from "./components/input";
export type { SwitchProps, ComboboxOption, ComboboxProps, MultiSelectOption, MultiSelectProps } from "./components/input";

export { Card, CardHeader, CardContent, CardFooter } from "./components/card";

export { Dialog, ConfirmDialog, Sheet } from "./components/dialog";
export type { DialogProps, ConfirmDialogProps, SheetProps } from "./components/dialog";

export { Popover, Tooltip, DropdownMenu } from "./components/popover";
export type { DropdownItem } from "./components/popover";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, DataTable, statusColumn } from "./components/table";
export type { DataColumn, DataTableProps, BulkAction, StatusColumnOptions } from "./components/table";

export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";

export { Alert, ToastProvider, useToast, Toaster, Progress, Spinner } from "./components/feedback";
export type { ToastItem, ToastVariant } from "./components/feedback";

export { Separator, Badge, Avatar, Skeleton, StatusBadge, detectTone, toneSortWeight } from "./components/layout";
export type { StatusBadgeTone, StatusBadgeProps } from "./components/layout";

export { useFocusTrap } from "./hooks/useFocusTrap";
export { useKeyboardNav } from "./hooks/useKeyboardNav";
export type { KeyboardNavOptions } from "./hooks/useKeyboardNav";
export { useReducedMotion } from "./hooks/useReducedMotion";

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
  EntityDialog,
  ComposeDialog,
  RelatedItemsPanel,
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
} from "./patterns";
export type {
  CrudColumn,
  CrudBulkAction,
  CrudPageProps,
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
  AdminUsersPageProps,
  AdminGroupsPageProps,
  AdminApiKeysPageProps,
  AdminRbacPageProps,
  RbacBinding,
  RbacUser,
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
} from "./patterns";

export { formatRelative } from "./components/time/RelativeTimeUtils";

// lucide-react icons should be imported directly by apps, not re-exported here
// (re-exporting causes Vite TDZ "Cannot access 'X' before initialization" errors)
