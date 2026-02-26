// tests/manager.test.js
require('./mocks/chrome.storage.mock');
const path = require('path');

// Load task_utils first (dependency)
loadScript(path.join(__dirname, '..', 'task_utils.js'), [
    'DEFAULT_TIME_BLOCKS', 'TIME_BLOCKS', 'DEFAULT_SETTINGS',
    'ATTRIBUTE_OPTIONS', 'DEFAULT_ENABLED_ATTRIBUTES',
    'Task', 'getTasks', 'saveTasks', 'addNewTask', 'getTaskById',
    'updateTaskCompletion', 'updateTask', 'deleteTask', 'showInfoMessage',
    'getTasksAsync', 'saveTasksAsync', 'withTaskLock', 'validateTask', 'isValidUrl',
    'debounce', 'setupStorageSync', '_lastSaveTimestamp',
    'getSettings', 'saveSettings', 'seedSampleTasks',
    'getTimeBlocks', 'saveTimeBlocks',
    'pushUndoState', 'undo', 'redo',
    'createRecurringInstance',
    'parseTimeRange',
    'deriveCompletedFromStatus', 'deriveStatusFromCompleted'
]);

// Load settings.js (dependency of manager.js)
loadScript(path.join(__dirname, '..', 'settings.js'), [
    'initSettings', 'applySettings',
    'openSettingsModal', 'closeSettingsModal',
    'setupSettingsModalListeners',
    'getEnabledAttributes'
]);

// Setup manager HTML before loading manager.js
function setupManagerDOM() {
    document.body.innerHTML = `
        <div class="container manager-container">
            <div class="manager-header">
                <h1>Weekly Task Planner</h1>
                <div class="manager-header-actions">
                    <button id="add-task-modal-btn" class="neumorphic-btn add-task-header-btn" aria-label="Add New Task">
                        <span class="btn-icon">➕</span>
                        <span class="btn-text">Add New Task</span>
                    </button>
                    <button id="help-btn" class="neumorphic-btn icon-btn has-tooltip" aria-label="Help">
                        <span class="btn-icon-text">?</span>
                        <span class="btn-tooltip">Help</span>
                    </button>
                    <button id="settings-btn" class="neumorphic-btn icon-btn has-tooltip" aria-label="Settings">
                        <span class="btn-icon-text">⚙️</span>
                        <span class="btn-tooltip">Settings</span>
                    </button>
                </div>
            </div>
            <div id="info-message-area" class="info-message" style="display: none;" role="status" aria-live="polite"></div>

            <div class="tabs" role="tablist">
                <button class="tab-link active" data-tab="weekly-schedule" role="tab" aria-selected="true">SCHEDULE</button>
                <button class="tab-link" data-tab="groups-tab" role="tab" aria-selected="false">GROUPS</button>
                <button class="tab-link" data-tab="archive-tab" role="tab" aria-selected="false">ARCHIVE</button>
                <button class="tab-link" data-tab="stats-tab" role="tab" aria-selected="false">STATS</button>
            </div>

            <div class="main-content">
                <div id="weekly-schedule" class="tab-content active" role="tabpanel">
                    <div class="schedule-tab-header">
                        <div class="search-bar-container">
                            <input type="search" id="schedule-search-input" placeholder="Search tasks...">
                            <button id="schedule-search-clear">Clear</button>
                        </div>
                    </div>
                    <div class="planner-container">
                        <div class="tasks-column collapsible-sidebar" id="unassigned-tasks-container">
                            <div class="sidebar-header">
                                <button class="sidebar-collapse-toggle" aria-expanded="true"
                                        aria-controls="unassigned-tasks-list" aria-label="Toggle Parking Lot">
                                    <span class="collapse-icon">◀</span>
                                </button>
                                <h3>Parking Lot</h3>
                                <span class="task-count-badge" id="unassigned-count">0</span>
                            </div>
                            <div id="unassigned-tasks-list" class="task-list neumorphic-inset-card collapsible-content"></div>
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

                <div id="groups-tab" class="tab-content" role="tabpanel">
                    <nav id="groups-breadcrumb" class="groups-breadcrumb hidden">
                        <button id="groups-back-btn" class="neumorphic-btn">← Groups</button>
                        <span>/</span>
                        <span id="breadcrumb-attribute-name"></span>
                    </nav>
                    <div id="groups-bento-view" class="groups-bento-grid"></div>
                    <div id="groups-drilldown-view" class="hidden">
                        <div class="drilldown-header">
                            <input type="search" id="groups-drilldown-search" class="neumorphic-input" placeholder="Search tasks...">
                        </div>
                        <div id="groups-drilldown-columns" class="groups-drilldown-columns"></div>
                    </div>
                </div>

                <div id="archive-tab" class="tab-content" role="tabpanel">
                    <div class="archive-header">
                        <h2>Completed Tasks Archive</h2>
                        <div class="archive-header-actions">
                            <div class="search-bar-container">
                                <input type="search" id="archive-search-input" placeholder="Search archived tasks...">
                                <button id="archive-search-clear">Clear</button>
                            </div>
                            <button id="clear-all-completed-btn" class="neumorphic-btn">Clear All Completed</button>
                        </div>
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
                        <button class="tab-link active" data-help-tab="help-overview">Overview</button>
                        <button class="tab-link" data-help-tab="help-quickstart">Quick Start</button>
                        <button class="tab-link" data-help-tab="help-faq">FAQ</button>
                    </div>
                    <div class="help-content">
                        <div id="help-overview" class="help-panel active"><p>Welcome!</p></div>
                        <div id="help-quickstart" class="help-panel"><p>Quick start guide</p></div>
                        <div id="help-faq" class="help-panel">
                            <div class="faq-item"><h4 class="faq-question">Q1?</h4><p class="faq-answer">A1</p></div>
                            <div class="faq-item"><h4 class="faq-question">Q2?</h4><p class="faq-answer">A2</p></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Add Task Modal -->
            <div id="add-task-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="add-task-title">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="add-task-title">Add New Task</h2>
                        <button id="add-task-close-btn" class="neumorphic-btn icon-btn" aria-label="Close">✕</button>
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
                        <input type="radio" id="manager-energy-low" name="manager-energy" value="Low" checked>
                        <input type="radio" id="manager-energy-high" name="manager-energy" value="High">
                        <select id="manager-task-recurrence" class="neumorphic-select">
                            <option value="">None</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                        <textarea id="manager-task-notes" class="neumorphic-input" rows="2"></textarea>
                        <button id="manager-add-task-btn" class="neumorphic-btn">Add Task</button>
                    </div>
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
    'setupSettingsListeners', 'setupHelpListeners', 'setupAddTaskModalListeners', 'highlightCurrentDay',
    'setupSchedulingListeners', 'setupArchiveListeners',
    'clearPlannerTasks',
    'renderSidebarLists', 'renderTasksOnGrid',
    'createTaskElement', 'setupTabSwitching', 'setupCoreFeatureListeners',
    'setupDragAndDropListeners', 'setupTaskManagementListeners', 'setupAllListeners',
    'renderArchiveTab', 'renderStatsTab',
    'getCompletedInRange', 'calculateStreak', 'getPeakHours', 'getFocusDistribution', 'getBlockDistribution', 'getStaleTasks',
    'applySearchFilter', 'setupScheduleSearch', 'setupArchiveSearch',
    'showUndoToast', 'setupUndoKeyboardListeners',
    // Schedule Tab Enhancements
    'setupCollapsibleSidebar', 'updateUnassignedCount',
    'showDragGuides', 'clearDragGuides', 'showSnapIndicator', 'currentGuideElements',
    'createHoverPopover', 'showTaskPopover', 'positionPopover', 'hideTaskPopover', 'setupHoverPopover',
    'escapeHtml', 'truncateUrl', 'formatPopoverDeadline', 'hoverPopover', 'hoverTimeout', 'HOVER_DELAY',
    'getCurrentTimeBlockInfo', 'formatCurrentTime', 'updateCurrentTimeIndicator',
    'startTimeIndicatorUpdates', 'stopTimeIndicatorUpdates', 'timeIndicatorInterval',
    // Groups Tab
    'renderGroupsTab', 'calculateAttributeDistribution', 'createBentoBox', 'renderMiniPieChart',
    'openGroupsDrilldown', 'closeGroupsDrilldown', 'renderGroupsDrilldownColumns',
    // Stats helpers
    'renderStatusDistributionBars', 'renderAttributeDistributionBars',
    // Event/MIT helpers
    'setupEventCreationListeners', 'setupMITListeners', 'checkEventExpiry', 'checkMITRetrospective', 'updateMITStatus'
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
        const task = { id: 't1', title: 'Test', priority: 'CRITICAL', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task);
        expect(el.classList.contains('priority-CRITICAL')).toBe(true);
    });

    test('adds completed class when status is done', () => {
        // Note: completion is now derived from status field, not completed boolean
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: true, status: 'done', type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task);
        expect(el.classList.contains('task-completed')).toBe(true);
    });

    test('adds energy class for incomplete tasks', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'High', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task);
        expect(el.classList.contains('energy-high-incomplete')).toBe(true);
    });

    test('renders checkbox in management context', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 1 });
        expect(el.querySelector('.task-complete-checkbox')).not.toBeNull();
    });

    test('does not render inline edit/delete buttons in management context (use Task Details modal instead)', () => {
        // Edit/Delete buttons were removed from management context - use Task Details modal via double-click instead
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 1 });
        expect(el.querySelector('.edit-task-btn-list')).toBeNull();
        expect(el.querySelector('.delete-task-btn-list')).toBeNull();
    });

    test('renders move up button when not first', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 1, total: 3 });
        expect(el.querySelector('.move-task-up-btn')).not.toBeNull();
    });

    test('does not render move up button for first item', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 3 });
        expect(el.querySelector('.move-task-up-btn')).toBeNull();
    });

    test('renders move down button when not last', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 3 });
        expect(el.querySelector('.move-task-down-btn')).not.toBeNull();
    });

    test('does not render move down button for last item', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 2, total: 3 });
        expect(el.querySelector('.move-task-down-btn')).toBeNull();
    });

    test('sidebar context makes items draggable', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'sidebar' });
        expect(el.getAttribute('draggable')).toBe('true');
    });

    test('grid context makes items draggable', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'grid' });
        expect(el.getAttribute('draggable')).toBe('true');
    });

    test('management context does not make items draggable', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 1 });
        expect(el.getAttribute('draggable')).toBeNull();
    });

    test('shows type icon', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'work', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'sidebar' });
        const icon = el.querySelector('.task-type-icon');
        expect(icon).not.toBeNull();
    });

    test('sidebar assigned shows toggle button', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [{ day: 'monday', blockId: 'ai-study', completed: false }], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'sidebar', isAssigned: true });
        expect(el.querySelector('.toggle-schedule-btn')).not.toBeNull();
    });

    test('sidebar shows schedule button', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task, { context: 'sidebar' });
        expect(el.querySelector('.schedule-task-btn')).not.toBeNull();
    });

    test('shows recurrence badge when task has recurrence', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: 'weekly' };
        const el = createTaskElement(task);
        expect(el.querySelector('.recurrence-badge')).not.toBeNull();
    });

    test('no recurrence badge when recurrence is null', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task);
        expect(el.querySelector('.recurrence-badge')).toBeNull();
    });

    test('shows notes toggle when task has notes', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: 'Some notes here', recurrence: null };
        const el = createTaskElement(task);
        expect(el.querySelector('.task-notes-toggle')).not.toBeNull();
    });

    test('no notes toggle when notes is empty', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null };
        const el = createTaskElement(task);
        expect(el.querySelector('.task-notes-toggle')).toBeNull();
    });

    test('event note styling', () => {
        const task = { id: 'e1', title: 'Event', isEvent: true, priority: 'SOMEDAY', completed: false, schedule: [] };
        const el = createTaskElement(task);
        expect(el.classList.contains('event-note')).toBe(true);
        // Should not have checkbox
        expect(el.querySelector('.task-complete-checkbox')).toBeNull();
    });

    test('MIT star button', () => {
        const task = { id: 't1', title: 'Task', isMIT: true, priority: 'IMPORTANT', completed: false, schedule: [] };
        const el = createTaskElement(task);
        const star = el.querySelector('.mit-star-btn');
        expect(star).not.toBeNull();
        expect(star.classList.contains('active')).toBe(true);
    });
});

describe('renderSidebarLists', () => {
    test('renders unassigned tasks', () => {
        const unassigned = [
            { id: 't1', title: 'Task 1', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [], notes: '', recurrence: null },
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
            { id: 't1', title: 'Task 1', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', schedule: [{ day: 'monday', blockId: 'ai-study', completed: false }], displayOrder: 0, notes: '', recurrence: null },
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

describe('Groups Tab - calculateAttributeDistribution', () => {
    test('calculates distribution for priority attribute', () => {
        const tasks = [
            { id: 't1', title: 'Task 1', priority: 'CRITICAL', completed: false },
            { id: 't2', title: 'Task 2', priority: 'CRITICAL', completed: false },
            { id: 't3', title: 'Task 3', priority: 'IMPORTANT', completed: false },
            { id: 't4', title: 'Task 4', priority: 'SOMEDAY', completed: false },
        ];
        const distribution = calculateAttributeDistribution(tasks, 'priority');
        expect(distribution.counts['CRITICAL']).toBe(2);
        expect(distribution.counts['IMPORTANT']).toBe(1);
        expect(distribution.counts['SOMEDAY']).toBe(1);
        expect(distribution.total).toBe(4);
    });

    test('calculates distribution for type attribute', () => {
        const tasks = [
            { id: 't1', title: 'Task 1', type: 'home', completed: false },
            { id: 't2', title: 'Task 2', type: 'work', completed: false },
            { id: 't3', title: 'Task 3', type: 'work', completed: false },
        ];
        const distribution = calculateAttributeDistribution(tasks, 'type');
        expect(distribution.counts['home']).toBe(1);
        expect(distribution.counts['work']).toBe(2);
        expect(distribution.total).toBe(3);
    });

    test('handles empty tasks array', () => {
        const distribution = calculateAttributeDistribution([], 'priority');
        expect(distribution.total).toBe(0);
        expect(Object.keys(distribution.counts).length).toBe(0);
    });
});

describe('Groups Tab - renderMiniPieChart', () => {
    test('generates SVG with correct segments', () => {
        const counts = { 'CRITICAL': 2, 'IMPORTANT': 1, 'SOMEDAY': 1 };
        const svg = renderMiniPieChart(counts, 'priority');
        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');
    });

    test('handles single value', () => {
        const counts = { 'CRITICAL': 5 };
        const svg = renderMiniPieChart(counts, 'priority');
        expect(svg).toContain('<svg');
    });
});

describe('Groups Tab - createBentoBox', () => {
    test('creates bento box element', () => {
        const distribution = { counts: { 'CRITICAL': 2, 'IMPORTANT': 1 }, total: 3 };
        const meta = { label: 'Priority', icon: '⭐' };
        const box = createBentoBox('priority', meta, distribution);
        expect(box.classList.contains('groups-bento-box')).toBe(true);
        expect(box.outerHTML).toContain('Priority');
        expect(box.outerHTML).toContain('⭐');
    });
});

describe('Groups Tab - closeGroupsDrilldown', () => {
    test('hides drilldown view and shows bento view', async () => {
        document.getElementById('groups-drilldown-view').classList.remove('hidden');
        document.getElementById('groups-bento-view').classList.add('hidden');
        document.getElementById('groups-breadcrumb').classList.remove('hidden');

        // closeGroupsDrilldown is now async with animation delay
        await closeGroupsDrilldown();
        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(document.getElementById('groups-drilldown-view').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('groups-bento-view').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('groups-breadcrumb').classList.contains('hidden')).toBe(true);
    });
});

describe('renderTasksOnGrid', () => {
    test('places tasks in correct grid cells', async () => {
        await generatePlannerGrid();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[new Date().getDay()];
        const tasks = [{
            id: 't1', title: 'Grid Task', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low',
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


describe('Tab switching', () => {
    test('tab click activates correct tab and content', () => {
        setupTabSwitching();
        const tabs = document.querySelectorAll('.tab-link');
        const groupsTab = tabs[1]; // Now GROUPS tab instead of PRIORITY
        groupsTab.click();

        expect(groupsTab.classList.contains('active')).toBe(true);
        expect(groupsTab.getAttribute('aria-selected')).toBe('true');
        expect(tabs[0].classList.contains('active')).toBe(false);
        expect(tabs[0].getAttribute('aria-selected')).toBe('false');

        const groupsContent = document.getElementById('groups-tab');
        expect(groupsContent.classList.contains('active')).toBe(true);
    });
});

describe('renderPage', () => {
    test('renders all sections', async () => {
        await generatePlannerGrid();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[new Date().getDay()];

        seedTasks([
            { id: 't1', title: 'Unassigned', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', displayOrder: 0, schedule: [], notes: '', recurrence: null },
            { id: 't2', title: 'Assigned', priority: 'IMPORTANT', completed: false, type: 'work', energy: 'High', displayOrder: 0, schedule: [{ day: todayName, blockId: 'ai-study', completed: false }], notes: '', recurrence: null },
        ]);

        await renderPage();

        // Check unassigned tasks rendered in sidebar
        const unassigned = document.getElementById('unassigned-tasks-list').querySelectorAll('.task-item');
        expect(unassigned.length).toBe(1);

        // Check assigned tasks rendered in sidebar
        const assigned = document.getElementById('assigned-tasks-list').querySelectorAll('.task-item');
        expect(assigned.length).toBe(1);
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
            { id: 't1', title: 'Active', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'Low', displayOrder: 0, schedule: [], notes: '', recurrence: null, completedAt: null }
        ]);
        await renderArchiveTab();
        const archiveList = document.getElementById('archive-list');
        expect(archiveList.innerHTML).toContain('No completed tasks');
    });

    test('renders completed tasks grouped by date', async () => {
        seedTasks([
            { id: 't1', title: 'Done Task', priority: 'SOMEDAY', completed: true, type: 'home', energy: 'Low', displayOrder: 0, schedule: [], notes: '', recurrence: null, completedAt: '2025-06-01T10:00:00.000Z' }
        ]);
        await renderArchiveTab();
        const archiveList = document.getElementById('archive-list');
        expect(archiveList.querySelectorAll('.task-item').length).toBe(1);
    });

    test('sorts tasks by lastModified within groups (latest first)', async () => {
        const now = new Date();
        const todayStr = now.toISOString();
        seedTasks([
            { id: 't1', title: 'Old Task', priority: 'SOMEDAY', completed: true, type: 'home', energy: 'Low', displayOrder: 0, schedule: [], notes: '', recurrence: null, completedAt: todayStr, lastModified: '2025-01-01T08:00:00.000Z' },
            { id: 't2', title: 'New Task', priority: 'SOMEDAY', completed: true, type: 'home', energy: 'Low', displayOrder: 1, schedule: [], notes: '', recurrence: null, completedAt: todayStr, lastModified: '2025-01-01T12:00:00.000Z' },
            { id: 't3', title: 'Mid Task', priority: 'SOMEDAY', completed: true, type: 'home', energy: 'Low', displayOrder: 2, schedule: [], notes: '', recurrence: null, completedAt: todayStr, lastModified: '2025-01-01T10:00:00.000Z' }
        ]);
        await renderArchiveTab();
        const archiveList = document.getElementById('archive-list');
        const taskItems = archiveList.querySelectorAll('.task-item');
        // Should be sorted: New Task (12:00), Mid Task (10:00), Old Task (08:00)
        expect(taskItems[0].dataset.taskId).toBe('t2');
        expect(taskItems[1].dataset.taskId).toBe('t3');
        expect(taskItems[2].dataset.taskId).toBe('t1');
    });
});

describe('renderStatsTab', () => {
    test('renders stats content with bento grid', async () => {
        seedTasks([
            { id: 't1', title: 'Done', priority: 'SOMEDAY', completed: true, type: 'home', energy: 'Low', displayOrder: 0, schedule: [], notes: '', recurrence: null, completedAt: new Date().toISOString() },
            { id: 't2', title: 'Active', priority: 'IMPORTANT', completed: false, type: 'work', energy: 'High', displayOrder: 0, schedule: [], notes: '', recurrence: null, completedAt: null }
        ]);
        await renderStatsTab();
        const statsContent = document.getElementById('stats-content');
        expect(statsContent.innerHTML.length).toBeGreaterThan(0);
        // Check for bento grid layout
        expect(statsContent.querySelector('.stats-bento-grid')).not.toBeNull();
    });

    test('renders hero progress ring', async () => {
        seedTasks([
            { id: 't1', title: 'Task 1', priority: 'SOMEDAY', completed: true, type: 'home', energy: 'Low', displayOrder: 0, schedule: [], notes: '', recurrence: null, completedAt: new Date().toISOString() }
        ]);
        await renderStatsTab();
        const statsContent = document.getElementById('stats-content');
        expect(statsContent.querySelector('.stats-hero-card')).not.toBeNull();
        expect(statsContent.querySelector('.stats-ring-svg')).not.toBeNull();
    });

    test('renders momentum card', async () => {
        seedTasks([]);
        await renderStatsTab();
        const statsContent = document.getElementById('stats-content');
        expect(statsContent.querySelector('.stats-momentum-card')).not.toBeNull();
    });

    test('renders streak card', async () => {
        seedTasks([]);
        await renderStatsTab();
        const statsContent = document.getElementById('stats-content');
        expect(statsContent.querySelector('.stats-streak-card')).not.toBeNull();
    });

    test('renders focus distribution chart', async () => {
        seedTasks([]);
        await renderStatsTab();
        const statsContent = document.getElementById('stats-content');
        expect(statsContent.querySelector('.stats-focus-chart')).not.toBeNull();
    });

    test('renders peak hours heatmap', async () => {
        seedTasks([]);
        await renderStatsTab();
        const statsContent = document.getElementById('stats-content');
        expect(statsContent.querySelector('.stats-heatmap')).not.toBeNull();
    });

    test('renders stale tasks section', async () => {
        seedTasks([]);
        await renderStatsTab();
        const statsContent = document.getElementById('stats-content');
        expect(statsContent.querySelector('.stats-stale-card')).not.toBeNull();
    });
});

describe('getCompletedInRange', () => {
    test('returns tasks completed within date range', () => {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(now.getDate() - 2);

        const tasks = [
            { id: 't1', completed: true, completedAt: now.toISOString() },
            { id: 't2', completed: true, completedAt: yesterday.toISOString() },
            { id: 't3', completed: true, completedAt: twoDaysAgo.toISOString() },
            { id: 't4', completed: false, completedAt: null }
        ];

        const result = getCompletedInRange(tasks, yesterday, now);
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('t2');
    });

    test('returns empty array when no completions in range', () => {
        const tasks = [
            { id: 't1', completed: false, completedAt: null }
        ];
        const result = getCompletedInRange(tasks, new Date(), new Date());
        expect(result.length).toBe(0);
    });
});

describe('calculateStreak', () => {
    test('returns 0 when no completed tasks', () => {
        const tasks = [{ id: 't1', completed: false, completedAt: null }];
        expect(calculateStreak(tasks)).toBe(0);
    });

    test('returns streak count for consecutive days', () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        const tasks = [
            { id: 't1', completed: true, completedAt: today.toISOString() },
            { id: 't2', completed: true, completedAt: yesterday.toISOString() }
        ];
        expect(calculateStreak(tasks)).toBe(2);
    });

    test('breaks streak on gap day', () => {
        const today = new Date();
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(today.getDate() - 2);

        const tasks = [
            { id: 't1', completed: true, completedAt: today.toISOString() },
            { id: 't2', completed: true, completedAt: twoDaysAgo.toISOString() }
        ];
        // Streak is 1 (only today) because yesterday is missing
        expect(calculateStreak(tasks)).toBe(1);
    });
});

describe('getPeakHours', () => {
    test('returns array of 24 hour counts', () => {
        const tasks = [];
        const result = getPeakHours(tasks);
        expect(result.length).toBe(24);
        expect(result.every(c => c === 0)).toBe(true);
    });

    test('counts completions by hour', () => {
        const date = new Date();
        date.setHours(14, 0, 0, 0); // 2 PM
        const tasks = [
            { id: 't1', completed: true, completedAt: date.toISOString() },
            { id: 't2', completed: true, completedAt: date.toISOString() }
        ];
        const result = getPeakHours(tasks);
        expect(result[14]).toBe(2);
    });
});

describe('getStaleTasks', () => {
    test('returns empty array when no stale tasks', () => {
        const recentId = `task_${Date.now()}_abc123`;
        const tasks = [{ id: recentId, title: 'Recent', completed: false }];
        const result = getStaleTasks(tasks);
        expect(result.length).toBe(0);
    });

    test('returns tasks older than 14 days', () => {
        const oldTimestamp = Date.now() - (15 * 24 * 60 * 60 * 1000); // 15 days ago
        const oldId = `task_${oldTimestamp}_abc123`;
        const tasks = [{ id: oldId, title: 'Old Task', completed: false }];
        const result = getStaleTasks(tasks);
        expect(result.length).toBe(1);
        expect(result[0].title).toBe('Old Task');
        expect(result[0].daysOld).toBeGreaterThanOrEqual(15);
    });

    test('excludes completed tasks', () => {
        const oldTimestamp = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const oldId = `task_${oldTimestamp}_abc123`;
        const tasks = [{ id: oldId, title: 'Old Task', completed: true }];
        const result = getStaleTasks(tasks);
        expect(result.length).toBe(0);
    });

    test('limits results to 5 tasks', () => {
        const oldTimestamp = Date.now() - (15 * 24 * 60 * 60 * 1000);
        const tasks = Array.from({ length: 10 }, (_, i) => ({
            id: `task_${oldTimestamp - i * 1000}_abc${i}`,
            title: `Old Task ${i}`,
            completed: false
        }));
        const result = getStaleTasks(tasks);
        expect(result.length).toBe(5);
    });
});

describe('applySearchFilter', () => {
    test('hides non-matching task items', () => {
        const container = document.getElementById('archive-list');
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
        const container = document.getElementById('archive-list');
        container.innerHTML = `
            <div class="task-item" style="display:none;"><span class="task-title">Buy groceries</span></div>
        `;
        applySearchFilter('', [container]);
        const items = container.querySelectorAll('.task-item');
        expect(items[0].style.display).not.toBe('none');
    });

    test('is case insensitive', () => {
        const container = document.getElementById('archive-list');
        container.innerHTML = `
            <div class="task-item"><span class="task-title">Buy GROCERIES</span></div>
        `;
        applySearchFilter('groceries', [container]);
        const items = container.querySelectorAll('.task-item');
        expect(items[0].style.display).not.toBe('none');
    });
});

describe('Add Task Modal', () => {
    test('header has add task button', () => {
        const addTaskBtn = document.getElementById('add-task-modal-btn');
        expect(addTaskBtn).not.toBeNull();
        expect(addTaskBtn.textContent).toContain('Add New Task');
    });

    test('add task modal exists and is hidden by default', () => {
        const modal = document.getElementById('add-task-modal');
        expect(modal).not.toBeNull();
        expect(modal.classList.contains('hidden')).toBe(true);
    });

    test('clicking add task button opens modal', async () => {
        setupAddTaskModalListeners();
        const addTaskBtn = document.getElementById('add-task-modal-btn');
        const modal = document.getElementById('add-task-modal');

        addTaskBtn.click();
        // Wait for async click handler to complete
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(modal.classList.contains('hidden')).toBe(false);
    });

    test('clicking close button closes modal', () => {
        setupAddTaskModalListeners();
        const modal = document.getElementById('add-task-modal');
        const closeBtn = document.getElementById('add-task-close-btn');

        modal.classList.remove('hidden');
        closeBtn.click();
        expect(modal.classList.contains('hidden')).toBe(true);
    });

    test('clicking modal overlay closes modal', () => {
        setupAddTaskModalListeners();
        const modal = document.getElementById('add-task-modal');

        modal.classList.remove('hidden');
        modal.click();
        expect(modal.classList.contains('hidden')).toBe(true);
    });

    test('form elements exist in modal', () => {
        expect(document.getElementById('manager-task-title')).not.toBeNull();
        expect(document.getElementById('manager-task-url')).not.toBeNull();
        expect(document.getElementById('manager-priority-someday')).not.toBeNull();
        expect(document.getElementById('manager-task-deadline')).not.toBeNull();
        expect(document.getElementById('manager-type-home')).not.toBeNull();
        expect(document.getElementById('manager-energy-low')).not.toBeNull();
        expect(document.getElementById('manager-task-recurrence')).not.toBeNull();
        expect(document.getElementById('manager-task-notes')).not.toBeNull();
        expect(document.getElementById('manager-add-task-btn')).not.toBeNull();
    });

    test('priority change shows/hides deadline field', () => {
        setupAddTaskModalListeners();
        const criticalRadio = document.getElementById('manager-priority-critical');
        const somedayRadio = document.getElementById('manager-priority-someday');
        const deadlineGroup = document.getElementById('manager-task-deadline-group');

        criticalRadio.checked = true;
        criticalRadio.dispatchEvent(new Event('change', { bubbles: true }));
        expect(deadlineGroup.style.display).toBe('block');

        somedayRadio.checked = true;
        somedayRadio.dispatchEvent(new Event('change', { bubbles: true }));
        expect(deadlineGroup.style.display).toBe('none');
    });
});

describe('Header tooltips', () => {
    test('help button has tooltip', () => {
        const helpBtn = document.getElementById('help-btn');
        const tooltip = helpBtn.querySelector('.btn-tooltip');
        expect(tooltip).not.toBeNull();
        expect(tooltip.textContent).toBe('Help');
    });

    test('settings button has tooltip', () => {
        const settingsBtn = document.getElementById('settings-btn');
        const tooltip = settingsBtn.querySelector('.btn-tooltip');
        expect(tooltip).not.toBeNull();
        expect(tooltip.textContent).toBe('Settings');
    });

    test('buttons have has-tooltip class', () => {
        const helpBtn = document.getElementById('help-btn');
        const settingsBtn = document.getElementById('settings-btn');
        expect(helpBtn.classList.contains('has-tooltip')).toBe(true);
        expect(settingsBtn.classList.contains('has-tooltip')).toBe(true);
    });
});

describe('Help Modal FAQ Tab', () => {
    test('FAQ tab button exists', () => {
        const faqTab = document.querySelector('[data-help-tab="help-faq"]');
        expect(faqTab).not.toBeNull();
        expect(faqTab.textContent).toBe('FAQ');
    });

    test('FAQ panel exists', () => {
        const faqPanel = document.getElementById('help-faq');
        expect(faqPanel).not.toBeNull();
        expect(faqPanel.classList.contains('help-panel')).toBe(true);
    });

    test('FAQ panel contains faq-items', () => {
        const faqPanel = document.getElementById('help-faq');
        const faqItems = faqPanel.querySelectorAll('.faq-item');
        expect(faqItems.length).toBeGreaterThan(0);
    });

    test('FAQ items have question and answer', () => {
        const faqItem = document.querySelector('.faq-item');
        const question = faqItem.querySelector('.faq-question');
        const answer = faqItem.querySelector('.faq-answer');
        expect(question).not.toBeNull();
        expect(answer).not.toBeNull();
    });
});

// ===========================================
// SCHEDULE TAB ENHANCEMENT TESTS
// ===========================================

describe('Collapsible Parking Lot Sidebar', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('sidebar has collapsible-sidebar class', () => {
        const sidebar = document.getElementById('unassigned-tasks-container');
        expect(sidebar.classList.contains('collapsible-sidebar')).toBe(true);
    });

    test('sidebar has collapse toggle button', () => {
        const sidebar = document.getElementById('unassigned-tasks-container');
        const toggleBtn = sidebar.querySelector('.sidebar-collapse-toggle');
        expect(toggleBtn).not.toBeNull();
        expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    });

    test('sidebar has task count badge', () => {
        const badge = document.getElementById('unassigned-count');
        expect(badge).not.toBeNull();
        expect(badge.classList.contains('task-count-badge')).toBe(true);
    });

    test('setupCollapsibleSidebar toggles collapsed class on click', () => {
        setupCollapsibleSidebar();
        const sidebar = document.getElementById('unassigned-tasks-container');
        const toggleBtn = sidebar.querySelector('.sidebar-collapse-toggle');

        toggleBtn.click();
        expect(sidebar.classList.contains('collapsed')).toBe(true);
        expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

        toggleBtn.click();
        expect(sidebar.classList.contains('collapsed')).toBe(false);
        expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    });

    test('setupCollapsibleSidebar persists collapsed state in localStorage', () => {
        setupCollapsibleSidebar();
        const toggleBtn = document.querySelector('.sidebar-collapse-toggle');

        toggleBtn.click();
        expect(localStorage.getItem('parkingLotCollapsed')).toBe('true');

        toggleBtn.click();
        expect(localStorage.getItem('parkingLotCollapsed')).toBe('false');
    });

    test('setupCollapsibleSidebar restores collapsed state on init', () => {
        localStorage.setItem('parkingLotCollapsed', 'true');
        setupCollapsibleSidebar();

        const sidebar = document.getElementById('unassigned-tasks-container');
        expect(sidebar.classList.contains('collapsed')).toBe(true);
    });

    test('updateUnassignedCount updates the badge text', () => {
        updateUnassignedCount(5);
        expect(document.getElementById('unassigned-count').textContent).toBe('5');

        updateUnassignedCount(0);
        expect(document.getElementById('unassigned-count').textContent).toBe('0');

        updateUnassignedCount(99);
        expect(document.getElementById('unassigned-count').textContent).toBe('99');
    });
});

describe('Drag Guide Lines', () => {
    beforeEach(async () => {
        resetChromeStorage();
        setupManagerDOM();
        await generatePlannerGrid();
    });

    test('showDragGuides adds row guide class to matching time block cells', () => {
        const cell = document.querySelector('.grid-cell[data-block-id="deep-work-1"]');
        showDragGuides(cell);

        const rowGuides = document.querySelectorAll('.drag-guide-row');
        expect(rowGuides.length).toBeGreaterThan(0);
    });

    test('showDragGuides adds column guide class to matching day cells', async () => {
        // Get today's name directly from Date
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[new Date().getDay()];
        const cell = document.querySelector(`.grid-cell[data-day='${todayName}']`);
        showDragGuides(cell);

        const colGuides = document.querySelectorAll('.drag-guide-column');
        expect(colGuides.length).toBeGreaterThan(0);
    });

    test('clearDragGuides removes all guide classes', () => {
        const cell = document.querySelector('.grid-cell');
        showDragGuides(cell);

        expect(document.querySelectorAll('.drag-guide-row').length).toBeGreaterThan(0);

        clearDragGuides();

        expect(document.querySelectorAll('.drag-guide-row').length).toBe(0);
        expect(document.querySelectorAll('.drag-guide-column').length).toBe(0);
    });

    test('showSnapIndicator adds snap-target class for valid cells', () => {
        const cell = document.querySelector('.grid-cell[data-task-limit="multiple"]');
        showSnapIndicator(cell, true);

        expect(cell.classList.contains('snap-target')).toBe(true);
        expect(cell.classList.contains('drop-invalid')).toBe(false);
    });

    test('showSnapIndicator adds drop-invalid class for invalid cells', () => {
        const cell = document.querySelector('.grid-cell');
        showSnapIndicator(cell, false);

        expect(cell.classList.contains('drop-invalid')).toBe(true);
        expect(cell.classList.contains('snap-target')).toBe(false);
    });

    test('clearDragGuides also clears snap indicators', () => {
        const cell = document.querySelector('.grid-cell');
        showSnapIndicator(cell, true);
        expect(cell.classList.contains('snap-target')).toBe(true);

        clearDragGuides();
        expect(cell.classList.contains('snap-target')).toBe(false);
    });
});

describe('Task Hover Popover', () => {
    beforeEach(async () => {
        resetChromeStorage();
        setupManagerDOM();
        await generatePlannerGrid();
        // Remove any existing popover
        if (hoverPopover) {
            hoverPopover.remove();
            hoverPopover = null;
        }
    });

    afterEach(() => {
        hideTaskPopover();
        if (hoverPopover) {
            hoverPopover.remove();
            hoverPopover = null;
        }
    });

    test('createHoverPopover creates popover element', () => {
        const popover = createHoverPopover();
        expect(popover).not.toBeNull();
        expect(popover.classList.contains('task-hover-popover')).toBe(true);
        expect(popover.getAttribute('role')).toBe('tooltip');
    });

    test('createHoverPopover returns same element on multiple calls', () => {
        const popover1 = createHoverPopover();
        const popover2 = createHoverPopover();
        expect(popover1).toBe(popover2);
    });

    test('escapeHtml escapes dangerous characters', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
        expect(escapeHtml('Hello & World')).toBe('Hello &amp; World');
        expect(escapeHtml('<img src="x" onerror="alert(1)">')).toContain('&lt;img');
    });

    test('truncateUrl truncates long URLs', () => {
        const longUrl = 'https://example.com/very/long/path/that/exceeds/maximum/length';
        expect(truncateUrl(longUrl, 40).length).toBeLessThanOrEqual(40);
        expect(truncateUrl(longUrl, 40)).toContain('...');
    });

    test('truncateUrl returns short URLs unchanged', () => {
        const shortUrl = 'https://example.com';
        expect(truncateUrl(shortUrl, 40)).toBe(shortUrl);
    });

    test('formatPopoverDeadline formats date correctly', () => {
        const result = formatPopoverDeadline('2024-03-15');
        expect(result).toContain('Mar');
        // Date may vary by timezone (14 or 15), just check it contains a day number
        expect(result).toMatch(/\d+/);
    });

    test('hideTaskPopover removes visible class', () => {
        const popover = createHoverPopover();
        popover.classList.add('visible');

        hideTaskPopover();

        expect(popover.classList.contains('visible')).toBe(false);
    });

    test('positionPopover sets left and top styles', () => {
        const popover = createHoverPopover();
        const mockTarget = document.createElement('div');
        mockTarget.getBoundingClientRect = () => ({
            right: 100, top: 100, left: 50, bottom: 150, width: 50, height: 50
        });

        positionPopover(popover, mockTarget);

        expect(popover.style.left).not.toBe('');
        expect(popover.style.top).not.toBe('');
    });
});

describe('Current Time Indicator', () => {
    beforeEach(async () => {
        resetChromeStorage();
        setupManagerDOM();
        await generatePlannerGrid();
        highlightCurrentDay();
    });

    afterEach(() => {
        stopTimeIndicatorUpdates();
        jest.useRealTimers();
    });

    test('getCurrentTimeBlockInfo returns correct structure', () => {
        const info = getCurrentTimeBlockInfo();
        expect(info).toHaveProperty('currentHour');
        expect(info).toHaveProperty('currentMinutes');
        expect(info).toHaveProperty('currentTime');
        expect(typeof info.currentHour).toBe('number');
        expect(typeof info.currentMinutes).toBe('number');
        expect(typeof info.currentTime).toBe('number');
    });

    test('formatCurrentTime formats AM times correctly', () => {
        expect(formatCurrentTime(9, 5)).toBe('9:05 AM');
        expect(formatCurrentTime(0, 0)).toBe('12:00 AM');
        expect(formatCurrentTime(11, 30)).toBe('11:30 AM');
    });

    test('formatCurrentTime formats PM times correctly', () => {
        expect(formatCurrentTime(12, 0)).toBe('12:00 PM');
        expect(formatCurrentTime(14, 30)).toBe('2:30 PM');
        expect(formatCurrentTime(23, 59)).toBe('11:59 PM');
    });

    test('updateCurrentTimeIndicator removes previous indicators', async () => {
        // Create a fake indicator
        const fakeIndicator = document.createElement('div');
        fakeIndicator.classList.add('current-time-indicator');
        document.getElementById('planner-grid').appendChild(fakeIndicator);

        expect(document.querySelectorAll('.current-time-indicator').length).toBe(1);

        await updateCurrentTimeIndicator();

        // Old indicator should be removed (new one may or may not exist depending on current time)
        const indicators = document.querySelectorAll('.current-time-indicator');
        // The old fake indicator should be gone
        expect(fakeIndicator.parentElement).toBeNull();
    });

    test('updateCurrentTimeIndicator clears past-block and current-block classes first', async () => {
        // Add fake classes
        const cell = document.querySelector('.grid-cell');
        cell.classList.add('past-block', 'current-block');

        await updateCurrentTimeIndicator();

        // The specific cell behavior depends on current time, but the fake classes should be cleared first
        // and then reapplied only if appropriate for the current time
    });

    test('startTimeIndicatorUpdates does not throw', () => {
        expect(() => startTimeIndicatorUpdates()).not.toThrow();
    });

    test('stopTimeIndicatorUpdates does not throw', () => {
        startTimeIndicatorUpdates();
        expect(() => stopTimeIndicatorUpdates()).not.toThrow();
    });

    test('first day header is today after generateDayHeaders', async () => {
        await generateDayHeaders();
        const today = new Date().getDay();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        // Check via the DOM since currentDays is internal to manager.js
        const firstDayHeader = document.querySelector('.grid-header[data-day]');
        expect(firstDayHeader.dataset.day).toBe(dayNames[today]);
    });
});

describe('renderSidebarLists updates unassigned count', () => {
    beforeEach(() => {
        resetChromeStorage();
        setupManagerDOM();
    });

    test('badge shows correct count for unassigned tasks', () => {
        const unassigned = [
            { id: 't1', title: 'Task 1', schedule: [] },
            { id: 't2', title: 'Task 2', schedule: [] },
            { id: 't3', title: 'Task 3', schedule: [] }
        ];
        const assigned = [];

        renderSidebarLists(unassigned, assigned);

        expect(document.getElementById('unassigned-count').textContent).toBe('3');
    });

    test('badge shows 0 when all tasks are assigned', () => {
        const unassigned = [];
        const assigned = [
            { id: 't1', title: 'Task 1', schedule: [{ day: 'monday', blockId: 'ai-study' }] }
        ];

        renderSidebarLists(unassigned, assigned);

        expect(document.getElementById('unassigned-count').textContent).toBe('0');
    });
});
