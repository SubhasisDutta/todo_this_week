// tests/features.test.js — Tests for notes, completedAt, undo/redo, recurring tasks, archive grouping
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

beforeEach(() => {
    resetChromeStorage();
    document.body.innerHTML = '<div id="info-message-area" class="info-message" style="display: none;"></div>';
});

// -------------------------------------------------------
// Notes field
// -------------------------------------------------------
describe('Notes field', () => {
    test('task stores and retrieves notes', async () => {
        const task = await addNewTask('Test', '', 'SOMEDAY', null, 'home', 'low', 'These are my notes', null);
        const retrieved = await getTaskById(task.id);
        expect(retrieved.notes).toBe('These are my notes');
    });

    test('task with no notes defaults to empty string', async () => {
        const task = await addNewTask('Test', '', 'SOMEDAY', null, 'home', 'low');
        const retrieved = await getTaskById(task.id);
        expect(retrieved.notes).toBe('');
    });

    test('notes can be updated via updateTask', async () => {
        const task = await addNewTask('Test', '', 'SOMEDAY', null, 'home', 'low', 'Original notes', null);
        const retrieved = await getTaskById(task.id);
        retrieved.notes = 'Updated notes';
        await updateTask(retrieved);

        const afterUpdate = await getTaskById(task.id);
        expect(afterUpdate.notes).toBe('Updated notes');
    });

    test('notes backfilled to empty string for old tasks', (done) => {
        seedTasks([{ id: 'old-task', title: 'Old', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' }]);
        getTasks(tasks => {
            expect(tasks[0].notes).toBe('');
            done();
        });
    });
});

// -------------------------------------------------------
// completedAt field
// -------------------------------------------------------
describe('completedAt field', () => {
    test('completedAt is null on creation', async () => {
        const task = await addNewTask('Test', '', 'SOMEDAY', null, 'home', 'low');
        expect(task.completedAt).toBeNull();
    });

    test('completedAt is set when task is completed', async () => {
        const task = await addNewTask('Test', '', 'SOMEDAY', null, 'home', 'low');
        const retrieved = await getTaskById(task.id);
        retrieved.completed = true;
        await updateTask(retrieved);

        const afterUpdate = await getTaskById(task.id);
        expect(afterUpdate.completedAt).not.toBeNull();
        // Should be a valid ISO date string
        expect(new Date(afterUpdate.completedAt).getTime()).not.toBeNaN();
    });

    test('completedAt is cleared when task is uncompleted', async () => {
        const task = await addNewTask('Test', '', 'SOMEDAY', null, 'home', 'low');
        const retrieved = await getTaskById(task.id);

        // Complete it
        retrieved.completed = true;
        await updateTask(retrieved);

        // Uncomplete it
        const completed = await getTaskById(task.id);
        completed.completed = false;
        await updateTask(completed);

        const afterUncomplete = await getTaskById(task.id);
        expect(afterUncomplete.completedAt).toBeNull();
    });

    test('completedAt backfilled to null for old tasks', (done) => {
        seedTasks([{ id: 'old-task', title: 'Old', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' }]);
        getTasks(tasks => {
            expect(tasks[0].completedAt).toBeNull();
            done();
        });
    });
});

// -------------------------------------------------------
// Undo / Redo
// -------------------------------------------------------
describe('Undo / Redo', () => {
    test('pushUndoState saves a snapshot', async () => {
        const task = await addNewTask('A', '', 'SOMEDAY', null, 'home', 'low');
        const snapshot = await getTasksAsync();
        pushUndoState(snapshot);

        // Delete the task
        await deleteTask(task.id);
        expect((await getTasksAsync()).length).toBe(0);

        // Undo restores the snapshot
        await undo();
        expect((await getTasksAsync()).length).toBe(1);
    });

    test('undo does nothing when stack is empty', async () => {
        await addNewTask('B', '', 'SOMEDAY', null, 'home', 'low');
        // Don't push anything to undo stack
        await undo(); // Should not throw
        expect((await getTasksAsync()).length).toBe(1);
    });

    test('redo does nothing when redo stack is empty', async () => {
        await addNewTask('C', '', 'SOMEDAY', null, 'home', 'low');
        // Ensure redo stack is empty by pushing a state (which clears _redoStack)
        const snapshot = await getTasksAsync();
        pushUndoState(snapshot);
        // Now redo stack should be empty
        await redo(); // Should not change tasks
        // After undo then no-op redo, tasks remain
        expect((await getTasksAsync()).length).toBe(1);
    });

    test('undo and redo cycle preserves correct states', async () => {
        const task1 = await addNewTask('State1', '', 'SOMEDAY', null, 'home', 'low');
        const snapshotWith1 = await getTasksAsync();
        pushUndoState(snapshotWith1);

        const task2 = await addNewTask('State2', '', 'SOMEDAY', null, 'home', 'low');
        expect((await getTasksAsync()).length).toBe(2);

        await undo();
        expect((await getTasksAsync()).length).toBe(1);
        expect((await getTasksAsync())[0].title).toBe('State1');

        await redo();
        expect((await getTasksAsync()).length).toBe(2);
    });

    test('new action after undo clears redo stack', async () => {
        await addNewTask('X', '', 'SOMEDAY', null, 'home', 'low');
        const snapshot = await getTasksAsync();
        pushUndoState(snapshot);

        await addNewTask('Y', '', 'SOMEDAY', null, 'home', 'low');
        await undo();
        // Now add a new task — this should clear redo
        const snapshotForY = await getTasksAsync();
        pushUndoState(snapshotForY);
        await addNewTask('Z', '', 'SOMEDAY', null, 'home', 'low');

        // Redo should not bring Y back (redo stack was cleared)
        await redo();
        const tasks = await getTasksAsync();
        const titles = tasks.map(t => t.title);
        expect(titles).not.toContain('Y');
        expect(titles).toContain('Z');
    });
});

// -------------------------------------------------------
// Recurring Tasks
// -------------------------------------------------------
describe('Recurring tasks', () => {
    test('createRecurringInstance creates task with same title', () => {
        const task = new Task('orig', 'Stand-Up', '', 'SOMEDAY', false, null, 'home', 0, [], 'low', '', null, 'daily');
        const next = createRecurringInstance(task);
        expect(next.title).toBe('Stand-Up');
    });

    test('createRecurringInstance has new unique ID', () => {
        const task = new Task('orig', 'Test', '', 'SOMEDAY', false, null, 'home', 0, [], 'low', '', null, 'weekly');
        const next = createRecurringInstance(task);
        expect(next.id).not.toBe('orig');
    });

    test('createRecurringInstance resets completed and schedule', () => {
        const task = new Task('orig', 'Test', '', 'SOMEDAY', true, null, 'home', 0, [{ day: 'monday', blockId: 'ai-study', completed: true }], 'low', '', null, 'weekly');
        const next = createRecurringInstance(task);
        expect(next.completed).toBe(false);
        expect(next.schedule).toEqual([]);
        expect(next.completedAt).toBeNull();
    });

    test('daily recurrence shifts deadline by 1 day', () => {
        const task = new Task('orig', 'Test', '', 'CRITICAL', false, '2025-03-01', 'home', 0, [], 'low', '', null, 'daily');
        const next = createRecurringInstance(task);
        expect(next.deadline).toBe('2025-03-02');
    });

    test('weekly recurrence shifts deadline by 7 days', () => {
        const task = new Task('orig', 'Test', '', 'CRITICAL', false, '2025-03-01', 'home', 0, [], 'low', '', null, 'weekly');
        const next = createRecurringInstance(task);
        expect(next.deadline).toBe('2025-03-08');
    });

    test('monthly recurrence shifts deadline by 1 month', () => {
        // Use mid-month date to avoid timezone boundary issues
        const task = new Task('orig', 'Test', '', 'CRITICAL', false, '2025-06-15', 'home', 0, [], 'low', '', null, 'monthly');
        const next = createRecurringInstance(task);
        expect(next.deadline).toBe('2025-07-15');
    });

    test('recurring task with null deadline keeps null', () => {
        const task = new Task('orig', 'Test', '', 'SOMEDAY', false, null, 'home', 0, [], 'low', '', null, 'daily');
        const next = createRecurringInstance(task);
        expect(next.deadline).toBeNull();
    });

    test('completing a recurring task via updateTask creates new instance', async () => {
        const task = await addNewTask('Recurring', '', 'SOMEDAY', null, 'home', 'low', '', 'daily');
        const retrieved = await getTaskById(task.id);
        retrieved.completed = true;
        await updateTask(retrieved);

        const allTasks = await getTasksAsync();
        // Original completed + new recurring instance
        expect(allTasks.length).toBe(2);
        const activeTask = allTasks.find(t => !t.completed);
        expect(activeTask).toBeDefined();
        expect(activeTask.title).toBe('Recurring');
        expect(activeTask.recurrence).toBe('daily');
    });
});

// -------------------------------------------------------
// Archive grouping (completedAt grouping logic)
// -------------------------------------------------------
describe('Archive grouping logic', () => {
    test('tasks without completedAt do not appear in date groups', () => {
        const completedTasks = [
            { id: 't1', title: 'Old', completed: true, completedAt: null },
            { id: 't2', title: 'New', completed: true, completedAt: '2025-06-01T10:00:00.000Z' }
        ];
        // Simulate grouping logic: group by date string
        const grouped = {};
        completedTasks.forEach(t => {
            const key = t.completedAt
                ? new Date(t.completedAt).toLocaleDateString()
                : 'Unknown Date';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(t);
        });
        expect(grouped['Unknown Date']).toBeDefined();
        expect(grouped['Unknown Date'].length).toBe(1);
    });

    test('tasks with same completedAt date are grouped together', () => {
        const completedTasks = [
            { id: 't1', completed: true, completedAt: '2025-06-01T08:00:00.000Z' },
            { id: 't2', completed: true, completedAt: '2025-06-01T20:00:00.000Z' },
            { id: 't3', completed: true, completedAt: '2025-06-02T10:00:00.000Z' }
        ];
        const grouped = {};
        completedTasks.forEach(t => {
            const key = new Date(t.completedAt).toLocaleDateString();
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(t);
        });
        const keys = Object.keys(grouped);
        // 2 distinct dates
        expect(keys.length).toBe(2);
    });
});
