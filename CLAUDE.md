# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Weekly Task Manager** — a Chrome/Chromium browser extension (Manifest V3) for managing tasks with priority levels (Critical, Important, Someday), categories (Home, Work), energy levels (Low, High), and a visual weekly planner grid with 11 time blocks. The extension provides a compact popup interface and a full-page planner view, both kept in sync via `chrome.storage.onChanged`. Data is persisted using `chrome.storage.local` with no external runtime dependencies.

## Architecture

### Core Components

- `task_utils.js` (~540 lines) — Shared utilities: Task class, CRUD operations, settings, undo/redo, recurring tasks, time blocks, validation (including time overlap), debounce, operation queue, cross-tab sync
- `settings.js` (~1000 lines) — Settings management: theme/font application, settings modal UI, tabbed import/export modal (JSON, CSV, Google Sheets, Notion with bidirectional sync), time blocks modal with inline label editing
- `popup.js` (~390 lines) — Popup interface: task rendering (with notes/recurrence), tab switching, completion handlers, drag-and-drop reordering
- `manager.js` (~900 lines) — Full-page planner: weekly grid, drag-and-drop scheduling, inline editing, archive tab, stats tab, search/filter, undo toast, keyboard undo, settings wiring, add task modal
- `popup.html` (~102 lines) — Popup markup (3 tabs: TODAY, Display, ADD — with notes textarea and recurrence select)
- `manager.html` (~800 lines) — Planner markup (5 tabs: SCHEDULE, PRIORITY, LOCATION, ARCHIVE, STATS + settings/help/add-task/import-export/time-blocks modals, help has 8 tabs including FAQ)
- `popup.css` (~2000 lines) — Unified styles: neumorphic design, dark mode, modals, charts, archive, help, toast, search, notes, tooltips, FAQ styling, import/export tabs

### Extension Configuration

- `manifest.json` — Manifest V3 with `storage`, `tabs` permissions, and `host_permissions` for `https://api.notion.com/*`
- `images/` — Extension icons (16px, 48px, 128px)

### Test Infrastructure

- `package.json` — Dev dependencies (Jest 29, jest-environment-jsdom)
- `jest.config.js` — jsdom environment, collects coverage from source files
- `tests/mocks/chrome.storage.mock.js` — Chrome API mocks, `loadScript` helper, `seedSettings`, `seedTimeBlocks`, `global.fetch` stub
- `tests/task_utils.test.js` — ~90 tests for task_utils.js (includes new fields, settings, time blocks, undo/redo, recurring, time validation)
- `tests/popup.test.js` — ~17 tests for popup.js
- `tests/manager.test.js` — ~75 tests for manager.js (includes async grid, new tabs, search filter, add task modal, tooltips, FAQ)
- `tests/integration.test.js` — ~25 end-to-end tests (includes recurring tasks, undo lifecycle)
- `tests/settings.test.js` — ~38 tests for settings.js (includes time block editing, overlap validation, import/export modal tabs)
- `tests/features.test.js` — ~30 tests for notes, completedAt, undo/redo, recurring tasks, archive grouping
- `tests/search.test.js` — ~14 tests for search/filter functionality (including schedule search)

## Data Model

### Task Object

Tasks are stored in `chrome.storage.local` under the `tasks` key as an array of plain objects:

```javascript
{
  id: string,              // Unique: `task_${timestamp}_${random}`
  title: string,           // Task title (required)
  url: string,             // Optional URL (default: '')
  priority: string,        // 'CRITICAL' | 'IMPORTANT' | 'SOMEDAY'
  completed: boolean,      // Completion status
  deadline: string | null, // ISO date string, required for CRITICAL
  type: string,            // 'home' | 'work'
  displayOrder: number,    // Sort order within priority group
  schedule: ScheduleItem[],// Weekly schedule assignments
  energy: string,          // 'low' | 'high'
  notes: string,           // Optional notes/description (default: '')
  completedAt: string|null,// ISO timestamp when task was completed (default: null)
  recurrence: string|null, // null | 'daily' | 'weekly' | 'monthly'
  lastModified: string,    // ISO timestamp when task was last modified (auto-set on create/update)
  colorCode: string|null   // Custom color: null | 'red' | 'blue' | 'green' | 'purple' | 'orange'
}
```

### Storage Schema

```javascript
// chrome.storage.local keys:
'tasks': Task[]          // All tasks

'settings': {            // User preferences
  theme: 'light' | 'dark',
  fontFamily: 'system'|'inter'|'georgia'|'courier'|'roboto-mono',
  fontSize: 'small'|'medium'|'large',
  hasSeenSampleTasks: boolean,
  notionApiKey: string,
  notionDatabaseId: string,
  googleSheetsUrl: string,
  gapFillerTasks: Array<{title, priority, energy, type}>,  // Magic Fill quick tasks
  focusModeEnabled: boolean  // Focus mode preference
}

'timeBlocks': Array<{id, label, time, limit, colorClass}>  // Optional; falls back to DEFAULT_TIME_BLOCKS
```

### Schedule Item

Each entry in the `schedule` array represents a task assignment to a specific day and time block:

```javascript
{
  day: string,              // 'sunday' | 'monday' | ... | 'saturday'
  blockId: string,          // TIME_BLOCKS id (e.g., 'deep-work-1', 'ai-study')
  completed: boolean,       // Individual assignment completion
  spanBlocks: number,       // Number of blocks this item spans (default: 1)
  actualStartTime: string|null, // ISO timestamp when task was actually started (for time tracking)
  actualEndTime: string|null    // ISO timestamp when task was actually completed (for time tracking)
}
```

### DEFAULT_TIME_BLOCKS Constant

Defined in `task_utils.js` as `DEFAULT_TIME_BLOCKS`. A `TIME_BLOCKS` alias is kept for backward compatibility. Time blocks are configurable via the Time Blocks modal (accessible from the SCHEDULE tab) and stored in `chrome.storage.local` under the `timeBlocks` key; `getTimeBlocks()` returns stored blocks or falls back to `DEFAULT_TIME_BLOCKS`. Each block has: `id`, `label`, `time`, `limit` ('0', '1', or 'multiple'), `colorClass`.

| id | label | time | limit |
|----|-------|------|-------|
| `late-night-read` | Late Night Block | [12AM-1AM] | multiple |
| `sleep` | Sleep | [1AM-7AM] | 0 |
| `ai-study` | Deep Work Block 1 | [7AM-8AM] | 1 |
| `morning-prep` | Morning Prep | [8AM-9AM] | 0 |
| `engagement` | Engagement Block | [9AM-12PM] | multiple |
| `lunch` | Lunch Break | [12PM-1PM] | 0 |
| `deep-work-1` | Deep Work Block 2 | [1PM-3PM] | 1 |
| `deep-work-2` | Deep Work Block 3 | [3PM-6PM] | 1 |
| `commute-relax` | Commute and Relax | [6PM-8PM] | multiple |
| `family-time` | Chill Time | [8PM-10PM] | multiple |
| `night-build` | Night Block | [10PM-11PM] | 1 |

## Key Functions (task_utils.js)

| Function | Signature | Description |
|----------|-----------|-------------|
| `Task` | `new Task(id, title, url, priority, completed, deadline, type, displayOrder, schedule, energy, notes, completedAt, recurrence, notionPageId, lastModified)` | Constructor with defaults. Auto-generates ID if null. Auto-sets `lastModified` to current timestamp if null. |
| `getTasks` | `getTasks(callback)` | Reads tasks from storage. Backfills missing fields including `notes`, `completedAt`, `recurrence`, `lastModified`. |
| `getTasksAsync` | `getTasksAsync()` → Promise | Promise wrapper for `getTasks`. |
| `saveTasks` | `saveTasks(tasks, callback)` | Serializes to plain objects and saves. Updates `_lastSaveTimestamp` for sync guard. |
| `saveTasksAsync` | `saveTasksAsync(tasks)` → Promise | Promise wrapper for `saveTasks`. Rejects on failure. |
| `addNewTask` | `addNewTask(title, url, priority, deadline, type, energy, notes, recurrence)` → Promise | Creates task with computed `displayOrder`. |
| `getTaskById` | `getTaskById(taskId)` → Promise | Returns single task or `undefined`. |
| `updateTask` | `updateTask(updatedTask)` → Promise | Finds task, calls `updateTaskCompletion`, sets `completedAt`, updates `lastModified`, auto-creates recurring instance on completion. Returns boolean. |
| `updateTaskCompletion` | `updateTaskCompletion(task)` | If all `schedule[].completed === true`, sets `task.completed = true`. |
| `deleteTask` | `deleteTask(taskId)` → Promise | Removes by ID. Returns boolean. |
| `validateTask` | `validateTask(task)` → string[] | Returns error messages. Checks: title required, CRITICAL needs deadline, URL format. |
| `getSettings` | `getSettings()` → Promise | Loads settings from storage, merges with `DEFAULT_SETTINGS`. |
| `saveSettings` | `saveSettings(settings)` → Promise | Persists settings to `settings` key. |
| `seedSampleTasks` | `seedSampleTasks()` → Promise | Creates 6 sample tasks; sets `hasSeenSampleTasks=true` in settings. |
| `getTimeBlocks` | `getTimeBlocks()` → Promise | Returns stored time blocks or `DEFAULT_TIME_BLOCKS`. |
| `saveTimeBlocks` | `saveTimeBlocks(blocks)` → Promise | Persists time blocks to `timeBlocks` key. |
| `pushUndoState` | `pushUndoState(taskSnapshot)` | Deep-copies current tasks to `_undoStack` (max 5), clears `_redoStack`. |
| `undo` | `undo()` → Promise | Restores from `_undoStack`, pushes current state to `_redoStack`. |
| `redo` | `redo()` → Promise | Restores from `_redoStack`, pushes current state to `_undoStack`. |
| `createRecurringInstance` | `createRecurringInstance(task)` → Task | Creates new Task with new ID, empty schedule, shifted deadline (daily +1d, weekly +7d, monthly +1mo). |
| `parseTimeRange` | `parseTimeRange(timeStr)` → {start, end} \| null | Parses `[1PM-3PM]` format to 24-hour numbers. Returns null for invalid format. |
| `validateTimeBlockOverlap` | `validateTimeBlockOverlap(newBlock, existingBlocks, excludeId?)` → {valid, error} | Checks if new block overlaps with existing blocks. Returns `{valid: false, error: string}` if overlap detected. |
| `isValidUrl` | `isValidUrl(string)` → boolean | Uses `new URL()` constructor for validation. |
| `getOrCreateToastContainer` | `getOrCreateToastContainer(documentContext)` → HTMLElement | Creates or returns existing `#toast-container` element for toast notifications. |
| `showInfoMessage` | `showInfoMessage(message, type, duration, documentContext)` | Creates corner toast notification. Supports 'success', 'error', 'info' types. Default duration is 5 seconds. Toast auto-dismisses and supports manual close button. |
| `withTaskLock` | `withTaskLock(asyncFn)` → Promise | Queues async operations sequentially to prevent race conditions. |
| `debounce` | `debounce(fn, delay)` → Function | Generic debounce utility. Used for auto-save (1500ms) and sync. |
| `setupStorageSync` | `setupStorageSync(renderCallback)` | Listens to `chrome.storage.onChanged`. Ignores self-triggered changes within 500ms of last save. |

## Key Features Implementation

### Priority System
- CRITICAL > IMPORTANT > SOMEDAY (sort order: 1, 2, 3)
- CRITICAL tasks require a deadline; validation enforced on both add and edit forms
- Display shows days remaining/overdue for CRITICAL tasks

### Categories and Energy Levels
- Type: `home` or `work` — filtered in LOCATION tab
- Energy: `low` or `high` — visual indicator via CSS classes `energy-low-incomplete` / `energy-high-incomplete`

### Weekly Scheduling
- Tasks have a `schedule` array of `{ day, blockId, completed }` items
- Planner grid: 7 days (rotated to start from today) x 11 time blocks
- Drag-and-drop from Unassigned sidebar onto grid cells
- Slot limits enforced: blocks with `limit: '0'` reject drops, `limit: '1'` allows one task
- `generateDayHeaders()` rotates `DAYS` array so today is first column
- `highlightCurrentDay()` adds `.current-day` class to today's column

### Cascade Completion
- `updateTaskCompletion(task)` in `task_utils.js`: if all `schedule[].completed === true`, sets `task.completed = true`
- Called automatically by `updateTask()` before every save

### Auto-Save (manager.js inline edit)
- When inline edit form opens, `debounce(autoSave, 1500)` is attached to all form `input`/`change` events
- Save status indicator: `.save-status` element with states: `saving` ("Saving..."), `saved` ("Saved", clears after 2s), `unsaved` (on new changes)
- Manual "Save" button still available for immediate save

### Cross-Tab Sync
- `setupStorageSync(renderCallback)` in `task_utils.js`
- Uses `chrome.storage.onChanged` listener
- `_lastSaveTimestamp` is set to `Date.now()` on every `saveTasks` call (via monkey-patched wrapper)
- Listener ignores changes within 500ms of last save to prevent self-triggered re-renders

### Import/Export Modal (settings.js)
The import/export modal is organized into 4 tabs for different import/export methods:
- **JSON Tab:** Export all tasks to JSON file, import from JSON with merge logic (matching IDs updated, new IDs appended)
- **CSV Tab:** Import tasks from CSV files with format requirements displayed (required: title; optional: priority, type, energy, url, deadline, notes, recurrence)
- **Google Sheets Tab:** Import from published Google Sheets (publish as CSV format), preview before importing
- **Notion Tab:** Bidirectional sync with Notion databases via column mapping UI, supports Sync Now and Import New Only modes

Tab switching is handled by `setupImportExportTabs()` in settings.js. Uses `.import-export-tabs` container with `data-ie-tab` attributes and `.ie-panel` content panels.

### Drag and Drop
- **Popup (Display tab):** Reorder within same priority group. Updates `displayOrder` values.
- **Manager (SCHEDULE tab):** Drag from Unassigned sidebar onto grid cells. Creates schedule entries. Drag from Assigned sidebar to grid. Drag from grid cell to unassign.

### Operation Queue
- `withTaskLock(asyncFn)` in `task_utils.js` chains async operations on a shared promise
- Used in popup.js completion handlers to prevent data corruption from rapid clicks

### Time Block Configuration
- Time blocks are configurable via the Time Blocks modal (accessible from SCHEDULE tab)
- Inline label editing: click on any block label to rename it directly in the table
- Overlap detection: `validateTimeBlockOverlap()` prevents creating blocks with overlapping time ranges
- `parseTimeRange()` converts `[1PM-3PM]` format to 24-hour numbers for comparison
- `formatTimeInput()` converts 24-hour time input (e.g., "13:00") to display format (e.g., "1PM")

### Help Modal FAQ
- Help modal has 8 tabs: Overview, Quick Start, Schedule, Priority, Location, Settings, Import/Export, FAQ
- FAQ section addresses common user questions about task scheduling, completion, and recurring tasks
- Uses `.faq-item`, `.faq-question`, `.faq-answer` CSS classes for consistent styling

### Completed Tasks Disclosure (Priority & Location tabs)
- Completed tasks are displayed in collapsible disclosure sections (`<details>`) instead of checkbox toggles
- Each priority column (Critical, Important, Someday) and location column (Home, Work) has its own disclosure
- Disclosure shows count badge (`.completed-count`) with number of completed tasks
- Disclosure is hidden (`.hidden` class) when no completed tasks exist
- Uses native HTML `<details>`/`<summary>` elements with custom styling for disclosure triangle
- Search filter applies to both active and completed task lists

### Archive Tab
- Displays all completed tasks grouped by completion date (Today, Yesterday, This Week, Older)
- Within each date group, tasks are sorted by `lastModified` timestamp (latest first)
- Search bar filters tasks by title (50% wider than other search bars for better usability)
- Restore button returns completed tasks to active state
- "Clear All Completed" button permanently deletes all completed tasks

### Schedule Tab Enhancements (v1.4.0)

#### Parking Lot Sidebar
- Left sidebar renamed from "Unassigned Tasks" to "Parking Lot"
- Collapsible via toggle button with `◀` icon
- Collapse state persisted in `localStorage` (`parkingLotCollapsed` key)
- Task count badge shows number of unscheduled tasks
- CSS: `.collapsible-sidebar`, `.collapsed`, `.sidebar-header`, `.sidebar-collapse-toggle`, `.task-count-badge`
- JS: `setupCollapsibleSidebar()`, `updateUnassignedCount(count)`

#### Drag Guide Lines
- Visual row/column guides when dragging tasks over the grid
- Blue dashed lines highlight the target time block row and day column
- Valid drop zones show blue glow (`.snap-target`)
- Invalid drop zones (blocked or full slots) show red indicator (`.drop-invalid`)
- Enhanced during `dragover` in `setupDragAndDropListeners()`
- CSS: `.drag-guide-row`, `.drag-guide-column`, `.snap-target`, `.drop-invalid`
- JS: `showDragGuides(cell)`, `clearDragGuides()`, `showSnapIndicator(cell, isValid)`

#### Progressive Disclosure (Hover Popover)
- Hover over grid tasks for 400ms to show detailed popover
- Displays: title, priority indicator, type, energy, deadline, notes, URL, schedule items
- Smart positioning to avoid viewport edges
- Hidden during drag operations
- CSS: `.task-hover-popover`, `.popover-header`, `.popover-meta`, `.popover-tag`, `.popover-notes`, `.popover-link`, `.popover-schedule-list`
- JS: `createHoverPopover()`, `showTaskPopover(element, taskId)`, `positionPopover()`, `hideTaskPopover()`, `setupHoverPopover()`, `escapeHtml()`, `truncateUrl()`, `formatPopoverDeadline()`
- Constant: `HOVER_DELAY = 400` ms

#### Current Time Indicator
- Red horizontal line shows current time position on today's column
- Line includes time label (e.g., "2:30 PM")
- Past time blocks appear dimmed (opacity 0.5)
- Current time block has subtle red border highlight
- Updates every 60 seconds
- Uses `parseTimeRange()` from task_utils.js to calculate position within block
- CSS: `.current-time-indicator`, `.past-block`, `.current-block`, `@keyframes current-block-pulse`
- JS: `getCurrentTimeBlockInfo()`, `formatCurrentTime(hours, minutes)`, `updateCurrentTimeIndicator()`, `startTimeIndicatorUpdates()`, `stopTimeIndicatorUpdates()`
- Variable: `timeIndicatorInterval` (setInterval ID)

### Schedule Tab Enhancements (v1.5.0)

#### Context Menu (Right-Click)
- Right-click any task on the schedule grid for quick actions
- Menu items: Duplicate, Color Code (with color picker submenu), Split Task, View Details
- CSS: `.task-context-menu`, `.context-menu-item`, `.color-submenu`, `.color-option`
- JS: `createContextMenu()`, `showContextMenu()`, `hideContextMenu()`, `handleContextMenuAction()`, `handleDuplicateTask()`, `handleSetColorCode()`, `handleSplitTask()`, `setupContextMenuListeners()`

#### Task Details Modal
- Double-click tasks in Parking Lot or Assigned sidebar to open details modal
- Displays: title, priority, type, energy, deadline, recurrence, notes, URL, schedule
- Edit and Delete buttons
- HTML: `#task-details-modal`
- JS: `openTaskDetailsModal()`, `closeTaskDetailsModal()`, `populateTaskDetailsModal()`, `setupTaskDetailsModalListeners()`

#### Magic Fill
- One-click auto-fill empty time blocks with quick tasks (Check email, Stretch, etc.)
- Works on today's schedule only
- Uses `gapFillerTasks` from settings (configurable)
- JS: `getTodayName()`, `findScheduleGaps()`, `magicFillGaps()`, `setupMagicFillButton()`

#### Buffer Zones
- Visual "5m buffer" indicator between back-to-back scheduled tasks
- Helps prevent cognitive overload with transition reminders
- CSS: `.has-buffer-zone::after`
- JS: `renderBufferZones()`

#### Focus Mode
- Toggle button hides all time blocks except current one
- Reduces visual clutter for focused work
- CSS: `.focus-mode`, `.focus-hidden`, `.focus-current`, `.focus-mode-active`
- JS: `toggleFocusMode()`, `highlightCurrentBlockOnly()`, `showAllBlocks()`, `setupFocusModeButton()`
- Variable: `focusModeActive`

#### Fluid Resizing
- Drag bottom edge of grid tasks to extend into subsequent blocks
- Automatically pushes conflicting tasks to next available slot
- CSS: `.task-resize-handle`, `.resize-preview`
- JS: `addResizeHandle()`, `setupResizeListeners()`, `handleResize()`, `finishResize()`, `extendTaskAcrossBlocks()`, `pushTaskDown()`
- Variables: `isResizing`, `resizeStartY`, `resizeTaskId`, `resizeCell`, `resizePreview`

#### Actual vs Planned Time Tracking
- Per-task opt-in time tracking via clock button on grid tasks
- Records actual start/end times in schedule items
- Calculates deviation from planned time
- CSS: `.tracking-btn`, `.tracking-btn.active`, `.tracking-btn.completed`
- JS: `startTaskTracking()`, `stopTaskTracking()`, `calculateTimeDeviation()`, `renderTrackingButton()`, `setupTrackingListeners()`

#### Color Coding
- Custom color indicator on tasks (red, blue, green, purple, orange)
- Applied via context menu color picker
- Stored in `task.colorCode`
- CSS: `.task-item[data-color-code="red"]` etc.

### Version 1.6.0 Changes

#### Toast Notifications
- Info messages now appear as corner toasts (bottom-right corner)
- Toast container created dynamically via `getOrCreateToastContainer()`
- Default duration: 5 seconds (changed from 3 seconds)
- Support for multiple simultaneous toasts (stacked)
- Each toast has close button for manual dismissal
- Type-specific icons: ✓ (success), ✕ (error), ℹ (info)
- Smooth slide-in/slide-out animations
- CSS: `#toast-container`, `.toast`, `.toast-icon`, `.toast-message`, `.toast-close`, `.toast.visible`, `.toast.hiding`
- JS: `getOrCreateToastContainer()`, `showInfoMessage()` (updated)

#### Settings Auto-Save
- Settings now auto-save immediately when changed (no save button required)
- Theme, font family, and font size changes trigger immediate save
- Visual feedback via toast notification: "Settings saved!"
- Removed: `#save-settings-btn` button from settings modal

#### Removed: Habits Feature
- Habits modal and button removed from SCHEDULE tab
- Removed: `#habits-btn`, `#habits-modal`, `#create-habit-form`
- Removed: `getHabits()`, `saveHabits()`, `DEFAULT_HABITS`, `setupHabitsListeners()`
- Removed: Related CSS styles (`.habits-*`, `.habit-*`, `.create-habit-form`)

## CSS Architecture

### Custom Properties
Defined in `:root` in `popup.css`:

```css
--bg-primary, --shadow-dark, --shadow-light          /* Neumorphic base */
--text-primary, --text-secondary, --text-muted        /* Typography */
--accent-blue                                         /* Interactive elements */
--priority-critical, --priority-important, --priority-someday  /* Priority colors */
--success-bg/text/border, --error-bg/text/border, --info-bg/text/border  /* Messages */
--border-radius-sm/md/lg                              /* Consistent radii */
--transition-speed                                    /* Animation timing */
--focus-ring                                          /* Accessibility focus */
```

### Key CSS Classes
- `priority-CRITICAL`, `priority-IMPORTANT`, `priority-SOMEDAY` — Priority-based styling
- `energy-low-incomplete`, `energy-high-incomplete` — Energy level indicators
- `task-completed` — Strikethrough + opacity for completed tasks
- `block-color-*` — Time block color coding (sakura, yellow, purple, sage, skyblue, orange)
- `neumorphic-btn`, `neumorphic-input`, `neumorphic-inset-card` — Design system components
- `save-status`, `.saving`, `.saved`, `.unsaved` — Auto-save indicator states
- `import-export-tabs`, `.ie-panel`, `.ie-section-title`, `.ie-action-card` — Import/export modal tabbed interface
- `completed-disclosure`, `.completed-disclosure-summary`, `.completed-count`, `.completed-tasks-list` — Completed tasks accordion

## Accessibility

The codebase uses the following ARIA patterns:

- `role="tablist"` on tab containers, `role="tab"` on tab buttons with `aria-selected`
- `role="tabpanel"` on tab content with `aria-labelledby` and `aria-controls`
- Toast notifications use `aria-label` on close buttons for screen reader accessibility
- `aria-required="true"` on title inputs
- `aria-label` on icon-only buttons (e.g., PLANNER button, Unassign All)
- `:focus-visible` outlines on interactive elements via `--focus-ring` variable

## Development Commands

### Loading Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. After changes, click the refresh icon on the extension card

### Testing
```bash
cd tests             # All test infrastructure is in tests/
npm install          # Install Jest + jsdom
npm test             # Run all ~436 tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

### Debugging
- Right-click extension icon → "Inspect popup" for popup DevTools
- Open manager page and use regular DevTools (F12) for manager debugging
- Check `chrome://extensions/` for error details

## Test Architecture

### Framework
Jest 29 with `jsdom` environment. No build step; tests run directly on source files.

### loadScript Helper
Browser scripts use global declarations that don't leak into Jest's module scope. The `loadScript` helper in `tests/mocks/chrome.storage.mock.js` solves this:

1. Reads the script file
2. Optionally strips `DOMContentLoaded` wrapper (via brace-counting) and converts it to `__initFn__()`
3. Appends `Object.assign(globalThis, { exportedSymbol1, exportedSymbol2, ... })`
4. Executes via `new Function(code)()`

This makes all listed symbols available as globals in the test scope.

### Chrome API Mock
`tests/mocks/chrome.storage.mock.js` provides:
- `chrome.storage.local.get/set` — In-memory key-value store with Jest mock functions
- `chrome.storage.onChanged.addListener` — Collects listeners, notifies on `set()`
- `chrome.runtime.lastError` — Settable for error path testing
- `chrome.runtime.getURL` / `chrome.tabs.create` — Basic stubs
- `global.fetch` — Jest mock stub for Notion/Sheets import tests
- `resetChromeStorage()` — Clears store, mocks, and fetch mock between tests
- `seedTasks(tasks)` — Seeds storage with task data for test setup
- `seedSettings(settings)` — Seeds storage with settings data
- `seedTimeBlocks(timeBlocks)` — Seeds storage with time block data

The `loadScript` regex also handles `async function` DOMContentLoaded handlers (needed because manager.js and popup.js DOMContentLoaded handlers are now `async`).

### Test Suites (~420 total)
- **task_utils.test.js (~95):** Task class (new fields including lastModified, colorCode), getTasks backfill, CRUD, settings CRUD, time blocks, undo/redo stacks, createRecurringInstance, seedSampleTasks, toast notifications (showInfoMessage), validateTask, debounce, withTaskLock, parseTimeRange, validateTimeBlockOverlap
- **popup.test.js (~17):** createTaskItem (notes, recurrence), renderTasks, renderAllTabs, tab switching, add-task validation, open-manager button
- **manager.test.js (~122):** generateDayHeaders/generatePlannerGrid (now async), createTaskElement (notes/recurrence badges), renderSidebarLists, renderPriorityLists, renderHomeWorkLists, renderArchiveTab (with lastModified sorting), renderStatsTab, applySearchFilter, setupTabSwitching, renderPage, highlightCurrentDay, setupAddTaskModalListeners, header tooltips, FAQ tab, completed tasks disclosure, collapsible parking lot, drag guide lines, hover popover, current time indicator
- **integration.test.js (~25):** Task lifecycle, schedule management, cascade completion, ordering, import/merge, validation, cross-tab sync, recurring tasks (auto-instance creation), undo/redo lifecycle
- **settings.test.js (~35):** applySettings (theme, font-family, font-size CSS vars), initSettings (first-run seeding), populateSettingsForm, openSettingsModal/closeSettingsModal, FONT_FAMILY_MAP/FONT_SIZE_MAP constants, formatTimeInput, updateTimeBlockLabel, addTimeBlock overlap validation, renderTimeBlocksTable, settings auto-save
- **features.test.js (~35):** Notes field (CRUD, backfill), completedAt (set on complete, clear on uncomplete, backfill), lastModified field (auto-set, update on modify, backfill), undo/redo cycle, createRecurringInstance (daily/weekly/monthly deadline shift, fresh lastModified), recurring auto-instance via updateTask, archive date grouping
- **search.test.js (~17):** applySearchFilter (hide non-matching, show all for empty query, case insensitive, multi-container, partial match, grid cell filtering), setupScheduleSearch, setupPrioritySearch, setupLocationSearch, setupArchiveSearch
- **schedule-features.test.js (~91):** v1.5.0 schedule enhancements: context menu (creation, actions, visibility), task actions (duplicate, color code, split), magic fill (gap detection, today only), buffer zones (back-to-back detection), focus mode (toggle, highlight current), fluid resizing (handle creation, span blocks), time tracking (start/stop, deviation calculation), task details modal (open/close, populate)

### Known Limitation
Coverage reporting via `jest --coverage` shows 0% because `new Function()` execution bypasses Istanbul's code instrumentation. Tests still validate behavior correctly.

## Code Patterns

### Event Handling
- Event delegation on container elements for dynamically rendered task lists
- `withTaskLock(async () => { ... })` wraps all state-mutating event handlers

### Storage Operations
- Callback-based: `getTasks(callback)`, `saveTasks(tasks, callback)`
- Promise-based: `getTasksAsync()`, `saveTasksAsync(tasks)`
- Both patterns used; prefer `getTasksAsync`/`saveTasksAsync` in new code

### DOM Rendering
- Task elements created programmatically via `document.createElement`
- `renderPage()` in manager.js and `renderAllTabs()` in popup.js are the top-level render functions
- Both clear and rebuild DOM on each render cycle

### Data Flow
- No state management library — data flows directly from Chrome storage through render functions
- Every mutation (complete, edit, reorder, delete) immediately persists to storage
- Cross-tab sync re-renders on external storage changes

## Important Notes

- **Chrome Storage:** `chrome.storage.local` — no external dependencies, no backend. Keys: `tasks`, `settings`, `timeBlocks`
- **Permissions:** `storage` (data persistence), `tabs` (open manager page), `host_permissions` for `https://api.notion.com/*`
- **Cross-Page Sync:** Popup and manager stay in sync via `chrome.storage.onChanged` listener with 500ms self-change guard
- **Task IDs:** Format `task_{timestamp}_{random9chars}` for uniqueness
- **Backfill/Migration:** `getTasks()` auto-adds missing `displayOrder`, `schedule`, `schedule[].completed`, `energy`, `notes`, `completedAt`, `recurrence`, and `lastModified` fields on read
- **Script Load Order:** `task_utils.js` → `settings.js` → `manager.js` / `popup.js`. Both HTML files must follow this order.
- **Async DOMContentLoaded:** Both `manager.js` and `popup.js` DOMContentLoaded handlers are `async`. The `loadScript` helper in tests handles both `function` and `async function` variants.
- **Undo/Redo Stacks:** `_undoStack` and `_redoStack` are module-level variables in `task_utils.js`. They persist between tests in the same test file since `loadScript` runs once at the top of non-beforeEach files. Ensure tests that depend on an empty redo stack call `pushUndoState()` first (which clears `_redoStack`).
- **Recurring Task Auto-Instance:** Created inside `updateTask()` within the same `getTasks` callback before `saveTasks()` is called — avoids double-read race condition.
- **Dark Mode:** Applied via `data-theme` attribute on `<html>` element. CSS uses `:root[data-theme="dark"]` selector. `initSettings()` must be `await`-ed before any render.
- **No Build Process:** Load directly as unpacked extension; vanilla JS with no transpilation
- **Test Coverage Limitation:** `new Function()` bypasses Istanbul instrumentation; behavioral coverage is validated through ~280 passing tests
