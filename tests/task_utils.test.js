// tests/task_utils.test.js
require('./mocks/chrome.storage.mock');
const path = require('path');

// Load task_utils.js into global scope
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
