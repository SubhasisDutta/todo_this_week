// tests/popup.test.js
require('./mocks/chrome.storage.mock');
const path = require('path');

// Load task_utils first (dependency)
loadScript(path.join(__dirname, '..', 'task_utils.js'), [
    'TIME_BLOCKS', 'Task', 'getTasks', 'saveTasks', 'addNewTask', 'getTaskById',
    'updateTaskCompletion', 'updateTask', 'deleteTask', 'showInfoMessage',
    'getTasksAsync', 'saveTasksAsync', 'withTaskLock', 'validateTask', 'isValidUrl',
    'debounce', 'setupStorageSync', '_lastSaveTimestamp'
]);

// Setup popup HTML before loading popup.js
function setupPopupDOM() {
    document.body.innerHTML = `
        <div class="container">
            <div id="info-message-area" class="info-message" style="display: none;" role="status" aria-live="polite"></div>
            <div class="tabs" role="tablist">
                <button class="tab-link active" data-tab="today" role="tab" aria-selected="true">TODAY</button>
                <button class="tab-link" data-tab="display" role="tab" aria-selected="false">Display</button>
                <button class="tab-link" data-tab="add" role="tab" aria-selected="false">ADD</button>
            </div>
            <div id="today" class="tab-content active" role="tabpanel">
                <div id="today-task-list"><p>No tasks scheduled for today.</p></div>
            </div>
            <div id="display" class="tab-content" role="tabpanel">
                <div id="display-task-list"><p>No active tasks.</p></div>
            </div>
            <div id="add" class="tab-content" role="tabpanel">
                <div class="add-task-form">
                    <input type="text" id="task-title" class="neumorphic-input" placeholder="Enter task title" aria-required="true">
                    <input type="url" id="task-url" class="neumorphic-input" placeholder="Enter URL">
                    <input type="radio" id="priority-someday" name="priority" value="SOMEDAY" checked>
                    <input type="radio" id="priority-important" name="priority" value="IMPORTANT">
                    <input type="radio" id="priority-critical" name="priority" value="CRITICAL">
                    <div id="task-deadline-group" style="display: none;">
                        <input type="date" id="task-deadline" class="neumorphic-input">
                    </div>
                    <input type="radio" id="type-home" name="type" value="home" checked>
                    <input type="radio" id="type-work" name="type" value="work">
                    <input type="radio" id="energy-low" name="energy" value="low" checked>
                    <input type="radio" id="energy-high" name="energy" value="high">
                    <button id="add-task-btn" class="neumorphic-btn">Add Task</button>
                </div>
            </div>
            <button id="open-manager-btn" class="neumorphic-btn">PLANNER</button>
        </div>
    `;
}

beforeEach(() => {
    resetChromeStorage();
    setupPopupDOM();
    // Load popup.js, stripping DOMContentLoaded and exporting functions
    loadScript(path.join(__dirname, '..', 'popup.js'), [
        'createTaskItem', 'renderTasks', 'renderAllTabs',
        'setupTaskCompletionListeners', 'setupDisplayTabDragAndDropListeners'
    ], { stripDOMContentLoaded: true });
    // Call the init function to set up event listeners
    __initFn__();
});

describe('createTaskItem', () => {
    test('renders task with title text', () => {
        const task = { id: 'task1', title: 'My Task', priority: 'SOMEDAY', completed: false, energy: 'low', schedule: [] };
        const el = createTaskItem(task);
        expect(el.querySelector('.task-title').textContent).toBe('My Task');
    });

    test('renders task with URL as link', () => {
        const task = { id: 'task1', title: 'Link Task', url: 'https://example.com', priority: 'SOMEDAY', completed: false, energy: 'low', schedule: [] };
        const el = createTaskItem(task);
        const link = el.querySelector('.task-title a');
        expect(link).not.toBeNull();
        expect(link.href).toBe('https://example.com/');
        expect(link.textContent).toBe('Link Task');
        expect(link.target).toBe('_blank');
    });

    test('applies priority class', () => {
        const task = { id: 'task1', title: 'Critical Task', priority: 'CRITICAL', completed: false, energy: 'low', schedule: [] };
        const el = createTaskItem(task);
        expect(el.classList.contains('priority-CRITICAL')).toBe(true);
    });

    test('applies completed styling', () => {
        const task = { id: 'task1', title: 'Done Task', priority: 'SOMEDAY', completed: true, energy: 'low', schedule: [] };
        const el = createTaskItem(task);
        expect(el.classList.contains('task-completed')).toBe(true);
    });

    test('applies energy-low class for incomplete tasks', () => {
        const task = { id: 'task1', title: 'Low Energy', priority: 'SOMEDAY', completed: false, energy: 'low', schedule: [] };
        const el = createTaskItem(task);
        expect(el.classList.contains('energy-low-incomplete')).toBe(true);
    });

    test('applies energy-high class for incomplete tasks', () => {
        const task = { id: 'task1', title: 'High Energy', priority: 'SOMEDAY', completed: false, energy: 'high', schedule: [] };
        const el = createTaskItem(task);
        expect(el.classList.contains('energy-high-incomplete')).toBe(true);
    });

    test('renders assignment with schedule data attributes', () => {
        const item = {
            id: 'task1', title: 'Assigned', priority: 'SOMEDAY', completed: false, energy: 'low', schedule: [],
            scheduleItem: { day: 'monday', blockId: 'ai-study', completed: false }
        };
        const el = createTaskItem(item, { isAssignment: true });
        expect(el.dataset.day).toBe('monday');
        expect(el.dataset.blockId).toBe('ai-study');
        expect(el.querySelector('.assignment-complete-checkbox')).not.toBeNull();
    });

    test('renders master checkbox for non-assignment', () => {
        const task = { id: 'task1', title: 'Task', priority: 'SOMEDAY', completed: false, energy: 'low', schedule: [] };
        const el = createTaskItem(task);
        expect(el.querySelector('.task-complete-checkbox')).not.toBeNull();
    });

    test('sets data-task-id attribute', () => {
        const task = { id: 'unique-id-123', title: 'Task', priority: 'SOMEDAY', completed: false, energy: 'low', schedule: [] };
        const el = createTaskItem(task);
        expect(el.dataset.taskId).toBe('unique-id-123');
    });
});

describe('renderTasks', () => {
    test('display tab shows active tasks sorted by priority', (done) => {
        seedTasks([
            { id: 't1', title: 'Someday Task', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' },
            { id: 't2', title: 'Critical Task', priority: 'CRITICAL', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low', deadline: '2025-12-01' },
            { id: 't3', title: 'Completed Task', priority: 'IMPORTANT', completed: true, type: 'home', displayOrder: 0, schedule: [], energy: 'low' },
        ]);
        renderTasks('display');
        setTimeout(() => {
            const list = document.getElementById('display-task-list');
            const items = list.querySelectorAll('.task-item');
            expect(items.length).toBe(2); // Only active tasks
            expect(items[0].querySelector('.task-title').textContent).toBe('Critical Task');
            expect(items[1].querySelector('.task-title').textContent).toBe('Someday Task');
            done();
        }, 50);
    });

    test('display tab shows empty message when no tasks', (done) => {
        seedTasks([]);
        renderTasks('display');
        setTimeout(() => {
            const list = document.getElementById('display-task-list');
            expect(list.innerHTML).toContain('No active tasks');
            done();
        }, 50);
    });

    test('today tab shows empty message when no tasks for today', (done) => {
        seedTasks([
            { id: 't1', title: 'Task', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [{ day: 'nevermore', blockId: 'ai-study', completed: false }], energy: 'low' },
        ]);
        renderTasks('today');
        setTimeout(() => {
            const list = document.getElementById('today-task-list');
            expect(list.innerHTML).toContain('No tasks scheduled for today');
            done();
        }, 50);
    });

    test('today tab groups tasks by time block', (done) => {
        const dayMapping = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayMapping[new Date().getDay()];
        seedTasks([
            { id: 't1', title: 'Morning Task', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [{ day: todayName, blockId: 'ai-study', completed: false }], energy: 'low' },
            { id: 't2', title: 'Night Task', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [{ day: todayName, blockId: 'night-build', completed: false }], energy: 'low' },
        ]);
        renderTasks('today');
        setTimeout(() => {
            const list = document.getElementById('today-task-list');
            const headers = list.querySelectorAll('.time-block-header');
            expect(headers.length).toBe(2);
            const items = list.querySelectorAll('.task-item');
            expect(items.length).toBe(2);
            done();
        }, 50);
    });
});

describe('renderAllTabs', () => {
    test('renders both today and display tabs', (done) => {
        seedTasks([]);
        renderAllTabs();
        setTimeout(() => {
            expect(document.getElementById('today-task-list').innerHTML).toContain('No tasks scheduled');
            expect(document.getElementById('display-task-list').innerHTML).toContain('No active tasks');
            done();
        }, 50);
    });
});

describe('Tab switching', () => {
    test('tab click activates correct tab and content', () => {
        const tabs = document.querySelectorAll('.tab-link');
        const displayTab = tabs[1]; // Display tab
        displayTab.click();

        expect(displayTab.classList.contains('active')).toBe(true);
        expect(displayTab.getAttribute('aria-selected')).toBe('true');
        expect(tabs[0].classList.contains('active')).toBe(false);
        expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    });
});

describe('Add task validation', () => {
    test('shows error for empty title', () => {
        const titleInput = document.getElementById('task-title');
        titleInput.value = '';
        const addBtn = document.getElementById('add-task-btn');
        addBtn.click();
        // The click handler is async, but validation is synchronous
        setTimeout(() => {
            const messageArea = document.getElementById('info-message-area');
            expect(messageArea.textContent).toContain('Task title is required');
        }, 50);
    });
});

describe('Open manager button', () => {
    test('calls chrome.tabs.create', () => {
        const openManagerBtn = document.getElementById('open-manager-btn');
        openManagerBtn.click();
        expect(chrome.tabs.create).toHaveBeenCalled();
    });
});
