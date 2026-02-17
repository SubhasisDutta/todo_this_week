// tests/manager.test.js
require('./mocks/chrome.storage.mock');
const path = require('path');

// Load task_utils first (dependency)
loadScript(path.join(__dirname, '..', 'task_utils.js'), [
    'TIME_BLOCKS', 'Task', 'getTasks', 'saveTasks', 'addNewTask', 'getTaskById',
    'updateTaskCompletion', 'updateTask', 'deleteTask', 'showInfoMessage',
    'getTasksAsync', 'saveTasksAsync', 'withTaskLock', 'validateTask', 'isValidUrl',
    'debounce', 'setupStorageSync', '_lastSaveTimestamp'
]);

// Setup manager HTML before loading manager.js
function setupManagerDOM() {
    document.body.innerHTML = `
        <div class="container manager-container">
            <h1>Weekly Task Planner</h1>
            <div id="info-message-area" class="info-message" style="display: none;" role="status" aria-live="polite"></div>

            <div class="tabs" role="tablist">
                <button class="tab-link active" data-tab="weekly-schedule" role="tab" aria-selected="true">SCHEDULE</button>
                <button class="tab-link" data-tab="task-lists" role="tab" aria-selected="false">PRIORITY</button>
                <button class="tab-link" data-tab="all-tasks" role="tab" aria-selected="false">LOCATION</button>
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
            </div>

            <div class="feature-container">
                <button id="export-tasks-btn" class="neumorphic-btn">Export Tasks</button>
                <button id="import-tasks-btn" class="neumorphic-btn">Import Tasks</button>
                <input type="file" id="import-file-input" style="display: none;" accept=".json">
            </div>
        </div>
    `;
}

// Mock confirm
global.confirm = jest.fn(() => true);

// Manager exports list
const MANAGER_EXPORTS = [
    'DAYS', 'currentDays', 'renderPage', 'generateDayHeaders', 'generatePlannerGrid',
    'setupFeatureListeners', 'highlightCurrentDay', 'setupSchedulingListeners',
    'clearPlannerTasks', 'clearPriorityLists', 'clearHomeWorkLists',
    'renderSidebarLists', 'renderTasksOnGrid', 'renderPriorityLists', 'renderHomeWorkLists',
    'createTaskElement', 'setupTabSwitching', 'setupCoreFeatureListeners',
    'setupDragAndDropListeners', 'setupTaskManagementListeners', 'setupAllListeners'
];

beforeEach(() => {
    resetChromeStorage();
    setupManagerDOM();
    // Load manager.js with DOMContentLoaded stripped (converted to __initFn__)
    loadScript(path.join(__dirname, '..', 'manager.js'), MANAGER_EXPORTS, { stripDOMContentLoaded: true });
    // Don't auto-call __initFn__() - tests will call specific setup functions as needed
});

describe('generateDayHeaders', () => {
    test('creates 8 headers (time + 7 days)', () => {
        generateDayHeaders();
        const headers = document.querySelectorAll('.grid-header');
        expect(headers.length).toBe(8);
    });

    test('first header is "Time"', () => {
        generateDayHeaders();
        const headers = document.querySelectorAll('.grid-header');
        expect(headers[0].textContent).toBe('Time');
    });

    test('starts from today', () => {
        generateDayHeaders();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[new Date().getDay()];
        // Check the first day header's data-day attribute matches today
        const firstDayHeader = document.querySelectorAll('.grid-header[data-day]')[0];
        expect(firstDayHeader.dataset.day).toBe(todayName);
    });

    test('sets data-day attributes on day headers', () => {
        generateDayHeaders();
        const headers = document.querySelectorAll('.grid-header[data-day]');
        expect(headers.length).toBe(7);
    });
});

describe('generatePlannerGrid', () => {
    test('creates grid cells for each time block and day', () => {
        generatePlannerGrid();
        const cells = document.querySelectorAll('.grid-cell');
        expect(cells.length).toBe(TIME_BLOCKS.length * 7);
    });

    test('creates time labels for each block', () => {
        generatePlannerGrid();
        const labels = document.querySelectorAll('.time-label');
        expect(labels.length).toBe(TIME_BLOCKS.length);
    });

    test('cells have correct data attributes', () => {
        generatePlannerGrid();
        const firstCell = document.querySelector('.grid-cell');
        expect(firstCell.dataset.day).toBeDefined();
        expect(firstCell.dataset.blockId).toBeDefined();
        expect(firstCell.dataset.taskLimit).toBeDefined();
    });

    test('cells have color classes from TIME_BLOCKS', () => {
        generatePlannerGrid();
        const sakuraCells = document.querySelectorAll('.grid-cell.block-color-sakura');
        expect(sakuraCells.length).toBe(7);
    });
});

describe('createTaskElement', () => {
    test('creates element with priority class', () => {
        const task = { id: 't1', title: 'Test', priority: 'CRITICAL', completed: false, type: 'home', energy: 'low', schedule: [] };
        const el = createTaskElement(task);
        expect(el.classList.contains('priority-CRITICAL')).toBe(true);
    });

    test('adds completed class', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: true, type: 'home', energy: 'low', schedule: [] };
        const el = createTaskElement(task);
        expect(el.classList.contains('task-completed')).toBe(true);
    });

    test('adds energy class for incomplete tasks', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'high', schedule: [] };
        const el = createTaskElement(task);
        expect(el.classList.contains('energy-high-incomplete')).toBe(true);
    });

    test('renders checkbox in management context', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [] };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 1 });
        expect(el.querySelector('.task-complete-checkbox')).not.toBeNull();
    });

    test('renders edit and delete buttons in management context', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [] };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 1 });
        expect(el.querySelector('.edit-task-btn-list')).not.toBeNull();
        expect(el.querySelector('.delete-task-btn-list')).not.toBeNull();
    });

    test('renders move up button when not first', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [] };
        const el = createTaskElement(task, { context: 'management', index: 1, total: 3 });
        expect(el.querySelector('.move-task-up-btn')).not.toBeNull();
    });

    test('does not render move up button for first item', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [] };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 3 });
        expect(el.querySelector('.move-task-up-btn')).toBeNull();
    });

    test('renders move down button when not last', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [] };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 3 });
        expect(el.querySelector('.move-task-down-btn')).not.toBeNull();
    });

    test('does not render move down button for last item', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [] };
        const el = createTaskElement(task, { context: 'management', index: 2, total: 3 });
        expect(el.querySelector('.move-task-down-btn')).toBeNull();
    });

    test('sidebar context makes items draggable', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [] };
        const el = createTaskElement(task, { context: 'sidebar' });
        expect(el.getAttribute('draggable')).toBe('true');
    });

    test('grid context makes items draggable', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [] };
        const el = createTaskElement(task, { context: 'grid' });
        expect(el.getAttribute('draggable')).toBe('true');
    });

    test('management context does not make items draggable', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [] };
        const el = createTaskElement(task, { context: 'management', index: 0, total: 1 });
        expect(el.getAttribute('draggable')).toBeNull();
    });

    test('shows type icon', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'work', energy: 'low', schedule: [] };
        const el = createTaskElement(task, { context: 'sidebar' });
        const icon = el.querySelector('.task-type-icon');
        expect(icon).not.toBeNull();
    });

    test('sidebar assigned shows toggle button', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [{ day: 'monday', blockId: 'ai-study', completed: false }] };
        const el = createTaskElement(task, { context: 'sidebar', isAssigned: true });
        expect(el.querySelector('.toggle-schedule-btn')).not.toBeNull();
    });

    test('sidebar shows schedule button', () => {
        const task = { id: 't1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [] };
        const el = createTaskElement(task, { context: 'sidebar' });
        expect(el.querySelector('.schedule-task-btn')).not.toBeNull();
    });
});

describe('renderSidebarLists', () => {
    test('renders unassigned tasks', () => {
        const unassigned = [
            { id: 't1', title: 'Task 1', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [] },
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
            { id: 't1', title: 'Task 1', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', schedule: [{ day: 'monday', blockId: 'ai-study', completed: false }], displayOrder: 0 },
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
            { id: 't1', title: 'Critical', priority: 'CRITICAL', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [], deadline: '2025-12-01' },
            { id: 't2', title: 'Important', priority: 'IMPORTANT', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [] },
            { id: 't3', title: 'Someday', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [] },
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
            { id: 't1', title: 'Second', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 1, schedule: [] },
            { id: 't2', title: 'First', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [] },
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
            { id: 't1', title: 'Home', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [] },
            { id: 't2', title: 'Work', priority: 'SOMEDAY', completed: false, type: 'work', energy: 'low', displayOrder: 0, schedule: [] },
        ];
        renderHomeWorkLists(tasks);
        expect(document.getElementById('home-tasks-list').querySelectorAll('.task-item').length).toBe(1);
        expect(document.getElementById('work-tasks-list').querySelectorAll('.task-item').length).toBe(1);
    });

    test('sorts by priority then displayOrder', () => {
        const tasks = [
            { id: 't1', title: 'Someday', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [] },
            { id: 't2', title: 'Critical', priority: 'CRITICAL', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [], deadline: '2025-12-01' },
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
    test('places tasks in correct grid cells', () => {
        generatePlannerGrid();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[new Date().getDay()];
        const tasks = [{
            id: 't1', title: 'Grid Task', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low',
            schedule: [{ day: todayName, blockId: 'ai-study', completed: false }]
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

    test('clears grid cells but preserves labels', () => {
        generatePlannerGrid();
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
        generatePlannerGrid();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayNames[new Date().getDay()];

        seedTasks([
            { id: 't1', title: 'Unassigned', priority: 'SOMEDAY', completed: false, type: 'home', energy: 'low', displayOrder: 0, schedule: [] },
            { id: 't2', title: 'Assigned', priority: 'IMPORTANT', completed: false, type: 'work', energy: 'high', displayOrder: 0, schedule: [{ day: todayName, blockId: 'ai-study', completed: false }] },
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
    test('highlights today header and cells', () => {
        generatePlannerGrid();
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
