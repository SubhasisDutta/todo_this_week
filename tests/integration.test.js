// tests/integration.test.js
require('./mocks/chrome.storage.mock');
const path = require('path');

// Load task_utils
loadScript(path.join(__dirname, '..', 'task_utils.js'), [
    'TIME_BLOCKS', 'Task', 'getTasks', 'saveTasks', 'addNewTask', 'getTaskById',
    'updateTaskCompletion', 'updateTask', 'deleteTask', 'showInfoMessage',
    'getTasksAsync', 'saveTasksAsync', 'withTaskLock', 'validateTask', 'isValidUrl',
    'debounce', 'setupStorageSync', '_lastSaveTimestamp'
]);

beforeEach(() => {
    resetChromeStorage();
    document.body.innerHTML = '<div id="info-message-area" class="info-message" style="display: none;"></div>';
});

describe('End-to-end: Task lifecycle', () => {
    test('add task -> retrieve -> update -> verify', async () => {
        const newTask = await addNewTask('Integration Test', 'https://example.com', 'IMPORTANT', null, 'work', 'high');
        expect(newTask).not.toBeNull();
        expect(newTask.title).toBe('Integration Test');
        expect(newTask.priority).toBe('IMPORTANT');

        const retrieved = await getTaskById(newTask.id);
        expect(retrieved).toBeDefined();
        expect(retrieved.title).toBe('Integration Test');
        expect(retrieved.type).toBe('work');
        expect(retrieved.energy).toBe('high');

        retrieved.title = 'Updated Title';
        retrieved.priority = 'CRITICAL';
        retrieved.deadline = '2025-12-31';
        const updateResult = await updateTask(retrieved);
        expect(updateResult).toBe(true);

        const afterUpdate = await getTaskById(newTask.id);
        expect(afterUpdate.title).toBe('Updated Title');
        expect(afterUpdate.priority).toBe('CRITICAL');
        expect(afterUpdate.deadline).toBe('2025-12-31');
    });

    test('add task -> delete -> verify removed', async () => {
        const task = await addNewTask('To Delete', '', 'SOMEDAY', null, 'home', 'low');
        expect(task).not.toBeNull();

        const deleteResult = await deleteTask(task.id);
        expect(deleteResult).toBe(true);

        const afterDelete = await getTaskById(task.id);
        expect(afterDelete).toBeUndefined();
    });

    test('add task -> complete -> verify completion status', async () => {
        const task = await addNewTask('Complete Me', '', 'SOMEDAY', null, 'home', 'low');
        expect(task).not.toBeNull();

        const retrieved = await getTaskById(task.id);
        retrieved.completed = true;
        await updateTask(retrieved);

        const allTasks = await getTasksAsync();
        const active = allTasks.filter(t => !t.completed);
        const completed = allTasks.filter(t => t.completed);
        expect(active.length).toBe(0);
        expect(completed.length).toBe(1);
    });
});

describe('End-to-end: Schedule management', () => {
    test('add task -> schedule -> verify schedule', async () => {
        const task = await addNewTask('Schedulable', '', 'SOMEDAY', null, 'home', 'low');
        expect(task).not.toBeNull();

        const retrieved = await getTaskById(task.id);
        retrieved.schedule = [
            { day: 'monday', blockId: 'ai-study', completed: false },
            { day: 'wednesday', blockId: 'deep-work-1', completed: false },
        ];
        await updateTask(retrieved);

        const afterSchedule = await getTaskById(task.id);
        expect(afterSchedule.schedule.length).toBe(2);
        expect(afterSchedule.schedule[0].day).toBe('monday');
        expect(afterSchedule.schedule[1].day).toBe('wednesday');
    });

    test('cascade completion: completing all schedule items completes the task', async () => {
        const task = await addNewTask('Cascading', '', 'SOMEDAY', null, 'home', 'low');

        const retrieved = await getTaskById(task.id);
        retrieved.schedule = [
            { day: 'monday', blockId: 'ai-study', completed: false },
            { day: 'tuesday', blockId: 'deep-work-1', completed: false },
        ];
        await updateTask(retrieved);

        // Complete first schedule item
        const afterFirst = await getTaskById(task.id);
        afterFirst.schedule[0].completed = true;
        await updateTask(afterFirst);

        const partialComplete = await getTaskById(task.id);
        expect(partialComplete.completed).toBe(false);

        // Complete second schedule item
        partialComplete.schedule[1].completed = true;
        await updateTask(partialComplete);

        const fullyComplete = await getTaskById(task.id);
        expect(fullyComplete.completed).toBe(true);
    });
});

describe('End-to-end: Multiple tasks and ordering', () => {
    test('tasks maintain displayOrder within priority group', async () => {
        await addNewTask('First', '', 'SOMEDAY', null, 'home', 'low');
        await addNewTask('Second', '', 'SOMEDAY', null, 'home', 'low');
        await addNewTask('Third', '', 'SOMEDAY', null, 'home', 'low');

        const tasks = await getTasksAsync();
        const somedayTasks = tasks.filter(t => t.priority === 'SOMEDAY').sort((a, b) => a.displayOrder - b.displayOrder);

        expect(somedayTasks[0].title).toBe('First');
        expect(somedayTasks[1].title).toBe('Second');
        expect(somedayTasks[2].title).toBe('Third');
        expect(somedayTasks[0].displayOrder).toBeLessThan(somedayTasks[1].displayOrder);
        expect(somedayTasks[1].displayOrder).toBeLessThan(somedayTasks[2].displayOrder);
    });

    test('reorder tasks by swapping displayOrder', async () => {
        await addNewTask('First', '', 'SOMEDAY', null, 'home', 'low');
        await addNewTask('Second', '', 'SOMEDAY', null, 'home', 'low');

        const tasks = await getTasksAsync();
        const sorted = tasks.filter(t => t.priority === 'SOMEDAY').sort((a, b) => a.displayOrder - b.displayOrder);

        const tempOrder = sorted[0].displayOrder;
        sorted[0].displayOrder = sorted[1].displayOrder;
        sorted[1].displayOrder = tempOrder;

        await saveTasksAsync(tasks);

        const afterReorder = await getTasksAsync();
        const reSorted = afterReorder.filter(t => t.priority === 'SOMEDAY').sort((a, b) => a.displayOrder - b.displayOrder);

        expect(reSorted[0].title).toBe('Second');
        expect(reSorted[1].title).toBe('First');
    });
});

describe('End-to-end: Import/merge logic', () => {
    test('import merges with existing tasks', async () => {
        await addNewTask('Existing Task', '', 'SOMEDAY', null, 'home', 'low');
        const existing = await getTasksAsync();
        const existingId = existing[0].id;

        const importedTasks = [
            { ...existing[0], title: 'Updated Existing' },
            { id: 'new-imported', title: 'New Import', priority: 'IMPORTANT', completed: false, type: 'work', displayOrder: 0, schedule: [], energy: 'high' },
        ];

        const existingTasks = await getTasksAsync();
        const existingTaskIds = new Set(existingTasks.map(t => t.id));
        const tasksToCreate = [];
        const tasksToUpdate = [];

        for (const imported of importedTasks) {
            if (!imported.id || !imported.title) continue;
            if (existingTaskIds.has(imported.id)) {
                tasksToUpdate.push(imported);
            } else {
                tasksToCreate.push(imported);
            }
        }

        const updatedTasks = existingTasks.map(et => {
            const toUpdate = tasksToUpdate.find(t => t.id === et.id);
            return toUpdate ? toUpdate : et;
        });

        const finalTasks = [...updatedTasks, ...tasksToCreate];
        await saveTasksAsync(finalTasks);

        const result = await getTasksAsync();
        expect(result.length).toBe(2);

        const updated = result.find(t => t.id === existingId);
        expect(updated.title).toBe('Updated Existing');

        const newImport = result.find(t => t.id === 'new-imported');
        expect(newImport).toBeDefined();
        expect(newImport.title).toBe('New Import');
    });
});

describe('End-to-end: Validation', () => {
    test('validateTask catches multiple errors', () => {
        const errors = validateTask({
            title: '',
            priority: 'CRITICAL',
            deadline: null,
            url: 'not-a-url',
        });
        expect(errors.length).toBe(3);
        expect(errors).toContain('Task title is required.');
        expect(errors).toContain('Deadline is required for CRITICAL tasks.');
        expect(errors).toContain('Invalid URL format.');
    });

    test('valid CRITICAL task passes validation', () => {
        const errors = validateTask({
            title: 'Valid Task',
            priority: 'CRITICAL',
            deadline: '2025-12-31',
            url: 'https://example.com',
        });
        expect(errors.length).toBe(0);
    });
});

describe('End-to-end: Cross-tab sync', () => {
    test('storage change listener ignores self-triggered changes', () => {
        // NOTE: This test MUST run before "fires for external changes" since
        // saveTasks sets the internal _lastSaveTimestamp which is shared state.
        const renderCallback = jest.fn();

        // Save tasks to set the internal _lastSaveTimestamp to now
        saveTasks([{ id: 't1', title: 'Test' }], () => {});

        // Setup sync - the listener will see the recent save timestamp
        setupStorageSync(renderCallback);

        const listenerCalls = chrome.storage.onChanged.addListener.mock.calls;
        const listener = listenerCalls[listenerCalls.length - 1][0];
        const changes = { tasks: { newValue: [{ id: 't1', title: 'Self' }] } };
        listener(changes, 'local');

        expect(renderCallback).not.toHaveBeenCalled();
    });

    test('storage change listener fires for external changes after debounce window', (done) => {
        const renderCallback = jest.fn();
        setupStorageSync(renderCallback);

        // Wait for 600ms so the internal _lastSaveTimestamp is > 500ms ago
        setTimeout(() => {
            const listenerCalls = chrome.storage.onChanged.addListener.mock.calls;
            const listener = listenerCalls[listenerCalls.length - 1][0];
            const changes = { tasks: { newValue: [{ id: 't1', title: 'External' }] } };
            listener(changes, 'local');

            expect(renderCallback).toHaveBeenCalled();
            done();
        }, 600);
    }, 10000);
});
