# Canonical UX (ChatGPT/OpenWebUI inspired)

## Shell layout wireframes

### Desktop (canonical)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Top Bar:  [Logo Brand]  Env  ────────────────  Search  ─────  User Menu     │
├───────────────┬───────────────────────────────────────────────┬─────────────┤
│ Left Rail      │ Main Pane                                      │ Right Drawer│
│ - App switcher │ - Page header + actions                         │ (optional)  │
│ - Nav sections │ - Primary content (chat/test/CRUD)              │ - Inspector │
│ - Recent items │                                                 │ - Help/logs │
│               │                                                 │             │
└───────────────┴───────────────────────────────────────────────┴─────────────┘
```

### Mobile
```
┌───────────────────────────────┐
│ Top Bar: ☰  Brand      User   │
├───────────────────────────────┤
│ Main Pane                      │
│ (Left rail becomes a drawer)   │
└───────────────────────────────┘
```

## Canonical pages

### 1) Test Console
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header: Test Console                      [Save preset] [Run]               │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ Request Builder      │ Response Viewer                                       │
│ - Target: API/MCP/A2A │ - Streamed output                                    │
│ - Method + URL       │ - Status + timing                                     │
│ - Headers            │ - Correlation ID                                      │
│ - Body (JSON)        │ - Copy / Download                                     │
│ - Presets            │ - Tabs: Body / Headers / Trace                        │
└─────────────────────┴───────────────────────────────────────────────────────┘
```

### 2) CRUD List
```
Header: Entity Name     [Create]
Filters row: Search | Status | Sort
Table: columns...
Footer: page size | paging controls | total count
```

### 3) CRUD Create/Edit
- Title + breadcrumb
- Form sections with headings
- Inline validation + error summary at top
- Sticky footer actions: [Cancel] [Save]

### 4) Logs
- Time range + level + service + correlation id
- Virtualised list/table
- Export button
