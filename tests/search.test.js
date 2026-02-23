// tests/search.test.js — Tests for applySearchFilter and search setup functions
require('./mocks/chrome.storage.mock');
const path = require('path');

loadScript(path.join(__dirname, '..', 'task_utils.js'), [
    'DEFAULT_TIME_BLOCKS', 'TIME_BLOCKS', 'DEFAULT_SETTINGS',
    'Task', 'getTasks', 'saveTasks', 'addNewTask', 'getTaskById',
    'updateTaskCompletion', 'updateTask', 'deleteTask', 'showInfoMessage',
    'getTasksAsync', 'saveTasksAsync', 'withTaskLock', 'validateTask', 'isValidUrl',
    'debounce', 'setupStorageSync', '_lastSaveTimestamp',
    'getSettings', 'saveSettings', 'seedSampleTasks',
    'getTimeBlocks', 'saveTimeBlocks',
    'pushUndoState', 'undo', 'redo',
    'createRecurringInstance',
    'deriveCompletedFromStatus', 'deriveStatusFromCompleted'
]);

loadScript(path.join(__dirname, '..', 'settings.js'), [
    'applySettings', 'initSettings',
    'openSettingsModal', 'closeSettingsModal',
    'setupSettingsModalListeners'
]);

// Setup DOM for search tests
function setupSearchDOM() {
    document.body.innerHTML = `
        <div id="info-message-area" class="info-message" style="display: none;"></div>
        <div id="weekly-schedule" class="tab-content active">
            <div class="schedule-tab-header">
                <div class="search-bar-container">
                    <input type="search" id="schedule-search-input" placeholder="Search tasks...">
                    <button id="schedule-search-clear">Clear</button>
                </div>
            </div>
            <div id="planner-grid">
                <div class="grid-cell"><div class="task-item"><span class="task-title">Grid Task Alpha</span></div></div>
            </div>
            <div id="unassigned-tasks-list"></div>
            <div id="assigned-tasks-list"></div>
        </div>
        <div id="task-lists" class="tab-content">
            <div class="search-bar-container">
                <input type="search" id="priority-search-input" placeholder="Search tasks...">
                <button id="priority-search-clear">Clear</button>
            </div>
            <div id="critical-tasks-list" class="task-list"></div>
            <div id="important-tasks-list" class="task-list"></div>
            <div id="someday-tasks-list" class="task-list"></div>
        </div>
        <div id="all-tasks" class="tab-content">
            <div class="search-bar-container">
                <input type="search" id="location-search-input" placeholder="Search tasks...">
                <button id="location-search-clear">Clear</button>
            </div>
            <div id="home-tasks-list" class="task-list"></div>
            <div id="work-tasks-list" class="task-list"></div>
        </div>
        <div id="settings-modal" class="modal-overlay hidden"></div>
        <div id="help-modal" class="modal-overlay hidden"></div>
        <div id="undo-toast" style="display:none;">
            <span id="undo-toast-message"></span>
            <button id="undo-toast-btn">Undo</button>
        </div>
        <div id="archive-tab" class="tab-content">
            <div class="archive-header">
                <h2>Completed Tasks Archive</h2>
                <div class="archive-header-actions">
                    <div class="search-bar-container">
                        <input type="search" id="archive-search-input" placeholder="Search archived tasks...">
                        <button id="archive-search-clear">Clear</button>
                    </div>
                </div>
            </div>
            <div id="archive-list"></div>
        </div>
        <div id="stats-content"></div>
    `;
}

// Load manager after DOM is set up in each test
const MANAGER_EXPORTS = [
    'DAYS', 'currentDays', 'renderPage', 'generateDayHeaders', 'generatePlannerGrid',
    'setupSettingsListeners', 'setupHelpListeners', 'highlightCurrentDay',
    'setupSchedulingListeners', 'setupArchiveListeners',
    'clearPlannerTasks', 'clearPriorityLists', 'clearHomeWorkLists',
    'renderSidebarLists', 'renderTasksOnGrid', 'renderPriorityLists', 'renderHomeWorkLists',
    'createTaskElement', 'setupTabSwitching', 'setupCoreFeatureListeners',
    'setupDragAndDropListeners', 'setupTaskManagementListeners', 'setupAllListeners',
    'renderArchiveTab', 'renderStatsTab',
    'getCompletedInRange', 'calculateStreak', 'getPeakHours', 'getFocusDistribution', 'getBlockDistribution', 'getStaleTasks',
    'applySearchFilter', 'setupScheduleSearch', 'setupPrioritySearch', 'setupLocationSearch', 'setupArchiveSearch',
    'showUndoToast', 'setupUndoKeyboardListeners'
];

beforeEach(() => {
    resetChromeStorage();
    setupSearchDOM();
    loadScript(path.join(__dirname, '..', 'manager.js'), MANAGER_EXPORTS, { stripDOMContentLoaded: true });
});

describe('applySearchFilter', () => {
    test('hides tasks that do not match query', () => {
        const container = document.getElementById('someday-tasks-list');
        container.innerHTML = `
            <div class="task-item"><span class="task-title">Buy grocery items</span></div>
            <div class="task-item"><span class="task-title">Read book</span></div>
            <div class="task-item"><span class="task-title">Go grocery shopping</span></div>
        `;
        applySearchFilter('grocery', [container]);
        const items = container.querySelectorAll('.task-item');
        expect(items[0].style.display).not.toBe('none'); // "Buy grocery items" matches
        expect(items[1].style.display).toBe('none');     // "Read book" hidden
        expect(items[2].style.display).not.toBe('none'); // "Go grocery shopping" matches
    });

    test('shows all items when query is empty string', () => {
        const container = document.getElementById('someday-tasks-list');
        container.innerHTML = `
            <div class="task-item" style="display:none;"><span class="task-title">Hidden Task</span></div>
            <div class="task-item" style="display:none;"><span class="task-title">Another Task</span></div>
        `;
        applySearchFilter('', [container]);
        const items = container.querySelectorAll('.task-item');
        items.forEach(item => {
            expect(item.style.display).not.toBe('none');
        });
    });

    test('search is case insensitive', () => {
        const container = document.getElementById('someday-tasks-list');
        container.innerHTML = `
            <div class="task-item"><span class="task-title">BUY GROCERIES</span></div>
        `;
        applySearchFilter('groceries', [container]);
        expect(container.querySelector('.task-item').style.display).not.toBe('none');
    });

    test('applies filter across multiple containers', () => {
        const c1 = document.getElementById('home-tasks-list');
        const c2 = document.getElementById('work-tasks-list');
        c1.innerHTML = '<div class="task-item"><span class="task-title">home report</span></div>';
        c2.innerHTML = '<div class="task-item"><span class="task-title">work report</span></div>';

        applySearchFilter('report', [c1, c2]);
        expect(c1.querySelector('.task-item').style.display).not.toBe('none');
        expect(c2.querySelector('.task-item').style.display).not.toBe('none');
    });

    test('hides all items when no match', () => {
        const container = document.getElementById('someday-tasks-list');
        container.innerHTML = `
            <div class="task-item"><span class="task-title">Alpha task</span></div>
            <div class="task-item"><span class="task-title">Beta task</span></div>
        `;
        applySearchFilter('zzz-no-match', [container]);
        const items = container.querySelectorAll('.task-item');
        items.forEach(item => {
            expect(item.style.display).toBe('none');
        });
    });

    test('partial match works', () => {
        const container = document.getElementById('someday-tasks-list');
        container.innerHTML = `
            <div class="task-item"><span class="task-title">Review quarterly report</span></div>
        `;
        applySearchFilter('quart', [container]);
        expect(container.querySelector('.task-item').style.display).not.toBe('none');
    });
});

describe('setupPrioritySearch', () => {
    test('sets up search input without throwing', () => {
        expect(() => setupPrioritySearch()).not.toThrow();
    });

    test('priority search input exists in DOM', () => {
        expect(document.getElementById('priority-search-input')).not.toBeNull();
    });
});

describe('setupLocationSearch', () => {
    test('sets up search input without throwing', () => {
        expect(() => setupLocationSearch()).not.toThrow();
    });

    test('location search input exists in DOM', () => {
        expect(document.getElementById('location-search-input')).not.toBeNull();
    });
});

describe('setupScheduleSearch', () => {
    test('sets up search input without throwing', () => {
        expect(() => setupScheduleSearch()).not.toThrow();
    });

    test('schedule search input exists in DOM', () => {
        expect(document.getElementById('schedule-search-input')).not.toBeNull();
    });
});

describe('setupArchiveSearch', () => {
    test('sets up search input without throwing', () => {
        expect(() => setupArchiveSearch()).not.toThrow();
    });

    test('archive search input exists in DOM', () => {
        expect(document.getElementById('archive-search-input')).not.toBeNull();
    });

    test('filters archive tasks by title', () => {
        const archiveList = document.getElementById('archive-list');
        archiveList.innerHTML = `
            <div class="task-item"><span class="task-title">Buy groceries</span></div>
            <div class="task-item"><span class="task-title">Read book</span></div>
        `;

        setupArchiveSearch();
        const input = document.getElementById('archive-search-input');
        input.value = 'groceries';
        input.dispatchEvent(new Event('input'));

        // Wait for debounce
        return new Promise(resolve => setTimeout(resolve, 350)).then(() => {
            const items = archiveList.querySelectorAll('.task-item');
            expect(items[0].style.display).not.toBe('none');
            expect(items[1].style.display).toBe('none');
        });
    });
});

describe('applySearchFilter with grid cells', () => {
    test('filters tasks in grid cells when includeGridCells is true', () => {
        const container = document.getElementById('unassigned-tasks-list');
        container.innerHTML = '<div class="task-item"><span class="task-title">Sidebar Task Beta</span></div>';

        // Grid cell already has "Grid Task Alpha" from setupSearchDOM
        applySearchFilter('Alpha', [container], true);

        const sidebarItem = container.querySelector('.task-item');
        expect(sidebarItem.style.display).toBe('none'); // "Sidebar Task Beta" hidden

        const gridItem = document.querySelector('.grid-cell .task-item');
        expect(gridItem.style.display).not.toBe('none'); // "Grid Task Alpha" visible
    });

    test('shows all grid cell tasks when query is empty', () => {
        const gridItem = document.querySelector('.grid-cell .task-item');
        gridItem.style.display = 'none';

        applySearchFilter('', [], true);
        expect(gridItem.style.display).not.toBe('none');
    });
});
