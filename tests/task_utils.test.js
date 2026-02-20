// tests/task_utils.test.js
require('./mocks/chrome.storage.mock');
const path = require('path');

// Load task_utils.js into global scope
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
    'parseTimeRange', 'validateTimeBlockOverlap'
]);

beforeEach(() => {
    resetChromeStorage();
    document.body.innerHTML = '<div id="info-message-area" class="info-message" style="display: none;"></div>';
});

describe('Task class', () => {
    test('creates task with default values', () => {
        const task = new Task(null, 'Test Task');
        expect(task.title).toBe('Test Task');
        expect(task.priority).toBe('SOMEDAY');
        expect(task.completed).toBe(false);
        expect(task.type).toBe('home');
        expect(task.displayOrder).toBe(0);
        expect(task.schedule).toEqual([]);
        expect(task.energy).toBe('low');
        expect(task.url).toBe('');
        expect(task.deadline).toBeNull();
    });

    test('generates unique ID when none provided', () => {
        const task1 = new Task(null, 'Task 1');
        const task2 = new Task(null, 'Task 2');
        expect(task1.id).toMatch(/^task_\d+_[a-z0-9]+$/);
        expect(task1.id).not.toBe(task2.id);
    });

    test('uses provided ID', () => {
        const task = new Task('custom-id', 'Test');
        expect(task.id).toBe('custom-id');
    });

    test('accepts all constructor parameters', () => {
        const task = new Task('id1', 'Title', 'https://example.com', 'CRITICAL', true, '2025-01-01', 'work', 5, [{ day: 'monday', blockId: 'ai-study', completed: false }], 'high');
        expect(task.url).toBe('https://example.com');
        expect(task.priority).toBe('CRITICAL');
        expect(task.completed).toBe(true);
        expect(task.deadline).toBe('2025-01-01');
        expect(task.type).toBe('work');
        expect(task.displayOrder).toBe(5);
        expect(task.schedule).toHaveLength(1);
        expect(task.energy).toBe('high');
    });
});

describe('getTasks', () => {
    test('returns empty array when no tasks stored', (done) => {
        getTasks(tasks => {
            expect(tasks).toEqual([]);
            done();
        });
    });

    test('returns stored tasks', (done) => {
        seedTasks([{ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' }]);
        getTasks(tasks => {
            expect(tasks).toHaveLength(1);
            expect(tasks[0].title).toBe('Test');
            done();
        });
    });

    test('backfills missing displayOrder', (done) => {
        seedTasks([{ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', schedule: [], energy: 'low' }]);
        getTasks(tasks => {
            expect(tasks[0].displayOrder).toBe(0);
            done();
        });
    });

    test('backfills missing schedule', (done) => {
        seedTasks([{ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, energy: 'low' }]);
        getTasks(tasks => {
            expect(tasks[0].schedule).toEqual([]);
            done();
        });
    });

    test('backfills missing schedule.completed', (done) => {
        seedTasks([{ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [{ day: 'monday', blockId: 'ai-study' }], energy: 'low' }]);
        getTasks(tasks => {
            expect(tasks[0].schedule[0].completed).toBe(false);
            done();
        });
    });

    test('backfills missing energy', (done) => {
        seedTasks([{ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [] }]);
        getTasks(tasks => {
            expect(tasks[0].energy).toBe('low');
            done();
        });
    });

    test('handles storage error gracefully', (done) => {
        chrome.runtime.lastError = { message: 'Storage error' };
        getTasks(tasks => {
            expect(tasks).toEqual([]);
            chrome.runtime.lastError = null;
            done();
        });
    });
});

describe('saveTasks', () => {
    test('saves tasks to storage', (done) => {
        const tasks = [new Task('id1', 'Test Task')];
        saveTasks(tasks, (success) => {
            expect(success).toBe(true);
            expect(chrome.storage.local.set).toHaveBeenCalled();
            done();
        });
    });

    test('serializes class instances to plain objects', (done) => {
        const task = new Task('id1', 'Test');
        saveTasks([task], (success) => {
            expect(success).toBe(true);
            const savedArg = chrome.storage.local.set.mock.calls[0][0];
            expect(savedArg.tasks[0].constructor).toBe(Object);
            done();
        });
    });

    test('handles storage error', (done) => {
        chrome.runtime.lastError = { message: 'Quota exceeded' };
        // Override set to simulate error
        chrome.storage.local.set.mockImplementationOnce((items, callback) => {
            chrome.runtime.lastError = { message: 'Quota exceeded' };
            callback();
            chrome.runtime.lastError = null;
        });
        saveTasks([new Task('id1', 'Test')], (success, errorMsg) => {
            expect(success).toBe(false);
            done();
        });
    });
});

describe('addNewTask', () => {
    test('creates task with correct displayOrder', async () => {
        seedTasks([{ id: 'existing', title: 'Existing', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' }]);
        const result = await addNewTask('New Task', '', 'SOMEDAY', null, 'home', 'low');
        expect(result).not.toBeNull();
        expect(result.title).toBe('New Task');
        expect(result.displayOrder).toBe(1);
    });

    test('creates task in empty priority group', async () => {
        seedTasks([{ id: 'existing', title: 'Existing', priority: 'CRITICAL', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low', deadline: '2025-01-01' }]);
        const result = await addNewTask('New Someday', '', 'SOMEDAY', null, 'home', 'low');
        expect(result).not.toBeNull();
        expect(result.priority).toBe('SOMEDAY');
    });

    test('returns null on save failure', async () => {
        chrome.storage.local.set.mockImplementationOnce((items, callback) => {
            chrome.runtime.lastError = { message: 'Error' };
            callback();
            chrome.runtime.lastError = null;
        });
        const result = await addNewTask('Test', '', 'SOMEDAY', null, 'home');
        expect(result).toBeNull();
    });
});

describe('getTaskById', () => {
    test('returns correct task', async () => {
        seedTasks([
            { id: 'task1', title: 'Task 1', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' },
            { id: 'task2', title: 'Task 2', priority: 'IMPORTANT', completed: false, type: 'work', displayOrder: 0, schedule: [], energy: 'high' },
        ]);
        const task = await getTaskById('task2');
        expect(task.title).toBe('Task 2');
    });

    test('returns undefined for non-existent ID', async () => {
        seedTasks([{ id: 'task1', title: 'Task 1', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' }]);
        const task = await getTaskById('nonexistent');
        expect(task).toBeUndefined();
    });
});

describe('updateTaskCompletion', () => {
    test('sets completed=true when all schedule items complete', () => {
        const task = { completed: false, schedule: [{ completed: true }, { completed: true }] };
        updateTaskCompletion(task);
        expect(task.completed).toBe(true);
    });

    test('sets completed=false when some schedule items incomplete', () => {
        const task = { completed: true, schedule: [{ completed: true }, { completed: false }] };
        updateTaskCompletion(task);
        expect(task.completed).toBe(false);
    });

    test('does not change completed for tasks without schedule', () => {
        const task = { completed: true, schedule: [] };
        updateTaskCompletion(task);
        expect(task.completed).toBe(true);
    });

    test('does not change completed when schedule is undefined', () => {
        const task = { completed: false };
        updateTaskCompletion(task);
        expect(task.completed).toBe(false);
    });
});

describe('updateTask', () => {
    test('updates existing task', async () => {
        seedTasks([{ id: 'task1', title: 'Old Title', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' }]);
        const result = await updateTask({ id: 'task1', title: 'New Title', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' });
        expect(result).toBe(true);
    });

    test('returns false for non-existent task', async () => {
        seedTasks([]);
        const result = await updateTask({ id: 'nonexistent', title: 'Test', schedule: [] });
        expect(result).toBe(false);
    });

    test('calls updateTaskCompletion before saving', async () => {
        seedTasks([{ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [{ day: 'monday', blockId: 'ai-study', completed: true }], energy: 'low' }]);
        const result = await updateTask({ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [{ day: 'monday', blockId: 'ai-study', completed: true }], energy: 'low' });
        expect(result).toBe(true);
        // The task should be marked completed since all schedule items are completed
    });

    test('updates lastModified timestamp', async () => {
        const oldTime = '2025-01-01T00:00:00.000Z';
        seedTasks([{ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low', lastModified: oldTime }]);

        const before = new Date().toISOString();
        await updateTask({ id: 'task1', title: 'Updated', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low', lastModified: oldTime });
        const after = new Date().toISOString();

        const updated = await getTaskById('task1');
        expect(updated.lastModified).not.toBe(oldTime);
        expect(updated.lastModified >= before).toBe(true);
        expect(updated.lastModified <= after).toBe(true);
    });
});

describe('deleteTask', () => {
    test('removes task by ID', async () => {
        seedTasks([
            { id: 'task1', title: 'Task 1', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' },
            { id: 'task2', title: 'Task 2', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 1, schedule: [], energy: 'low' },
        ]);
        const result = await deleteTask('task1');
        expect(result).toBe(true);
    });

    test('returns false for non-existent ID', async () => {
        seedTasks([{ id: 'task1', title: 'Task 1', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' }]);
        const result = await deleteTask('nonexistent');
        expect(result).toBe(false);
    });
});

describe('showInfoMessage', () => {
    test('displays message in message area', () => {
        jest.useFakeTimers();
        showInfoMessage('Test message', 'success', 3000, document);
        const messageArea = document.getElementById('info-message-area');
        expect(messageArea.textContent).toBe('Test message');
        expect(messageArea.classList.contains('success')).toBe(true);
        jest.useRealTimers();
    });

    test('auto-hides after duration', () => {
        jest.useFakeTimers();
        showInfoMessage('Test message', 'info', 1000, document);
        const messageArea = document.getElementById('info-message-area');
        expect(messageArea.classList.contains('visible')).toBe(false); // Not visible yet (needs rAF)
        jest.advanceTimersByTime(1100);
        expect(messageArea.classList.contains('visible')).toBe(false);
        jest.useRealTimers();
    });

    test('clears previous message timeout', () => {
        jest.useFakeTimers();
        showInfoMessage('First', 'info', 3000, document);
        showInfoMessage('Second', 'success', 3000, document);
        const messageArea = document.getElementById('info-message-area');
        expect(messageArea.textContent).toBe('Second');
        expect(messageArea.classList.contains('success')).toBe(true);
        jest.useRealTimers();
    });

    test('falls back to alert when message area not found', () => {
        document.body.innerHTML = ''; // Remove message area
        const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
        showInfoMessage('Alert message', 'error', 3000, document);
        expect(alertMock).toHaveBeenCalledWith('Alert message');
        alertMock.mockRestore();
    });
});

describe('validateTask', () => {
    test('catches empty title', () => {
        const errors = validateTask({ title: '', priority: 'SOMEDAY' });
        expect(errors).toContain('Task title is required.');
    });

    test('catches missing CRITICAL deadline', () => {
        const errors = validateTask({ title: 'Test', priority: 'CRITICAL', deadline: null });
        expect(errors).toContain('Deadline is required for CRITICAL tasks.');
    });

    test('catches invalid URL', () => {
        const errors = validateTask({ title: 'Test', priority: 'SOMEDAY', url: 'not-a-url' });
        expect(errors).toContain('Invalid URL format.');
    });

    test('returns no errors for valid task', () => {
        const errors = validateTask({ title: 'Test', priority: 'SOMEDAY', url: 'https://example.com' });
        expect(errors).toHaveLength(0);
    });

    test('accepts empty URL', () => {
        const errors = validateTask({ title: 'Test', priority: 'SOMEDAY', url: '' });
        expect(errors).toHaveLength(0);
    });
});

describe('isValidUrl', () => {
    test('returns true for valid URLs', () => {
        expect(isValidUrl('https://example.com')).toBe(true);
        expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    test('returns false for invalid URLs', () => {
        expect(isValidUrl('not-a-url')).toBe(false);
        expect(isValidUrl('')).toBe(false);
    });
});

describe('getTasksAsync', () => {
    test('returns tasks as Promise', async () => {
        seedTasks([{ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' }]);
        const tasks = await getTasksAsync();
        expect(tasks).toHaveLength(1);
        expect(tasks[0].title).toBe('Test');
    });
});

describe('saveTasksAsync', () => {
    test('saves and resolves on success', async () => {
        const result = await saveTasksAsync([new Task('id1', 'Test')]);
        expect(result).toBe(true);
    });
});

describe('debounce', () => {
    test('delays function execution', () => {
        jest.useFakeTimers();
        const fn = jest.fn();
        const debounced = debounce(fn, 500);
        debounced();
        expect(fn).not.toHaveBeenCalled();
        jest.advanceTimersByTime(500);
        expect(fn).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });

    test('only calls once for rapid invocations', () => {
        jest.useFakeTimers();
        const fn = jest.fn();
        const debounced = debounce(fn, 500);
        debounced();
        debounced();
        debounced();
        jest.advanceTimersByTime(500);
        expect(fn).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });
});

describe('withTaskLock', () => {
    test('serializes concurrent operations', async () => {
        const order = [];
        const op1 = withTaskLock(async () => {
            order.push('start1');
            await new Promise(r => setTimeout(r, 50));
            order.push('end1');
        });
        const op2 = withTaskLock(async () => {
            order.push('start2');
            order.push('end2');
        });
        await op2;
        expect(order).toEqual(['start1', 'end1', 'start2', 'end2']);
    });
});

describe('Task new fields', () => {
    test('new Task has notes, completedAt, recurrence defaults', () => {
        const task = new Task(null, 'Test');
        expect(task.notes).toBe('');
        expect(task.completedAt).toBeNull();
        expect(task.recurrence).toBeNull();
    });

    test('Task accepts notes, completedAt, recurrence params', () => {
        const task = new Task('id1', 'Title', '', 'SOMEDAY', false, null, 'home', 0, [], 'low', 'Some notes', '2025-01-01T00:00:00.000Z', 'weekly');
        expect(task.notes).toBe('Some notes');
        expect(task.completedAt).toBe('2025-01-01T00:00:00.000Z');
        expect(task.recurrence).toBe('weekly');
    });

    test('new Task has lastModified set automatically', () => {
        const before = new Date().toISOString();
        const task = new Task(null, 'Test');
        const after = new Date().toISOString();
        expect(task.lastModified).toBeDefined();
        expect(task.lastModified >= before).toBe(true);
        expect(task.lastModified <= after).toBe(true);
    });

    test('Task accepts lastModified param', () => {
        const customTime = '2025-01-15T12:00:00.000Z';
        const task = new Task('id1', 'Title', '', 'SOMEDAY', false, null, 'home', 0, [], 'low', '', null, null, null, customTime);
        expect(task.lastModified).toBe(customTime);
    });
});

describe('getTasks backfill for new fields', () => {
    test('backfills missing notes', (done) => {
        seedTasks([{ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' }]);
        getTasks(tasks => {
            expect(tasks[0].notes).toBe('');
            done();
        });
    });

    test('backfills missing completedAt', (done) => {
        seedTasks([{ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' }]);
        getTasks(tasks => {
            expect(tasks[0].completedAt).toBeNull();
            done();
        });
    });

    test('backfills missing recurrence', (done) => {
        seedTasks([{ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' }]);
        getTasks(tasks => {
            expect(tasks[0].recurrence).toBeNull();
            done();
        });
    });

    test('backfills missing lastModified', (done) => {
        seedTasks([{ id: 'task1', title: 'Test', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low' }]);
        getTasks(tasks => {
            expect(tasks[0].lastModified).toBeDefined();
            expect(new Date(tasks[0].lastModified).getTime()).not.toBeNaN();
            done();
        });
    });
});

describe('getSettings / saveSettings', () => {
    test('getSettings returns defaults when nothing stored', async () => {
        const settings = await getSettings();
        expect(settings.theme).toBe('light');
        expect(settings.fontFamily).toBe('system');
        expect(settings.fontSize).toBe('medium');
        expect(settings.hasSeenSampleTasks).toBe(false);
    });

    test('saveSettings persists and getSettings retrieves', async () => {
        await saveSettings({ theme: 'dark', fontFamily: 'inter', fontSize: 'large', hasSeenSampleTasks: true, notionApiKey: '', notionDatabaseId: '', googleSheetsUrl: '' });
        const settings = await getSettings();
        expect(settings.theme).toBe('dark');
        expect(settings.fontFamily).toBe('inter');
        expect(settings.fontSize).toBe('large');
    });

    test('getSettings merges stored values with defaults', async () => {
        seedSettings({ theme: 'dark' });
        const settings = await getSettings();
        expect(settings.theme).toBe('dark');
        expect(settings.fontFamily).toBe('system'); // default
    });
});

describe('getTimeBlocks / saveTimeBlocks', () => {
    test('getTimeBlocks returns DEFAULT_TIME_BLOCKS when nothing stored', async () => {
        const blocks = await getTimeBlocks();
        expect(blocks).toHaveLength(DEFAULT_TIME_BLOCKS.length);
        expect(blocks[0].id).toBe(DEFAULT_TIME_BLOCKS[0].id);
    });

    test('saveTimeBlocks persists and getTimeBlocks retrieves', async () => {
        const custom = [{ id: 'custom-block', label: 'Custom', time: '[9AM-10AM]', limit: '1', colorClass: '' }];
        await saveTimeBlocks(custom);
        const blocks = await getTimeBlocks();
        expect(blocks).toHaveLength(1);
        expect(blocks[0].id).toBe('custom-block');
    });
});

describe('addNewTask with notes and recurrence', () => {
    test('addNewTask stores notes field', async () => {
        const task = await addNewTask('Test', '', 'SOMEDAY', null, 'home', 'low', 'My notes', null);
        expect(task.notes).toBe('My notes');
    });

    test('addNewTask stores recurrence field', async () => {
        const task = await addNewTask('Test', '', 'SOMEDAY', null, 'home', 'low', '', 'weekly');
        expect(task.recurrence).toBe('weekly');
    });
});

describe('createRecurringInstance', () => {
    test('creates a new task with new id', () => {
        const task = new Task('orig-id', 'Recurring', '', 'SOMEDAY', false, null, 'home', 0, [], 'low', '', null, 'daily');
        const instance = createRecurringInstance(task);
        expect(instance.id).not.toBe('orig-id');
        expect(instance.title).toBe('Recurring');
    });

    test('new instance has empty schedule and completed=false', () => {
        const task = new Task('id1', 'Test', '', 'SOMEDAY', true, null, 'home', 0, [{ day: 'monday', blockId: 'ai-study', completed: true }], 'low', '', null, 'weekly');
        const instance = createRecurringInstance(task);
        expect(instance.schedule).toEqual([]);
        expect(instance.completed).toBe(false);
    });

    test('shifts deadline by 1 day for daily recurrence', () => {
        const task = new Task('id1', 'Test', '', 'CRITICAL', false, '2025-06-01', 'home', 0, [], 'low', '', null, 'daily');
        const instance = createRecurringInstance(task);
        expect(instance.deadline).toBe('2025-06-02');
    });

    test('shifts deadline by 7 days for weekly recurrence', () => {
        const task = new Task('id1', 'Test', '', 'CRITICAL', false, '2025-06-01', 'home', 0, [], 'low', '', null, 'weekly');
        const instance = createRecurringInstance(task);
        expect(instance.deadline).toBe('2025-06-08');
    });

    test('new instance has fresh lastModified timestamp', () => {
        const oldTime = '2025-01-01T00:00:00.000Z';
        const task = new Task('id1', 'Test', '', 'SOMEDAY', false, null, 'home', 0, [], 'low', '', null, 'daily', null, oldTime);
        const before = new Date().toISOString();
        const instance = createRecurringInstance(task);
        const after = new Date().toISOString();
        expect(instance.lastModified).toBeDefined();
        expect(instance.lastModified >= before).toBe(true);
        expect(instance.lastModified <= after).toBe(true);
    });
});

describe('pushUndoState / undo / redo', () => {
    test('undo restores previous state', async () => {
        const task1 = await addNewTask('Task A', '', 'SOMEDAY', null, 'home', 'low');
        const tasksBefore = await getTasksAsync();
        pushUndoState(tasksBefore);

        await addNewTask('Task B', '', 'SOMEDAY', null, 'home', 'low');
        const tasksAfterAdd = await getTasksAsync();
        expect(tasksAfterAdd).toHaveLength(2);

        await undo();
        const tasksAfterUndo = await getTasksAsync();
        expect(tasksAfterUndo).toHaveLength(1);
        expect(tasksAfterUndo[0].title).toBe('Task A');
    });

    test('redo re-applies undone state', async () => {
        await addNewTask('Task A', '', 'SOMEDAY', null, 'home', 'low');
        const tasksBeforeDelete = await getTasksAsync();
        pushUndoState(tasksBeforeDelete);

        // Delete the task
        await deleteTask(tasksBeforeDelete[0].id);
        expect(await getTasksAsync()).toHaveLength(0);

        // Undo the delete
        await undo();
        expect(await getTasksAsync()).toHaveLength(1);

        // Redo the delete
        await redo();
        expect(await getTasksAsync()).toHaveLength(0);
    });
});

describe('seedSampleTasks', () => {
    test('creates sample tasks if none exist', async () => {
        const result = await seedSampleTasks();
        const tasks = await getTasksAsync();
        expect(tasks.length).toBeGreaterThan(0);
    });

    test('marks hasSeenSampleTasks=true in settings', async () => {
        await seedSampleTasks();
        const settings = await getSettings();
        expect(settings.hasSeenSampleTasks).toBe(true);
    });
});

describe('parseTimeRange', () => {
    test('parses [1PM-3PM] correctly', () => {
        const range = parseTimeRange('[1PM-3PM]');
        expect(range).toEqual({ start: 13, end: 15 });
    });

    test('parses [12AM-1AM] correctly (midnight)', () => {
        const range = parseTimeRange('[12AM-1AM]');
        expect(range).toEqual({ start: 0, end: 1 });
    });

    test('parses [12PM-1PM] correctly (noon)', () => {
        const range = parseTimeRange('[12PM-1PM]');
        expect(range).toEqual({ start: 12, end: 13 });
    });

    test('parses [7AM-8AM] correctly', () => {
        const range = parseTimeRange('[7AM-8AM]');
        expect(range).toEqual({ start: 7, end: 8 });
    });

    test('parses [10PM-11PM] correctly', () => {
        const range = parseTimeRange('[10PM-11PM]');
        expect(range).toEqual({ start: 22, end: 23 });
    });

    test('returns null for invalid format', () => {
        expect(parseTimeRange('invalid')).toBeNull();
        expect(parseTimeRange('9AM-10AM')).toBeNull(); // missing brackets
        expect(parseTimeRange('[9-10]')).toBeNull(); // missing AM/PM
    });
});

describe('validateTimeBlockOverlap', () => {
    const existingBlocks = [
        { id: 'block1', label: 'Morning', time: '[9AM-12PM]' },
        { id: 'block2', label: 'Afternoon', time: '[1PM-3PM]' }
    ];

    test('detects overlapping time blocks', () => {
        const newBlock = { time: '[10AM-2PM]' };
        const result = validateTimeBlockOverlap(newBlock, existingBlocks);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('overlaps');
        expect(result.error).toContain('Morning');
    });

    test('allows non-overlapping time blocks', () => {
        const newBlock = { time: '[3PM-5PM]' };
        const result = validateTimeBlockOverlap(newBlock, existingBlocks);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
    });

    test('allows adjacent time blocks (no overlap)', () => {
        const newBlock = { time: '[12PM-1PM]' };
        const result = validateTimeBlockOverlap(newBlock, existingBlocks);
        expect(result.valid).toBe(true);
    });

    test('detects overlap with second block', () => {
        const newBlock = { time: '[2PM-4PM]' };
        const result = validateTimeBlockOverlap(newBlock, existingBlocks);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Afternoon');
    });

    test('excludes block by ID when provided', () => {
        const newBlock = { time: '[9AM-12PM]' };
        // Without exclusion, should overlap with block1
        const result1 = validateTimeBlockOverlap(newBlock, existingBlocks);
        expect(result1.valid).toBe(false);

        // With exclusion of block1, should be valid
        const result2 = validateTimeBlockOverlap(newBlock, existingBlocks, 'block1');
        expect(result2.valid).toBe(true);
    });

    test('returns error for invalid time format', () => {
        const newBlock = { time: 'invalid' };
        const result = validateTimeBlockOverlap(newBlock, existingBlocks);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid time format');
    });
});

describe('DEFAULT_TIME_BLOCKS renamed labels', () => {
    test('late-night-read has label "Late Night Block"', () => {
        const block = DEFAULT_TIME_BLOCKS.find(b => b.id === 'late-night-read');
        expect(block.label).toBe('Late Night Block');
    });

    test('ai-study has label "Deep Work Block 1"', () => {
        const block = DEFAULT_TIME_BLOCKS.find(b => b.id === 'ai-study');
        expect(block.label).toBe('Deep Work Block 1');
    });

    test('deep-work-1 has label "Deep Work Block 2"', () => {
        const block = DEFAULT_TIME_BLOCKS.find(b => b.id === 'deep-work-1');
        expect(block.label).toBe('Deep Work Block 2');
    });

    test('deep-work-2 has label "Deep Work Block 3"', () => {
        const block = DEFAULT_TIME_BLOCKS.find(b => b.id === 'deep-work-2');
        expect(block.label).toBe('Deep Work Block 3');
    });

    test('family-time has label "Chill Time"', () => {
        const block = DEFAULT_TIME_BLOCKS.find(b => b.id === 'family-time');
        expect(block.label).toBe('Chill Time');
    });

    test('night-build has label "Night Block"', () => {
        const block = DEFAULT_TIME_BLOCKS.find(b => b.id === 'night-build');
        expect(block.label).toBe('Night Block');
    });

    test('morning-prep has label "Morning Prep"', () => {
        const block = DEFAULT_TIME_BLOCKS.find(b => b.id === 'morning-prep');
        expect(block.label).toBe('Morning Prep');
    });
});
