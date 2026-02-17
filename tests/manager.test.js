// tests/manager.test.js
require('./mocks/chrome.storage.mock');
const path = require('path');

// Load task_utils first (dependency)
loadScript(path.join(__dirname, '..', 'task_utils.js'), [
    'DEFAULT_TIME_BLOCKS', 'TIME_BLOCKS', 'DEFAULT_SETTINGS',
    'Task', 'getTasks', 'saveTasks', 'addNewTask', 'getTaskById',
    'updateTaskCompletion', 'updateTask', 'deleteTask', 'showInfoMessage',
    'getTasksAsync', 'saveTasksAsync', 'withTaskLock', 'validateTask', 'isValidUrl',
    'debounce', 'setupStorageSync', '_lastSaveTimestamp',
    'getSettings', 'saveSettings', 'seedSampleTasks',
    'getTimeBlocks', 'saveTimeBlocks',
    'pushUndoState', 'undo', 'redo',
    'createRecurringInstance'
]);

// Load settings.js (dependency of manager.js)
loadScript(path.join(__dirname, '..', 'settings.js'), [
    'initSettings', 'applySettings',
    'openSettingsModal', 'closeSettingsModal',
    'setupSettingsModalListeners'
]);

// Setup manager HTML before loading manager.js
function setupManagerDOM() {
    document.body.innerHTML = `
        <div class="container manager-container">
            <div class="manager-header">
                <h1>Weekly Task Planner</h1>
                <div class="manager-header-actions">
                    <button id="help-btn" class="neumorphic-btn icon-btn" aria-label="Help">?</button>
                    <button id="settings-btn" class="neumorphic-btn icon-btn" aria-label="Settings">⚙️</button>
                </div>
            </div>
            <div id="info-message-area" class="info-message" style="display: none;" role="status" aria-live="polite"></div>

            <div class="tabs" role="tablist">
                <button class="tab-link active" data-tab="weekly-schedule" role="tab" aria-selected="true">SCHEDULE</button>
                <button class="tab-link" data-tab="task-lists" role="tab" aria-selected="false">PRIORITY</button>
                <button class="tab-link" data-tab="all-tasks" role="tab" aria-selected="false">LOCATION</button>
                <button class="tab-link" data-tab="archive-tab" role="tab" aria-selected="false">ARCHIVE</button>
                <button class="tab-link" data-tab="stats-tab" role="tab" aria-selected="false">STATS</button>
            </div>

            <div class="main-content">
                <div id="weekly-schedule" class="tab-content active" role="tabpanel">
                    <div class="planner-container">
                        <div class="tasks-column" id="unassigned-tasks-container">
                            <h3>Unassigned Tasks</h3>
                            <div id="unassigned-tasks-list" class="task-list neumorphic-inset-card"></div>
                        </div>
                        <div class="planner-grid-container">
                            <div id="planner-grid"></div>
                        </div>
                        <div class="tasks-column" id="assigned-tasks-container">
                            <h3>Assigned Tasks</h3>
                            <button id="unassign-all-btn" class="neumorphic-btn">Unassign All</button>
                            <div id="assigned-tasks-list" class="task-list neumorphic-inset-card"></div>
                        </div>
                    </div>
                </div>

                <div id="task-lists" class="tab-content" role="tabpanel">
                    <div class="search-bar-container">
                        <input type="search" id="priority-search-input" class="neumorphic-input" placeholder="Search tasks...">
                        <button id="priority-search-clear" class="neumorphic-btn">Clear</button>
                    </div>
                    <div class="add-task-form">
                        <input type="text" id="manager-task-title" class="neumorphic-input" placeholder="Enter task title" aria-required="true">
                        <input type="url" id="manager-task-url" class="neumorphic-input" placeholder="Enter URL">
                        <input type="radio" id="manager-priority-someday" name="manager-priority" value="SOMEDAY" checked>
                        <input type="radio" id="manager-priority-important" name="manager-priority" value="IMPORTANT">
                        <input type="radio" id="manager-priority-critical" name="manager-priority" value="CRITICAL">
                        <div id="manager-task-deadline-group" style="display: none;">
                            <input type="date" id="manager-task-deadline" class="neumorphic-input">
                        </div>
                        <input type="radio" id="manager-type-home" name="manager-type" value="home" checked>
                        <input type="radio" id="manager-type-work" name="manager-type" value="work">
                        <input type="radio" id="manager-energy-low" name="manager-energy" value="low" checked>
                        <input type="radio" id="manager-energy-high" name="manager-energy" value="high">
                        <select id="manager-task-recurrence" class="neumorphic-select">
                            <option value="">None</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                        <textarea id="manager-task-notes" class="neumorphic-input" rows="2"></textarea>
                        <button id="manager-add-task-btn" class="neumorphic-btn">Add Task</button>
                    </div>
                    <div class="tasks-display-area">
                        <div class="priority-column">
                            <h3>Critical</h3>
                            <div id="critical-tasks-list" class="task-list neumorphic-inset-card"></div>
                        </div>
                        <div class="priority-column">
                            <h3>Important</h3>
                            <div id="important-tasks-list" class="task-list neumorphic-inset-card"></div>
                        </div>
                        <div class="priority-column">
                            <h3>Someday</h3>
                            <div id="someday-tasks-list" class="task-list neumorphic-inset-card"></div>
                        </div>
                    </div>
                </div>

                <div id="all-tasks" class="tab-content" role="tabpanel">
                    <div class="search-bar-container">
                        <input type="search" id="location-search-input" class="neumorphic-input" placeholder="Search tasks...">
                        <button id="location-search-clear" class="neumorphic-btn">Clear</button>
                    </div>
                    <div class="tasks-display-area">
                        <div class="priority-column">
                            <h3>Home</h3>
                            <div id="home-tasks-list" class="task-list neumorphic-inset-card"></div>
                        </div>
                        <div class="priority-column">
                            <h3>Work</h3>
                            <div id="work-tasks-list" class="task-list neumorphic-inset-card"></div>
                        </div>
                    </div>
                </div>

                <div id="archive-tab" class="tab-content" role="tabpanel">
                    <div class="archive-header">
                        <h2>Completed Tasks Archive</h2>
                        <button id="clear-archive-btn" class="neumorphic-btn">Clear All Completed</button>
                    </div>
                    <div id="archive-list"></div>
                </div>

                <div id="stats-tab" class="tab-content" role="tabpanel">
                    <div id="stats-content"></div>
                </div>
            </div>

            <!-- Settings Modal -->
            <div id="settings-modal" class="modal-overlay" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="settings-title">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="settings-title">Settings</h2>
                        <button id="settings-close-btn" class="neumorphic-btn icon-btn" aria-label="Close settings">✕</button>
                    </div>
                    <div class="settings-section">
                        <h3>Appearance</h3>
                        <label>
                            <span>Dark Mode</span>
                            <label class="toggle-switch">
                                <input type="checkbox" id="theme-toggle">
                                <span class="toggle-slider"></span>
                            </label>
                        </label>
                        <div class="form-group">
                            <label for="font-family-select">Font:</label>
                            <select id="font-family-select" class="neumorphic-select">
                                <option value="system">System Default</option>
                                <option value="inter">Inter</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="font-size-select">Font Size:</label>
                            <select id="font-size-select" class="neumorphic-select">
                                <option value="small">Small</option>
                                <option value="medium" selected>Medium</option>
                                <option value="large">Large</option>
                            </select>
                        </div>
                    </div>
                    <div class="settings-section">
                        <h3>Import / Export</h3>
                        <button id="export-tasks-btn" class="neumorphic-btn">Export Tasks</button>
                        <button id="import-tasks-btn" class="neumorphic-btn">Import Tasks</button>
                        <input type="file" id="import-file-input" style="display: none;" accept=".json">
                    </div>
                    <div class="settings-section">
                        <h3>Notion Import</h3>
                        <input type="text" id="notion-api-key" class="neumorphic-input" placeholder="Notion API Key">
                        <input type="text" id="notion-database-id" class="neumorphic-input" placeholder="Notion Database ID">
                        <button id="notion-fetch-btn" class="neumorphic-btn">Fetch Pages</button>
                        <div id="notion-pages-list"></div>
                        <button id="notion-import-btn" class="neumorphic-btn" style="display:none;">Import Selected</button>
                    </div>
                    <div class="settings-section">
                        <h3>Google Sheets Import</h3>
                        <input type="url" id="sheets-url" class="neumorphic-input" placeholder="Published CSV URL">
                        <button id="sheets-fetch-btn" class="neumorphic-btn">Preview</button>
                        <div id="sheets-preview"></div>
                        <button id="sheets-import-btn" class="neumorphic-btn" style="display:none;">Import</button>
                    </div>
                    <div class="settings-section">
                        <h3>Time Blocks</h3>
                        <div id="time-blocks-table"></div>
                        <button id="reset-time-blocks-btn" class="neumorphic-btn">Reset to Defaults</button>
                    </div>
                    <button id="save-settings-btn" class="neumorphic-btn">Save Settings</button>
                </div>
            </div>

            <!-- Help Modal -->
            <div id="help-modal" class="modal-overlay" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="help-title">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="help-title">Help</h2>
                        <button id="help-close-btn" class="neumorphic-btn icon-btn" aria-label="Close help">✕</button>
                    </div>
                    <div class="help-tabs">
                        <button class="help-tab-link active" data-help-tab="help-overview">Overview</button>
                    </div>
                    <div id="help-overview" class="help-panel active"><p>Welcome!</p></div>
                </div>
            </div>

            <!-- Undo Toast -->
            <div id="undo-toast" style="display: none;">
                <span id="undo-toast-message"></span>
                <button id="undo-toast-btn" class="undo-link">Undo</button>
            </div>
        </div>
    `;
}

// Mock confirm
global.confirm = jest.fn(() => true);

// Manager exports list
const MANAGER_EXPORTS = [
    'DAYS', 'currentDays', 'renderPage', 'generateDayHeaders', 'generatePlannerGrid',
    'setupSettingsListeners', 'setupHelpListeners', 'highlightCurrentDay',
    'setupSchedulingListeners', 'setupArchiveListeners',
    'clearPlannerTasks', 'clearPriorityLists', 'clearHomeWorkLists',
    'renderSidebarLists', 'renderTasksOnGrid', 'renderPriorityLists', 'renderHomeWorkLists',
    'createTaskElement', 'setupTabSwitching', 'setupCoreFeatureListeners',
    'setupDragAndDropListeners', 'setupTaskManagementListeners', 'setupAllListeners',
    'renderArchiveTab', 'renderStatsTab',
    'applySearchFilter', 'setupPrioritySearch', 'setupLocationSearch',
    'showUndoToast', 'setupUndoKeyboardListeners'
];

beforeEach(() => {
    resetChromeStorage();
    setupManagerDOM();
    // Load manager.js with DOMContentLoaded stripped (converted to __initFn__)
    loadScript(path.join(__dirname, '..', 'manager.js'), MANAGER_EXPORTS, { stripDOMContentLoaded: true });
    // Don't auto-call __initFn__() - tests will call specific setup functions as needed
});

describe('generateDayHeaders', () => {
    test('creates 8 headers (time + 7 days)', async () => {
        await generateDayHeaders();
        const headers = document.querySelectorAll('.grid-header');
        expect(headers.length).toBe(8);
    });

    test('first header is "Time"', async () => {
        await generateDayHeaders();
        const headers = document.querySelectorAll('.grid-header');
        expect(headers[0].textContent).toBe('Time');
    });

    test('starts from today', async () => {
        await generateDayHeaders();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[new Date().getDay()];
        // Check the first day header's data-day attribute matches today
        const firstDayHeader = document.querySelectorAll('.grid-header[data-day]')[0];
        expect(firstDayHeader.dataset.day).toBe(todayName);
    });

    test('sets data-day attributes on day headers', async () => {
        await generateDayHeaders();
        const headers = document.querySelectorAll('.grid-header[data-day]');
        expect(headers.length).toBe(7);
    });
});

describe('generatePlannerGrid', () => {
    test('creates grid cells for each time block and day', async () => {
        await generatePlannerGrid();
        const cells = document.querySelectorAll('.grid-cell');
        expect(cells.length).toBe(TIME_BLOCKS.length * 7);
    });

    test('creates time labels for each block', async () => {
        await generatePlannerGrid();
        const labels = document.querySelectorAll('.time-label');
        expect(labels.length).toBe(TIME_BLOCKS.length);
    });

    test('cells have correct data attributes', async () => {
        await generatePlannerGrid();
        const firstCell = document.querySelector('.grid-cell');
        expect(firstCell.dataset.day).toBeDefined();
        expect(firstCell.dataset.blockId).toBeDefined();
        expect(firstCell.dataset.taskLimit).toBeDefined();
    });

    test('cells have color classes from TIME_BLOCKS', async () => {
        await generatePlannerGrid();
        const sakuraCells = document.querySelectorAll('.grid-cell.block-color-sakura');
        expect(sakuraCells.length).toBe(7);
    });
});

describe('createTaskElement', () => {
    test('creates element with priority class', () => {
        const task = { id: 't1', title: 'Test', priority: 'CRITICAL', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task);
        expect(el.classList.contains('priority-CRITICAL')).toBe(true);
    });

    test('adds completed class', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: true, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task);
        expect(el.classList.contains('task-completed')).toBe(true);
    });

    test('adds energy class for incomplete tasks', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'high', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task);
        expect(el.classList.contains('energy-high-incomplete')).toBe(true);
    });

    test('renders checkbox in management context', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 1 });
        expect(el.querySelector('.task-complete-checkbox')).not.toBeNull();
    });

    test('renders edit and delete buttons in management context', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 1 });
        expect(el.querySelector('.edit-task-btn-list')).not.toBeNull();
        expect(el.querySelector('.delete-task-btn-list')).not.toBeNull();
    });

    test('renders move up button when not first', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 1, total: 3 });
        expect(el.querySelector('.move-task-up-btn')).not.toBeNull();
    });

    test('does not render move up button for first item', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 3 });
        expect(el.querySelector('.move-task-up-btn')).toBeNull();
    });

    test('renders move down button when not last', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 3 });
        expect(el.querySelector('.move-task-down-btn')).not.toBeNull();
    });

    test('does not render move down button for last item', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 2, total: 3 });
        expect(el.querySelector('.move-task-down-btn')).toBeNull();
    });

    test('sidebar context makes items draggable', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'sidebar' });
        expect(el.getAttribute('draggable')).toBe('true');
    });

    test('grid context makes items draggable', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'grid' });
        expect(el.getAttribute('draggable')).toBe('true');
    });

    test('management context does not make items draggable', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 1 });
        expect(el.getAttribute('draggable')).toBeNull();
    });

    test('shows type icon', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'work', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'sidebar' });
        const icon = el.querySelector('.task-type-icon');
        expect(icon).not.toBeNull();
    });

    test('sidebar assigned shows toggle button', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [{ day: 'monday', blockId: 'ai-study', completed: false }], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'sidebar', isAssigned: true });
        expect(el.querySelector('.toggle-schedule-btn')).not.toBeNull();
    });

    test('sidebar shows schedule button', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'sidebar' });
        expect(el.querySelector('.schedule-task-btn')).not.toBeNull();
    });

    test('shows recurrence badge when task has recurrence', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: 'weekly' };
        const el = createTaskElement(task);
        expect(el.querySelector('.recurrence-badge')).not.toBeNull();
    });

    test('no recurrence badge when recurrence is null', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task);
        expect(el.querySelector('.recurrence-badge')).toBeNull();
    });

    test('shows notes toggle when task has notes', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: 'Some notes here', recurrence: null };
        const el = createTaskElement(task);
        expect(el.querySelector('.task-notes-toggle')).not.toBeNull();
    });

    test('no notes toggle when notes is empty', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task);
        expect(el.querySelector('.task-notes-toggle')).toBeNull();
    });
});

describe('renderSidebarLists', () => {
    test('renders unassigned tasks', () => {
        const unassigned = [
            { id: 't1', title: 'Task 1', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [], notes: '', recurrence: null },
        ];
        renderSidebarLists(unassigned, []);
        const list = document.getElementById('unassigned-tasks-list');
        expect(list.querySelectorAll('.task-item').length).toBe(1);
    });

    test('shows empty message when no unassigned tasks', () => {
        renderSidebarLists([], []);
        const list = document.getElementById('unassigned-tasks-list');
        expect(list.innerHTML).toContain('All tasks assigned');
    });

    test('renders assigned tasks', () => {
        const assigned = [
            { id: 't1', title: 'Task 1', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [{ day: 'monday', blockId: 'ai-study', completed: false }], displayOrder: 0, notes: '', recurrence: null },
        ];
        renderSidebarLists([], assigned);
        const list = document.getElementById('assigned-tasks-list');
        expect(list.querySelectorAll('.task-item').length).toBe(1);
    });

    test('shows empty message when no assigned tasks', () => {
        renderSidebarLists([], []);
        const list = document.getElementById('assigned-tasks-list');
        expect(list.innerHTML).toContain('No tasks scheduled');
    });
});

describe('renderPriorityLists', () => {
    test('sorts tasks into priority columns', () => {
        const tasks = [
            { id: 't1', title: 'Critical', priority: 'CRITICAL', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [], deadline: '2025-12-01', notes: '', recurrence: null },
            { id: 't2', title: 'Important', priority: 'IMPORTANT', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [], notes: '', recurrence: null },
            { id: 't3', title: 'Someday', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [], notes: '', recurrence: null },
        ];
        renderPriorityLists(tasks);
        expect(document.getElementById('critical-tasks-list').querySelectorAll('.task-item').length).toBe(1);
        expect(document.getElementById('important-tasks-list').querySelectorAll('.task-item').length).toBe(1);
        expect(document.getElementById('someday-tasks-list').querySelectorAll('.task-item').length).toBe(1);
    });

    test('shows empty message for empty columns', () => {
        renderPriorityLists([]);
        expect(document.getElementById('critical-tasks-list').innerHTML).toContain('No tasks in this category');
        expect(document.getElementById('important-tasks-list').innerHTML).toContain('No tasks in this category');
        expect(document.getElementById('someday-tasks-list').innerHTML).toContain('No tasks in this category');
    });

    test('sorts within priority by displayOrder', () => {
        const tasks = [
            { id: 't1', title: 'Second', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 1, schedule: [], notes: '', recurrence: null },
            { id: 't2', title: 'First', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [], notes: '', recurrence: null },
        ];
        renderPriorityLists(tasks);
        const items = document.getElementById('someday-tasks-list').querySelectorAll('.task-item');
        expect(items[0].dataset.taskId).toBe('t2');
        expect(items[1].dataset.taskId).toBe('t1');
    });
});

describe('renderHomeWorkLists', () => {
    test('separates home and work tasks', () => {
        const tasks = [
            { id: 't1', title: 'Home', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [], notes: '', recurrence: null },
            { id: 't2', title: 'Work', priority: 'SOMEDAY', completed: false, type: 'work', energy: 'low', displayOrder: 0, schedule: [], notes: '', recurrence: null },
        ];
        renderHomeWorkLists(tasks);
        expect(document.getElementById('home-tasks-list').querySelectorAll('.task-item').length).toBe(1);
        expect(document.getElementById('work-tasks-list').querySelectorAll('.task-item').length).toBe(1);
    });

    test('sorts by priority then displayOrder', () => {
        const tasks = [
            { id: 't1', title: 'Someday', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [], notes: '', recurrence: null },
            { id: 't2', title: 'Critical', priority: 'CRITICAL', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [], deadline: '2025-12-01', notes: '', recurrence: null },
        ];
        renderHomeWorkLists(tasks);
        const items = document.getElementById('home-tasks-list').querySelectorAll('.task-item');
        expect(items[0].dataset.taskId).toBe('t2');
        expect(items[1].dataset.taskId).toBe('t1');
    });

    test('shows empty message for empty columns', () => {
        renderHomeWorkLists([]);
        expect(document.getElementById('home-tasks-list').innerHTML).toContain('No tasks in this category');
        expect(document.getElementById('work-tasks-list').innerHTML).toContain('No tasks in this category');
    });
});

describe('renderTasksOnGrid', () => {
    test('places tasks in correct grid cells', async () => {
        await generatePlannerGrid();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[new Date().getDay()];
        const tasks = [{
            id: 't1', title: 'Grid Task', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low',
            schedule: [{ day: todayName, blockId: 'ai-study', completed: false }],
            notes: '', recurrence: null
        }];
        renderTasksOnGrid(tasks);
        const cell = document.querySelector(`.grid-cell[data-day='${todayName}'][data-block-id='ai-study']`);
        expect(cell.querySelectorAll('.task-item').length).toBe(1);
    });
});

describe('clearPlannerTasks', () => {
    test('clears sidebar lists', () => {
        document.getElementById('unassigned-tasks-list').innerHTML = '<div>task</div>';
        document.getElementById('assigned-tasks-list').innerHTML = '<div>task</div>';
        clearPlannerTasks();
        expect(document.getElementById('unassigned-tasks-list').innerHTML).toBe('');
        expect(document.getElementById('assigned-tasks-list').innerHTML).toBe('');
    });

    test('clears grid cells but preserves labels', async () => {
        await generatePlannerGrid();
        const cell = document.querySelector('.grid-cell');
        const taskDiv = document.createElement('div');
        taskDiv.classList.add('task-item');
        cell.appendChild(taskDiv);
        clearPlannerTasks();
        expect(cell.querySelector('.grid-cell-label')).not.toBeNull();
        expect(cell.querySelector('.task-item')).toBeNull();
    });
});

describe('clearPriorityLists', () => {
    test('clears all priority lists', () => {
        document.getElementById('critical-tasks-list').innerHTML = '<div>task</div>';
        document.getElementById('important-tasks-list').innerHTML = '<div>task</div>';
        document.getElementById('someday-tasks-list').innerHTML = '<div>task</div>';
        clearPriorityLists();
        expect(document.getElementById('critical-tasks-list').innerHTML).toBe('');
        expect(document.getElementById('important-tasks-list').innerHTML).toBe('');
        expect(document.getElementById('someday-tasks-list').innerHTML).toBe('');
    });
});

describe('clearHomeWorkLists', () => {
    test('clears home and work lists', () => {
        document.getElementById('home-tasks-list').innerHTML = '<div>task</div>';
        document.getElementById('work-tasks-list').innerHTML = '<div>task</div>';
        clearHomeWorkLists();
        expect(document.getElementById('home-tasks-list').innerHTML).toBe('');
        expect(document.getElementById('work-tasks-list').innerHTML).toBe('');
    });
});

describe('Tab switching', () => {
    test('tab click activates correct tab and content', () => {
        setupTabSwitching();
        const tabs = document.querySelectorAll('.tab-link');
        const priorityTab = tabs[1];
        priorityTab.click();

        expect(priorityTab.classList.contains('active')).toBe(true);
        expect(priorityTab.getAttribute('aria-selected')).toBe('true');
        expect(tabs[0].classList.contains('active')).toBe(false);
        expect(tabs[0].getAttribute('aria-selected')).toBe('false');

        const taskListsContent = document.getElementById('task-lists');
        expect(taskListsContent.classList.contains('active')).toBe(true);
    });
});

describe('renderPage', () => {
    test('renders all sections', async () => {
        await generatePlannerGrid();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[new Date().getDay()];

        seedTasks([
            { id: 't1', title: 'Unassigned', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [], notes: '', recurrence: null },
            { id: 't2', title: 'Assigned', priority: 'IMPORTANT', completed: false, type: 'work', energy: 'high', displayOrder: 0, schedule: [{ day: todayName, blockId: 'ai-study', completed: false }], notes: '', recurrence: null },
        ]);

        await renderPage();

        const unassigned = document.getElementById('unassigned-tasks-list').querySelectorAll('.task-item');
        expect(unassigned.length).toBe(1);

        const importantList = document.getElementById('important-tasks-list').querySelectorAll('.task-item');
        expect(importantList.length).toBe(1);

        const homeList = document.getElementById('home-tasks-list').querySelectorAll('.task-item');
        expect(homeList.length).toBe(1);
    });
});

describe('highlightCurrentDay', () => {
    test('highlights today header and cells', async () => {
        await generatePlannerGrid();
        highlightCurrentDay();

        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[new Date().getDay()];
        const header = document.querySelector(`.grid-header[data-day='${todayName}']`);
        expect(header.classList.contains('today')).toBe(true);

        const todayCells = document.querySelectorAll(`.grid-cell[data-day='${todayName}']`);
        todayCells.forEach(cell => {
            expect(cell.classList.contains('today')).toBe(true);
        });
    });
});

describe('renderArchiveTab', () => {
    test('shows empty message when no completed tasks', async () => {
        seedTasks([
            { id: 't1', title: 'Active', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [], notes: '', recurrence: null, completedAt: null }
        ]);
        await renderArchiveTab();
        const archiveList = document.getElementById('archive-list');
        expect(archiveList.innerHTML).toContain('No completed tasks');
    });

    test('renders completed tasks grouped by date', async () => {
        seedTasks([
            { id: 't1', title: 'Done Task', priority: 'SOMEDAY', completed: true, type: 'home', energy: 'low', displayOrder: 0, schedule: [], notes: '', recurrence: null, completedAt: '2025-06-01T10:00:00.000Z' }
        ]);
        await renderArchiveTab();
        const archiveList = document.getElementById('archive-list');
        expect(archiveList.querySelectorAll('.task-item').length).toBe(1);
    });
});

describe('renderStatsTab', () => {
    test('renders stats content', async () => {
        seedTasks([
            { id: 't1', title: 'Done', priority: 'SOMEDAY', completed: true, type: 'home', energy: 'low', displayOrder: 0, schedule: [], notes: '', recurrence: null, completedAt: null },
            { id: 't2', title: 'Active', priority: 'IMPORTANT', completed: false, type: 'work', energy: 'high', displayOrder: 0, schedule: [], notes: '', recurrence: null, completedAt: null }
        ]);
        await renderStatsTab();
        const statsContent = document.getElementById('stats-content');
        expect(statsContent.innerHTML.length).toBeGreaterThan(0);
    });
});

describe('applySearchFilter', () => {
    test('hides non-matching task items', () => {
        const container = document.getElementById('someday-tasks-list');
        container.innerHTML = `
            <div class="task-item"><span class="task-title">Buy groceries</span></div>
            <div class="task-item"><span class="task-title">Read book</span></div>
        `;
        applySearchFilter('groc', [container]);
        const items = container.querySelectorAll('.task-item');
        expect(items[0].style.display).not.toBe('none');
        expect(items[1].style.display).toBe('none');
    });

    test('shows all items when query is empty', () => {
        const container = document.getElementById('someday-tasks-list');
        container.innerHTML = `
            <div class="task-item" style="display:none;"><span class="task-title">Buy groceries</span></div>
        `;
        applySearchFilter('', [container]);
        const items = container.querySelectorAll('.task-item');
        expect(items[0].style.display).not.toBe('none');
    });

    test('is case insensitive', () => {
        const container = document.getElementById('someday-tasks-list');
        container.innerHTML = `
            <div class="task-item"><span class="task-title">Buy GROCERIES</span></div>
        `;
        applySearchFilter('groceries', [container]);
        const items = container.querySelectorAll('.task-item');
        expect(items[0].style.display).not.toBe('none');
    });
});
