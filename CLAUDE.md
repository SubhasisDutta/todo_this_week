# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Weekly Task Manager** — a Chrome/Chromium browser extension (Manifest V3) for managing tasks with priority levels (Critical, Important, Someday), categories (Home, Work), energy levels (Low, High), and a visual weekly planner grid with 11 time blocks. The extension provides a compact popup interface and a full-page planner view, both kept in sync via `chrome.storage.onChanged`. Data is persisted using `chrome.storage.local` with no external runtime dependencies.

## Architecture

### Core Components

- `task_utils.js` (~292 lines) — Shared utilities: Task class, CRUD operations, validation, debounce, operation queue, cross-tab sync
- `popup.js` (~365 lines) — Popup interface: task rendering, tab switching, completion handlers, drag-and-drop reordering
- `manager.js` (~1034 lines) — Full-page planner: weekly grid, drag-and-drop scheduling, inline editing with auto-save, import/export
- `popup.html` (~89 lines) — Popup markup (3 tabs: TODAY, Display, ADD)
- `manager.html` (~143 lines) — Planner markup (3 tabs: SCHEDULE, PRIORITY, LOCATION)
- `popup.css` (~1095 lines) — Unified neumorphic styles for both popup and manager

### Extension Configuration

- `manifest.json` — Manifest V3 with `storage` and `tabs` permissions
- `images/` — Extension icons (16px, 48px, 128px)

### Test Infrastructure

- `package.json` — Dev dependencies (Jest 29, jest-environment-jsdom)
- `jest.config.js` — jsdom environment, collects coverage from source files
- `tests/mocks/chrome.storage.mock.js` — Chrome API mocks and `loadScript` helper
- `tests/task_utils.test.js` — 44 tests for task_utils.js
- `tests/popup.test.js` — 17 tests for popup.js
- `tests/manager.test.js` — 41 tests for manager.js
- `tests/integration.test.js` — 12 end-to-end tests

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
  energy: string           // 'low' | 'high'
}
```

### Schedule Item

Each entry in the `schedule` array represents a task assignment to a specific day and time block:

```javascript
{
  day: string,       // 'sunday' | 'monday' | ... | 'saturday'
  blockId: string,   // TIME_BLOCKS id (e.g., 'deep-work-1', 'ai-study')
  completed: boolean // Individual assignment completion
}
```

### TIME_BLOCKS Constant

Defined in `task_utils.js`. Each block has: `id`, `label`, `time`, `limit` ('0', '1', or 'multiple'), `colorClass`.

| id | label | time | limit |
|----|-------|------|-------|
| `late-night-read` | Late Night Read | [12AM-1AM] | multiple |
| `sleep` | Sleep | [1AM-7AM] | 0 |
| `ai-study` | AI study time | [7AM-8AM] | 1 |
| `morning-prep` | Morning Prep | [8AM-9AM] | 0 |
| `engagement` | Engagement Block | [9AM-12PM] | multiple |
| `lunch` | Lunch Break | [12PM-1PM] | 0 |
| `deep-work-1` | Deep Work Block 1 | [1PM-3PM] | 1 |
| `deep-work-2` | Deep Work Block 2 | [3PM-6PM] | 1 |
| `commute-relax` | Commute and Relax | [6PM-8PM] | multiple |
| `family-time` | Family Time Block | [8PM-10PM] | multiple |
| `night-build` | Night Build Block | [10PM-11PM] | 1 |

## Key Functions (task_utils.js)

| Function | Signature | Description |
|----------|-----------|-------------|
| `Task` | `new Task(id, title, url, priority, completed, deadline, type, displayOrder, schedule, energy)` | Constructor with defaults. Auto-generates ID if null. |
| `getTasks` | `getTasks(callback)` | Reads tasks from storage. Backfills missing `displayOrder`, `schedule`, `schedule[].completed`, and `energy` fields. |
| `getTasksAsync` | `getTasksAsync()` → Promise | Promise wrapper for `getTasks`. |
| `saveTasks` | `saveTasks(tasks, callback)` | Serializes to plain objects via `JSON.parse(JSON.stringify())` and saves. Updates `_lastSaveTimestamp` for sync guard. |
| `saveTasksAsync` | `saveTasksAsync(tasks)` → Promise | Promise wrapper for `saveTasks`. Rejects on failure. |
| `addNewTask` | `addNewTask(title, url, priority, deadline, type, energy)` → Promise | Creates a task with computed `displayOrder` (max in priority group + 1). |
| `getTaskById` | `getTaskById(taskId)` → Promise | Returns single task or `undefined`. |
| `updateTask` | `updateTask(updatedTask)` → Promise | Finds task by ID, calls `updateTaskCompletion`, saves. Returns boolean. |
| `updateTaskCompletion` | `updateTaskCompletion(task)` | If task has schedule items, sets `task.completed = true` when all items are completed. |
| `deleteTask` | `deleteTask(taskId)` → Promise | Removes by ID. Returns boolean. |
| `validateTask` | `validateTask(task)` → string[] | Returns array of error messages. Checks: title required, CRITICAL needs deadline, URL format. |
| `isValidUrl` | `isValidUrl(string)` → boolean | Uses `new URL()` constructor for validation. |
| `showInfoMessage` | `showInfoMessage(message, type, duration, documentContext)` | Displays toast notification in `#info-message-area`. Falls back to `alert()`. Timeout stored on element (`messageArea._infoTimeout`). |
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

### Import/Export (manager.js)
- **Export:** Downloads `tasks-{ISO-timestamp}.json` file
- **Import:** File input accepts `.json`, merges with existing tasks:
  - Tasks with matching IDs: updates the existing task
  - Tasks with new IDs: appends to task list

### Drag and Drop
- **Popup (Display tab):** Reorder within same priority group. Updates `displayOrder` values.
- **Manager (SCHEDULE tab):** Drag from Unassigned sidebar onto grid cells. Creates schedule entries. Drag from Assigned sidebar to grid. Drag from grid cell to unassign.

### Operation Queue
- `withTaskLock(asyncFn)` in `task_utils.js` chains async operations on a shared promise
- Used in popup.js completion handlers to prevent data corruption from rapid clicks

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

## Accessibility

The codebase uses the following ARIA patterns:

- `role="tablist"` on tab containers, `role="tab"` on tab buttons with `aria-selected`
- `role="tabpanel"` on tab content with `aria-labelledby` and `aria-controls`
- `role="status"` and `aria-live="polite"` on `#info-message-area` for toast notifications
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
npm install          # Install Jest + jsdom
npm test             # Run all 114 tests
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
- `resetChromeStorage()` — Clears store and mocks between tests
- `seedTasks(tasks)` — Seeds storage with task data for test setup

### Test Suites (114 total)
- **task_utils.test.js (44):** Task class, getTasks, saveTasks, addNewTask, getTaskById, updateTask, updateTaskCompletion, deleteTask, showInfoMessage, validateTask, isValidUrl, getTasksAsync, saveTasksAsync, debounce, withTaskLock
- **popup.test.js (17):** createTaskItem, renderTasks, renderAllTabs, tab switching, add-task validation, open-manager button
- **manager.test.js (41):** generateDayHeaders, generatePlannerGrid, createTaskElement, renderSidebarLists, renderTasksOnGrid, renderPriorityLists, renderHomeWorkLists, setupTabSwitching, renderPage, highlightCurrentDay
- **integration.test.js (12):** Task lifecycle (add/retrieve/update/delete), schedule management, cascade completion, ordering, import/merge, validation, cross-tab sync

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

- **Chrome Storage:** `chrome.storage.local` — no external dependencies, no backend
- **Permissions:** `storage` (data persistence) and `tabs` (open manager page)
- **Cross-Page Sync:** Popup and manager stay in sync via `chrome.storage.onChanged` listener with 500ms self-change guard
- **Task IDs:** Format `task_{timestamp}_{random9chars}` for uniqueness
- **Backfill/Migration:** `getTasks()` auto-adds missing `displayOrder`, `schedule`, `schedule[].completed`, and `energy` fields on read
- **No Build Process:** Load directly as unpacked extension; vanilla JS with no transpilation
- **Test Coverage Limitation:** `new Function()` bypasses Istanbul instrumentation; behavioral coverage is validated through 114 passing tests
