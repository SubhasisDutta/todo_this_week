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
    'createRecurringInstance'
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
        <div id="task-lists" class="tab-content active">
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
        <div id="planner-grid"></div>
        <div id="unassigned-tasks-list"></div>
        <div id="assigned-tasks-list"></div>
        <div id="archive-list"></div>
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
    'applySearchFilter', 'setupPrioritySearch', 'setupLocationSearch',
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
